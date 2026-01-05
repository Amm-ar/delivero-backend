const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        const adminEmail = 'admin@delivero.com';
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Admin user already exists.');
        } else {
            const admin = await User.create({
                name: 'Delivero Admin',
                email: adminEmail,
                phone: '1234567890',
                password: 'admin123456',
                role: 'admin',
                isActive: true,
                isVerified: true
            });
            console.log('Default admin user created successfully:', admin.email);
        }

        process.exit();
    } catch (err) {
        console.error('Error seeding admin user:', err);
        process.exit(1);
    }
};

seedAdmin();
