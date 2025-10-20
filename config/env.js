require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUrl: process.env.MONGODB_URL,
  jwtSecret: process.env.JWT_SECRET,
  baseUrl: process.env.BASEURL,
};
