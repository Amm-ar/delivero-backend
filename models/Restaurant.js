const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide restaurant name'],
        trim: true
    },
    description: {
        type: String,
        // required: [true, 'Please provide restaurant description']
    },
    logo: {
        type: String,
        default: 'default-restaurant.png'
    },
    coverImage: {
        type: String,
        default: 'default-cover.png'
    },

    // Contact & Location
    phone: {
        type: String,
        // required: true
    },
    email: String,
    address: {
        type: String,
        // required: true
    },
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] } // Optional for initial signup
    },

    // Business Info
    cuisine: [{
        type: String,
        // required: true
    }],
    menuCategories: [{
        type: String
    }],
    priceRange: {
        type: String,
        enum: ['$', '$$', '$$$', '$$$$'],
        default: '$$'
    },

    // Operating Hours
    operatingHours: [{
        day: {
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        open: String, // "09:00"
        close: String, // "22:00"
        isOpen: { type: Boolean, default: true }
    }],

    // Delivery Settings
    deliveryRadius: {
        type: Number,
        default: 5, // km
        required: true
    },
    minimumOrder: {
        type: Number,
        default: 10,
        required: true
    },
    deliveryTime: {
        min: { type: Number, default: 30 },
        max: { type: Number, default: 45 }
    },
    deliveryFee: {
        type: Number,
        default: 3.00
    },
    freeDeliveryAbove: {
        type: Number,
        default: 50
    },

    // Ratings & Reviews
    rating: {
        type: Number,
        default: 5.0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    },

    // Status & Verification
    isActive: {
        type: Boolean,
        default: true // Auto-active for dev
    },
    isVerified: {
        type: Boolean,
        default: true
    },
    isOpen: {
        type: Boolean,
        default: true
    },

    // Subscription & Monetization
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'premium'],
            default: 'free'
        },
        startDate: Date,
        endDate: Date,
        features: {
            featuredListing: { type: Boolean, default: false },
            analytics: { type: Boolean, default: false },
            prioritySupport: { type: Boolean, default: false }
        }
    },

    // Commission
    commissionRate: {
        type: Number,
        default: 0.20 // 20%
    },

    // Statistics
    stats: {
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        averageOrderValue: { type: Number, default: 0 }
    },

    // Documents (for verification)
    documents: {
        businessLicense: String,
        foodLicense: String,
        taxId: String
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Geospatial index for location-based queries
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ isActive: 1, isOpen: 1 });

// Virtual populate for menu items
restaurantSchema.virtual('menuItems', {
    ref: 'MenuItem',
    localField: '_id',
    foreignField: 'restaurant'
});

// Method to check if restaurant is currently open
restaurantSchema.methods.isCurrentlyOpen = function () {
    if (!this.isOpen || !this.isActive) return false;

    const now = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todayHours = this.operatingHours.find(h => h.day === dayName);
    if (!todayHours || !todayHours.isOpen) return false;

    return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

module.exports = mongoose.model('Restaurant', restaurantSchema);
