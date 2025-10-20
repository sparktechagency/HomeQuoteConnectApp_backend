const User = require("../models/userModel");
const response = require("../utils/response");

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    response.success(res, users);
  } catch (err) {
    next(err);
  }
};
