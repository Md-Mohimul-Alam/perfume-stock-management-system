const mongoose = require("mongoose");

let cached =
  global.mongooseConnection;

if (!cached) {
  cached =
    global.mongooseConnection = {
      conn: null,
      promise: null,
    };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is not defined"
    );
  }

  if (!cached.promise) {
    cached.promise =
      mongoose.connect(
        process.env.MONGO_URI,
        {
          bufferCommands: false,
          serverSelectionTimeoutMS: 5000,
          maxPoolSize: 10,
        }
      );
  }

  try {
    cached.conn =
      await cached.promise;

    console.log(
      "MongoDB connected"
    );

    return cached.conn;
  } catch (error) {
    cached.promise = null;

    console.error(
      "MongoDB connection failed:",
      error
    );

    throw error;
  }
};

module.exports = connectDB;