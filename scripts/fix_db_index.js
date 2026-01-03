const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Index Fix Script');

// 1. Load Environment Variables
console.log('📂 Loading .env file...');
const paths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '../.env'),
    'c:\\Users\\Ammar\\Documents\\delivero\\backend\\.env'
];

let envLoaded = false;
for (const p of paths) {
    if (fs.existsSync(p)) {
        console.log(`   Found .env at: ${p}`);
        require('dotenv').config({ path: p });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.error('❌ CRITICAL: No .env file found in any expected location.');
    // Don't exit yet, might be in process.env already
}

const uri = process.env.MONGODB_URI;
console.log(`🔑 MONGODB_URI status: ${uri ? 'DEFINED' : 'MISSING'}`);

if (!uri) {
    console.error('❌ Cannot proceed without MONGODB_URI');
    process.exit(1);
}

// 2. Fix Indexes
const fixIndexes = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        // Check if User model loads
        console.log('📚 Loading User model...');
        const User = require('../models/User');

        console.log('🔍 Listing current indexes...');
        const indexes = await User.collection.indexes();
        console.log('Current Indexes:', JSON.stringify(indexes.map(i => i.name), null, 2));

        const invalidIndexName = 'driverProfile.currentLocation_2dsphere';
        const indexExists = indexes.some(i => i.name === invalidIndexName);

        if (indexExists) {
            console.log(`🗑️ Found problematic index: ${invalidIndexName}. Dropping it...`);
            await User.collection.dropIndex(invalidIndexName);
            console.log('✅ Index dropped successfully!');
        } else {
            console.log(`ℹ️ Index ${invalidIndexName} not found. It might have been already dropped or never created.`);
        }

        console.log('👋 Disconnecting...');
        await mongoose.disconnect();
        console.log('🏁 Script finished successfully');
        process.exit(0);

    } catch (error) {
        console.error('💥 ERROR in fixIndexes:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

fixIndexes().catch(err => {
    console.error('💥 Unhandled rejection:', err);
    process.exit(1);
});
