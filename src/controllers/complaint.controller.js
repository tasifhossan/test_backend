const { GoogleGenAI } = require("@google/genai");
const ComplaintModel = require("../models/complaint.model.js");
const cloudinary = require("../config/cloudinary.js");
const ApiError = require("../utils/apiError.js");

// Local fallback rule-based classification
function classifyComplaintLocal(description) {
  const desc = description.toLowerCase();
  let category = "Other";
  let department_id = null; // Seed IDs: 1: Waterlogging, 2: Road Repair, 3: Waste Management, 4: Electricity

  if (
    desc.includes("water") ||
    desc.includes("flood") ||
    desc.includes("drain") ||
    desc.includes("clog") ||
    desc.includes("sewer") ||
    desc.includes("canal")
  ) {
    category = "Waterlogging";
    department_id = 1;
  } else if (
    desc.includes("road") ||
    desc.includes("pothole") ||
    desc.includes("street") ||
    desc.includes("crack") ||
    desc.includes("traffic") ||
    desc.includes("asphalt")
  ) {
    category = "Road Repair";
    department_id = 2;
  } else if (
    desc.includes("garbage") ||
    desc.includes("waste") ||
    desc.includes("trash") ||
    desc.includes("bin") ||
    desc.includes("dump") ||
    desc.includes("litter") ||
    desc.includes("cleaning")
  ) {
    category = "Waste Management";
    department_id = 3;
  } else if (
    desc.includes("electric") ||
    desc.includes("light") ||
    desc.includes("power") ||
    desc.includes("wire") ||
    desc.includes("current") ||
    desc.includes("transformer") ||
    desc.includes("bulb")
  ) {
    category = "Electricity";
    department_id = 4;
  }

  let priority = "medium";
  if (
    desc.includes("urgent") ||
    desc.includes("danger") ||
    desc.includes("risk") ||
    desc.includes("injury") ||
    desc.includes("accident") ||
    desc.includes("fire") ||
    desc.includes("shock") ||
    desc.includes("die")
  ) {
    priority = "critical";
  } else if (
    desc.includes("broken") ||
    desc.includes("bad") ||
    desc.includes("leak") ||
    desc.includes("dark") ||
    desc.includes("smell")
  ) {
    priority = "high";
  } else if (desc.includes("small") || desc.includes("minor") || desc.includes("slow")) {
    priority = "low";
  }

  const ai_confidence_score = parseFloat((Math.random() * 15 + 80).toFixed(2));

  return {
    ai_category: category,
    ai_priority: priority,
    ai_confidence_score,
    department_id,
  };
}

// Hybrid AI Classification: checks for Gemini API key, otherwise falls back to local rules
async function classifyComplaintAI(description) {
  if (process.env.GEMINI_API_KEY) {
    console.log("Processing complaint classification with Gemini API...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the municipal categorization bot for MuniFix Chittogram. 
Categorize the following citizen complaint description into one of these exact categories: 
- 'Waterlogging' (drainage, flooding, sewer, canals)
- 'Road Repair' (potholes, street cracks, traffic light damage)
- 'Waste Management' (garbage piles, trash, littering, bin placement)
- 'Electricity' (power cuts, broken transformer, dead street bulb, hanging wires)
- 'Other' (if none of the above match)

Also predict the priority level as one of: 'low', 'medium', 'high', 'critical'.
Indicate your confidence score as a percentage between 0 and 100.
Also predict the target department_id:
- 1 for Waterlogging
- 2 for Road Repair
- 3 for Waste Management
- 4 for Electricity
- null for Other

Respond strictly with a JSON object in this format (do not wrap in markdown or blockquotes):
{
  "category": "exact category string",
  "priority": "exact priority string",
  "confidence": 85.5,
  "department_id": 1
}

Citizen description: "${description}"`
      });

      const text = response.text.trim();
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        ai_category: parsed.category || "Other",
        ai_priority: parsed.priority || "medium",
        ai_confidence_score: parsed.confidence ? parseFloat(parsed.confidence) : 80.0,
        department_id: parsed.department_id || null
      };
    } catch (err) {
      console.warn("Gemini API classification failed, falling back to local rule classification:", err.message);
      return classifyComplaintLocal(description);
    }
  } else {
    console.log("No process.env.GEMINI_API_KEY detected. Using local keyword classification rules.");
    return classifyComplaintLocal(description);
  }
}

const createComplaint = async (req, res, next) => {
  try {
    const { citizen_id, description, latitude, longitude, category, priority, department_id } = req.body;

    if (!citizen_id) {
      return next(new ApiError(400, "citizen_id is required."));
    }
    if (!description || description.trim() === "") {
      return next(new ApiError(400, "Complaint description is required."));
    }

    // Process image file if uploaded
    let image_url = null;
    if (req.file) {
      if (
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      ) {
        try {
          const uploadPromise = new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "munifix" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              }
            );
            stream.end(req.file.buffer);
          });
          image_url = await uploadPromise;
        } catch (err) {
          console.error("Cloudinary upload failed, falling back to placeholder:", err.message);
          image_url = `https://via.placeholder.com/600x400.png?text=Mock+Upload+${Date.now()}`;
        }
      } else {
        image_url = `https://via.placeholder.com/600x400.png?text=Mock+Upload+${Date.now()}`;
      }
    }

    // Perform AI auto-routing and categorization
    const aiDetails = await classifyComplaintAI(description);

    const finalCategory = category || aiDetails.ai_category;
    const finalPriority = priority || aiDetails.ai_priority;
    const finalDeptId = department_id || aiDetails.department_id;

    // Create the complaint record in the database
    const newComplaint = await ComplaintModel.createComplaint({
      citizen_id,
      description,
      image_url: image_url ? [image_url] : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      category: finalCategory,
      priority: finalPriority,
      status: "pending",
      department_id: finalDeptId,
      ai_category: aiDetails.ai_category,
      ai_priority: aiDetails.ai_priority,
      ai_confidence_score: aiDetails.ai_confidence_score,
      ai_override: !!(category || priority || department_id),
    });

    // Create initial history record
    await ComplaintModel.createStatusHistory({
      complaint_id: newComplaint.id,
      old_status: "none",
      new_status: "pending",
      changed_by: citizen_id,
      notes: "Complaint registered in MuniFix system.",
    });

    return res.status(201).json({
      success: true,
      message: "Complaint registered successfully",
      complaint: newComplaint,
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

const listComplaints = async (req, res, next) => {
  try {
    // Allow reading user ID & Role from headers or query parameters for standalone testing
    const citizen_id = req.query.citizen_id || req.headers["x-user-id"];
    const department_id = req.query.department_id || req.headers["x-department-id"];
    const status = req.query.status;
    const category = req.query.category;
    const userRole = req.query.role || req.headers["x-user-role"] || "citizen";

    // Filtering options
    const filterOptions = { status, category };

    if (userRole === "citizen" && citizen_id) {
      filterOptions.citizen_id = citizen_id;
    } else if (userRole === "dept_admin" && department_id) {
      filterOptions.department_id = parseInt(department_id);
    } else {
      // Admin or unfiltered query
      if (citizen_id) filterOptions.citizen_id = citizen_id;
      if (department_id) filterOptions.department_id = parseInt(department_id);
    }

    const complaints = await ComplaintModel.getComplaints(filterOptions);

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

const getComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complaint = await ComplaintModel.getComplaintById(id);

    if (!complaint) {
      return next(new ApiError(404, "Complaint not found."));
    }

    // Get assignments and status history
    const assignment = await ComplaintModel.getAssignment(id);
    const history = await ComplaintModel.getStatusHistory(id);

    return res.status(200).json({
      success: true,
      complaint,
      assignment,
      history,
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, changed_by, notes, worker_id, department_id } = req.body;

    if (!status) {
      return next(new ApiError(400, "status is required."));
    }
    if (!changed_by) {
      return next(new ApiError(400, "changed_by (user ID) is required."));
    }

    const complaint = await ComplaintModel.getComplaintById(id);
    if (!complaint) {
      return next(new ApiError(404, "Complaint not found."));
    }

    const oldStatus = complaint.status;

    // Build fields to update in the complaints table
    const updates = { status };
    if (department_id) {
      updates.department_id = parseInt(department_id);
    }

    const updatedComplaint = await ComplaintModel.updateComplaint(id, updates);

    // Record status history change
    await ComplaintModel.createStatusHistory({
      complaint_id: id,
      old_status: oldStatus,
      new_status: status,
      changed_by,
      notes: notes || `Status updated from ${oldStatus} to ${status}.`,
    });

    // Handle worker assignments if status is 'assigned' or a worker is specified
    let assignment = null;
    if (status === "assigned" || worker_id) {
      if (!worker_id) {
        return next(new ApiError(400, "worker_id is required to assign this complaint."));
      }

      assignment = await ComplaintModel.assignComplaint({
        complaint_id: id,
        worker_id,
        assigned_by: changed_by,
        notes: notes || "Assigned by department admin.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Complaint status updated successfully",
      complaint: updatedComplaint,
      assignment,
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

const deleteComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await ComplaintModel.deleteComplaint(id);

    if (!deleted) {
      return next(new ApiError(404, "Complaint not found."));
    }

    return res.status(200).json({
      success: true,
      message: "Complaint deleted successfully",
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

module.exports = {
  createComplaint,
  listComplaints,
  getComplaint,
  updateStatus,
  deleteComplaint,
};
