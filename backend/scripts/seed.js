const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const seedUsers = async () => {
  try {
    console.log('📡 Connecting to MongoDB for seeding...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('📡 Connected successfully!');

    // Clear existing users
    await User.deleteMany();
    console.log('🗑️ Existing users cleared.');

    // Default Admin User
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@campus.edu',
      password: 'admin123',
      role: 'admin',
    });
    console.log(`👤 Admin User seeded: ${admin.email} (Password: admin123)`);

    // Default Teacher User
    const teacher = await User.create({
      name: 'Teacher Registrar',
      email: 'teacher@campus.edu',
      password: 'teacher123',
      role: 'teacher',
    });
    console.log(`👤 Teacher User seeded: ${teacher.email} (Password: teacher123)`);

    console.log('🎉 Seeding completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedUsers();
