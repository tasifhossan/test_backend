const express = require("express");
const auth_routes = require("./auth.routes.js");
const complaint_routes = require("./complaint.routes.js");
const profile_routes = require("./my.routes.js");
const citizen_routes = require("./citizen.routes.js");

const routes = express.Router();

routes.use("/auth", auth_routes);
routes.use("/complain", complaint_routes);
routes.use("/my", profile_routes);
routes.use("/citizen", citizen_routes);

module.exports = routes;

