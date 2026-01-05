const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide item name'],
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: 'default-food.png'
    },

    // Pricing
    price: {
        type: Number,
        required: [true, 'Please provide price'],
        min: 0
    },
    originalPrice: {
        type: Number // For showing discounts
    },

    // Categories
    category: {
        type: String,
        required: true,
        trim: true
    },

    // Dietary & Preferences
    tags: [{
        type: String,
        enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher', 'spicy', 'popular', 'new']
    }],

    // Customizations
    customizations: [{
        name: { type: String, required: true }, // e.g., "Size", "Extras"
        type: {
            type: String,
            enum: ['single', 'multiple'],
            default: 'single'
        },
        required: { type: Boolean, default: false },
        options: [{
            name: String, // e.g., "Large", "Add Cheese"
            price: { type: Number, default: 0 }
        }]
    }],

    // Availability
    isAvailable: {
        type: Boolean,
        default: true
    },
    availableFrom: String, // "09:00"
    availableUntil: String, // "22:00"

    // Nutrition (optional)
    nutrition: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number
    },

    // Preparation
    preparationTime: {
        type: Number,
        default: 15 // minutes
    },

    // Stats
    popularity: {
        type: Number,
        default: 0
    },
    totalOrders: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
menuItemSchema.index({ restaurant: 1, category: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ tags: 1 });
menuItemSchema.index({ popularity: -1 });

// Calculate discount percentage
menuItemSchema.virtual('discountPercentage').get(function () {
    if (this.originalPrice && this.originalPrice > this.price) {
        return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    }
    return 0;
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
