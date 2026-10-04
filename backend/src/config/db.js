const mongoose = require("mongoose");

let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = {
    conn: null,
    promise: null,
  };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not defined");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 5,
        bufferCommands: false,
      })
      .then((connection) => {
        console.log(
          `MongoDB Connected: ${connection.connection.host}`
        );
        return connection;
      })
      .catch((error) => {
        console.error(
          "MongoDB connection failed:",
          error.message
        );
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;