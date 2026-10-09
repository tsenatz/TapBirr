require('dotenv').config();
const app = require('./app');
const { connectDB, sequelize } = require('./config/db');

// Connect to database
connectDB();

// Sync models
sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced');
}).catch((err) => {
  console.error('Failed to sync db: ' + err.message);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
