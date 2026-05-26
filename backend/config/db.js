const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    console.log(`
========================================================================
⚠️  MONGODB IS NOT CURRENTLY CONNECTED OR NOT RUNNING LOCALLY!
========================================================================
Please complete one of the following setups:

1. Running Local MongoDB:
   - Verify MongoDB Community Server is installed.
   - Run the command: Net Start MongoDB (in Administrator cmd)
   - Or start the Service 'MongoDB Server (MongoDB)' in services.msc.

2. Using MongoDB Atlas (Cloud):
   - Create a free cluster at https://www.mongodb.com/cloud/atlas
   - Copy your connection string and paste it into:
     D:\\Bhavana MP\\SIC_IOT\\backend\\.env
   - Update the line:
     MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/face_attendance
========================================================================
    `);
    process.exit(1);
  }
};

module.exports = connectDB;
