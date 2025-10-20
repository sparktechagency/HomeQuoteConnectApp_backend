const mongoose = require("mongoose");
const { mongoUrl } = require("./env");
const connectDB = async () => {
  try {
    await mongoose.connect(`${mongoUrl}`);
    console.log(" MongoDB connected");
  } catch (error) {
    console.error(" MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
