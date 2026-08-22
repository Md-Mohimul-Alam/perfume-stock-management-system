// backend/generate-token.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yourdb';

async function generateToken() {
  await mongoose.connect(MONGO_URI);
  // Find an admin user (or any user with a valid _id)
  const user = await User.findOne({ role: 'admin' });
  if (!user) {
    console.error('❌ No admin user found. Please create one first.');
    process.exit(1);
  }
  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
  console.log('✅ Token for user:', user.email);
  console.log('JWT_TOKEN=' + token);
  await mongoose.disconnect();
}
generateToken().catch(console.error);