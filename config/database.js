// config/database.js
const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');
const Job = require('../models/Job'); // Make sure your Job model is imported

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Ensure text index exists on Job collection
    await Job.collection.createIndex(
      { title: "text", description: "text" }, 
      { name: "JobsTextIndex", weights: { title: 10, description: 5 } }
    );
    console.log('✅ Text index created on jobs collection');

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
