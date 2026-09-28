const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  try {
    const connection = await mongoose.connect(
      process.env.MONGO_URI,
      {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      }
    );

    console.log(
      `MongoDB Connected: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error
    );

    throw error;
  }
};

module.exports = connectDB;