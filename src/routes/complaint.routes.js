const express = require("express");
const {
  createComplaint,
  listComplaints,
  getComplaint,
  updateStatus,
  deleteComplaint,
} = require("../controllers/complaint.controller.js");
const upload = require("../middleware/upload.middleware.js");
const { checkAuth, restrictTo } = require("../middleware/auth.middleware.js");

const complaint_routes = express.Router();

// Define Complaint routes
complaint_routes.post("/", checkAuth, restrictTo("citizen"), upload.single("image"), createComplaint);
complaint_routes.get("/", checkAuth, listComplaints);
complaint_routes.get("/:id", checkAuth, getComplaint);
complaint_routes.patch("/:id/status", checkAuth, restrictTo("dept_admin", "super_admin"), updateStatus);
complaint_routes.delete("/:id", checkAuth, restrictTo("dept_admin", "super_admin"), deleteComplaint);

module.exports = complaint_routes;

