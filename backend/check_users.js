const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = "mongodb+srv://mpbhavana2006_db_user:AxurtuWkn3AC9rS9@faceattendence.klftgvn.mongodb.net/face_attendance_system?retryWrites=true&w=majority&appName=faceattendence";

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: { type: String, select: true }, // Select true for debug
  role: String
}, { collection: 'users' });

const User = mongoose.model('User', UserSchema);

async function main() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB!");
  
  const users = await User.find({});
  console.log(`Found ${users.length} users:`);
  
  for (const u of users) {
    console.log(`- Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, HashedPass: ${u.password}`);
    // Test match
    const isMatchAdmin = await bcrypt.compare('admin123', u.password);
    const isMatchTeacher = await bcrypt.compare('teacher123', u.password);
    console.log(`  Matches 'admin123': ${isMatchAdmin}`);
    console.log(`  Matches 'teacher123': ${isMatchTeacher}`);
  }
  
  mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
