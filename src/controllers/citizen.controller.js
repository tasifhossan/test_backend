const ApiError = require("../utils/apiError.js");
const ComplaintModel = require("../models/complaint.model.js");
const cloudinary = require("../config/cloudinary.js");

const addNewComplain = async (req, res, next) => {
  const { longitude, latitude, city, street, title, description } = req.body;
  try {
    if (longitude && latitude && city && street && title && description) {
      if (!req.files || req.files.length === 0) {
        return next(new ApiError(400, "Minimum 1 image required"));
      }

      // Upload multiple files to Cloudinary from memory buffer
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          if (
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
          ) {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "uploads" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              }
            );
            stream.end(file.buffer);
          } else {
            // Mock upload if Cloudinary is not configured
            resolve(`https://via.placeholder.com/600x400.png?text=Mock+Upload+${Date.now()}`);
          }
        });
      });

      const imgURL = await Promise.all(uploadPromises);

      const response = await ComplaintModel.addNewComplain(
        longitude,
        latitude,
        city,
        street,
        title,
        description,
        req.user_id,
        imgURL
      );

      res.status(200).json({
        success: true,
        message: "complain added successfully",
        complain: response,
        uploadedFiles: imgURL.map((url, index) => ({
          file_url: url,
          public_id: `file_${index}`
        }))
      });
    } else {
      return next(
        new ApiError(
          400,
          "longitude, latitude, city, street, title, description cannot be empty"
        )
      );
    }
  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};

// Get Complain List By UserID
const getComplainByUserId = async (req, res, next) => {
  const userID = req.user_id;

  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const response = await ComplaintModel.userComplainList(
      userID,
      limit,
      offset
    );

    if (response.length === 0) {
      return next(new ApiError(404, "No complaints found"));
    }

    const finalResponse = response.map((data) => ({
      id: data.id,
      title: data.title,
      poster: data.image_url,
      created_at: data.created_at,
      description: data.description,
      longitude: data.longitude,
      latitude: data.latitude,
      street: data.street,
      city: data.city,
    }));

    res.status(200).json({
      success: true,
      message: `${response.length} complaints found`,
      page,
      limit,
      hasMore: response.length === limit,
      complaints: finalResponse,
    });
  } catch (error) {
    next(new ApiError(500, error.message));
  }
};

module.exports = {
  addNewComplain,
  getComplainByUserId,
};
