const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true
    },

    // Parties involved
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Order Items
    items: [{
        menuItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true
        },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        customizations: [{
            name: String,
            selectedOptions: [{
                name: String,
                price: Number
            }]
        }],
        specialInstructions: String,
        subtotal: { type: Number, required: true }
    }],

    // Pricing Breakdown
    pricing: {
        subtotal: { type: Number, required: true },
        deliveryFee: { type: Number, required: true },
        serviceFee: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true },

        // Monetization tracking
        platformCommission: { type: Number, required: true },
        restaurantEarnings: { type: Number, required: true },
        driverEarnings: { type: Number, default: 0 }
    },

    // Delivery Details
    deliveryAddress: {
        label: String,
        address: { type: String, required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true }
        },
        instructions: String
    },

    // Contact
    customerPhone: { type: String, required: true },
    customerName: { type: String, required: true },

    // Order Status
    status: {
        type: String,
        enum: [
            'pending',        // Order placed, waiting for restaurant
            'confirmed',      // Restaurant confirmed
            'preparing',      // Food being prepared
            'ready',          // Ready for pickup
            'assigned',       // Driver assigned
            'picked-up',      // Driver picked up food
            'on-the-way',     // Out for delivery
            'delivered',      // Successfully delivered
            'cancelled',      // Cancelled
            'rejected'        // Rejected by restaurant
        ],
        default: 'pending'
    },

    // Status History
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }],

    // Payment
    payment: {
        method: {
            type: String,
            enum: ['card', 'cash', 'wallet'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paidAt: Date
    },

    // Timing
    estimatedDeliveryTime: Date,
    acceptedAt: Date,
    preparedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,

    // Ratings & Reviews
    rating: {
        food: { type: Number, min: 1, max: 5 },
        delivery: { type: Number, min: 1, max: 5 },
        overall: { type: Number, min: 1, max: 5 }
    },
    review: {
        comment: String,
        createdAt: Date
    },

    // Special Flags
    isSurgeTime: { type: Boolean, default: false },
    surgeMultiplier: { type: Number, default: 1.0 },
    promoCode: String,

    // Cancellation
    cancellation: {
        reason: String,
        cancelledBy: {
            type: String,
            enum: ['customer', 'restaurant', 'driver', 'admin']
        },
        cancelledAt: Date
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ driver: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Generate unique order number
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.orderNumber = `ORD-${timestamp}-${random}`;
    }
    next();
});

// Add status to history when status changes
orderSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date()
        });
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
