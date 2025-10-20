const express = require("express");
const { getAllUsers } = require("../../controllers/authController");

const _ = express.Router();
_.get("/", getAllUsers);
module.exports = _;
