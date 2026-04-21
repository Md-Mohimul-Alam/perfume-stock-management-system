require('dotenv').config();
const connectDB = require('./src/config/db.config');
const app = require('./src/app');

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});