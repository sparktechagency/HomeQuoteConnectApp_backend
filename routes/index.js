const express = require("express");
const _ = express.Router();
const { baseUrl } = require("../config/env.js");

const api = require("./api/index.js");

_.use(baseUrl, api);

module.exports = _;
