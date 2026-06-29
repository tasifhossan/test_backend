const express = require("express");
const { profile } = require("../controllers/profile.controller");
const { checkAuth } = require("../middleware/auth.middleware.js");

const profile_routes = express.Router();

profile_routes.get("/profile", checkAuth, profile);

module.exports = profile_routes;

