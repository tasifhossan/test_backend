const pool = require("../config/db.js");

const ComplaintModel = {
  // Create a new complaint
  async createComplaint({
    citizen_id,
    description,
    image_url = null,
    latitude = null,
    longitude = null,
    category = "Other",
    priority = "medium",
    status = "pending",
    department_id = null,
    ai_category = null,
    ai_priority = null,
    ai_confidence_score = null,
    ai_override = false,
  }) {
    const query = `
      INSERT INTO complaints (
        citizen_id, description, image_url, latitude, longitude,
        category, priority, status, department_id,
        ai_category, ai_priority, ai_confidence_score, ai_override
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const values = [
      citizen_id,
      description,
      image_url,
      latitude,
      longitude,
      category,
      priority,
      status,
      department_id,
      ai_category,
      ai_priority,
      ai_confidence_score,
      ai_override,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Get and filter complaints
  async getComplaints({ citizen_id, department_id, status, category }) {
    let query = `
      SELECT c.*, 
             u.name as citizen_name, u.email as citizen_email,
             d.name as department_name
      FROM complaints c
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (citizen_id) {
      query += ` AND c.citizen_id = $${paramIndex}`;
      values.push(citizen_id);
      paramIndex++;
    }

    if (department_id) {
      query += ` AND c.department_id = $${paramIndex}`;
      values.push(department_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (category) {
      query += ` AND c.category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  // Get single complaint details
  async getComplaintById(id) {
    const query = `
      SELECT c.*, 
             u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone,
             d.name as department_name
      FROM complaints c
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  // Update complaint properties (status, department, priority, etc.)
  async updateComplaint(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Allowed columns to update
    const allowedUpdates = [
      "status",
      "department_id",
      "priority",
      "category",
      "ai_override",
      "image_url",
      "description"
    ];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    // Always update the updated_at timestamp
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE complaints
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    values.push(id);

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Delete a complaint
  async deleteComplaint(id) {
    const query = `DELETE FROM complaints WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  },

  // Insert status history record
  async createStatusHistory({ complaint_id, old_status, new_status, changed_by, notes }) {
    const query = `
      INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [complaint_id, old_status, new_status, changed_by, notes]);
    return result.rows[0];
  },

  // Get status history for a complaint
  async getStatusHistory(complaint_id) {
    const query = `
      SELECT sh.*, u.name as changer_name, u.role as changer_role
      FROM status_history sh
      LEFT JOIN users u ON sh.changed_by = u.id
      WHERE sh.complaint_id = $1
      ORDER BY sh.changed_at ASC;
    `;
    const result = await pool.query(query, [complaint_id]);
    return result.rows;
  },

  // Assign complaint to a field worker
  async assignComplaint({ complaint_id, worker_id, assigned_by, notes }) {
    const query = `
      INSERT INTO assignments (complaint_id, worker_id, assigned_by, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (complaint_id) 
      DO UPDATE SET 
        worker_id = EXCLUDED.worker_id,
        assigned_by = EXCLUDED.assigned_by,
        notes = EXCLUDED.notes,
        assigned_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(query, [complaint_id, worker_id, assigned_by, notes]);
    return result.rows[0];
  },

  // Get assignment detail
  async getAssignment(complaint_id) {
    const query = `
      SELECT a.*, 
             w.name as worker_name, w.email as worker_email, w.phone as worker_phone,
             ab.name as assigner_name
      FROM assignments a
      LEFT JOIN users w ON a.worker_id = w.id
      LEFT JOIN users ab ON a.assigned_by = ab.id
      WHERE a.complaint_id = $1;
    `;
    const result = await pool.query(query, [complaint_id]);
    return result.rows[0] || null;
  },

  // Add new complaint from citizen
  async addNewComplain(longitude, latitude, city, street, title, description, citizen_id, imgUrl) {
    const query = `
        INSERT INTO complaints(longitude, latitude, city, street, title, description, status, citizen_id, image_url)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, citizen_id, status;
        `;
    const result = await pool.query(query, [
      longitude,
      latitude,
      city,
      street,
      title,
      description,
      "pending",
      citizen_id,
      imgUrl,
    ]);
    return result.rows[0] || null;
  },

  // Get user's complaint list with pagination
  async userComplainList(user_id, limit = 10, offset = 0) {
    const query = `
      SELECT id, title, image_url, created_at, description,
             longitude, latitude, street, city
      FROM complaints
      WHERE citizen_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3;
    `;
    const response = await pool.query(query, [user_id, limit, offset]);
    return response.rows;
  }
};

module.exports = ComplaintModel;

