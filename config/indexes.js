const mongoose = require('mongoose');

// Create indexes for production performance
const createIndexes = async () => {
    try {
        const db = mongoose.connection.db;
        
        console.log('🔧 Creating production database indexes...');
        
        // Users collection indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ phone: 1 }, { unique: true });
        await db.collection('users').createIndex({ role: 1 });
        await db.collection('users').createIndex({ isActive: 1 });
        await db.collection('users').createIndex({ createdAt: -1 });
        await db.collection('users').createIndex({ 'addresses.location': '2dsphere' });
        await db.collection('users').createIndex({ 'driverProfile.currentLocation': '2dsphere' }, { sparse: true });
        await db.collection('users').createIndex({ 'driverProfile.isAvailable': 1 }, { sparse: true });
        
        // Restaurants collection indexes
        await db.collection('restaurants').createIndex({ owner: 1 });
        await db.collection('restaurants').createIndex({ cuisine: 1 });
        await db.collection('restaurants').createIndex({ priceRange: 1 });
        await db.collection('restaurants').createIndex({ isActive: 1 });
        await db.collection('restaurants').createIndex({ isVerified: 1 });
        await db.collection('restaurants').createIndex({ location: '2dsphere' });
        await db.collection('restaurants').createIndex({ name: 'text', description: 'text' });
        await db.collection('restaurants').createIndex({ createdAt: -1 });
        
        // MenuItems collection indexes
        await db.collection('menuitems').createIndex({ restaurant: 1 });
        await db.collection('menuitems').createIndex({ category: 1 });
        await db.collection('menuitems').createIndex({ isAvailable: 1 });
        await db.collection('menuitems').createIndex({ tags: 1 });
        await db.collection('menuitems').createIndex({ name: 'text', description: 'text' });
        await db.collection('menuitems').createIndex({ price: 1 });
        await db.collection('menuitems').createIndex({ popularity: -1 });
        
        // Orders collection indexes
        await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
        await db.collection('orders').createIndex({ customer: 1 });
        await db.collection('orders').createIndex({ restaurant: 1 });
        await db.collection('orders').createIndex({ driver: 1 }, { sparse: true });
        await db.collection('orders').createIndex({ status: 1 });
        await db.collection('orders').createIndex({ createdAt: -1 });
        await db.collection('orders').createIndex({ 'deliveryAddress.location': '2dsphere' });
        await db.collection('orders').createIndex({ customer: 1, createdAt: -1 });
        await db.collection('orders').createIndex({ restaurant: 1, status: 1 });
        await db.collection('orders').createIndex({ driver: 1, status: 1 }, { sparse: true });
        
        // Compound indexes for common queries
        await db.collection('orders').createIndex({ 
            status: 1, 
            createdAt: -1,
            'deliveryAddress.location': '2dsphere'
        });
        
        await db.collection('restaurants').createIndex({
            isActive: 1,
            isVerified: 1,
            location: '2dsphere'
        });
        
        await db.collection('menuitems').createIndex({
            restaurant: 1,
            isAvailable: 1,
            category: 1
        });
        
        console.log('✅ Production database indexes created successfully');
        
    } catch (error) {
        console.error('❌ Error creating database indexes:', error);
        throw error;
    }
};

module.exports = createIndexes;
