const express = require("express");
const { addNewComplain, getComplainByUserId } = require("../controllers/citizen.controller.js");
const upload = require("../middleware/upload.middleware.js");
const { checkAuth, restrictTo } = require("../middleware/auth.middleware.js");

const citizen_routes = express.Router();

citizen_routes.post(
  "/complain",
  checkAuth,
  restrictTo("citizen"),
  upload.array("images", 6),
  addNewComplain
);

citizen_routes.get(
  "/complain",
  checkAuth,
  restrictTo("citizen"),
  getComplainByUserId
);

module.exports = citizen_routes;
