const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const faceRecognitionService = require('./services/faceRecognitionService');

// Route files
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const unknownRoutes = require('./routes/unknownRoutes');
const iotRoutes = require('./routes/iotRoutes');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Standard Middlewares
app.use(cors());
// Set JSON limit to 50MB to accommodate base64 webcam photos & face descriptors
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Static folders
app.use('/uploads', express.static(uploadsPath));

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/students/import', require('./routes/importRoutes'));
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/unknown', unknownRoutes);
app.use('/api/iot', iotRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Smart Face Identity Attendance System API!',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Error Handler:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  
  // Proactively boot/load the Face API models on backend startup
  try {
    await faceRecognitionService.initializeFaceRecognition();
  } catch (err) {
    console.error('⚠️ Model load failed during server startup. Ensure model downloader is run:', err.message);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});
