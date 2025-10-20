const express = require("express");
const _ = express.Router();
const authRouter = require("./authRoutes.js");

_.use("/auth", authRouter);

module.exports = _;
