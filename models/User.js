const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Please provide a phone number'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['customer', 'restaurant', 'driver', 'admin'],
        default: 'customer'
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },

    // Customer specific fields
    addresses: [{
        label: String,
        address: String,
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number] // [longitude, latitude]
        },
        isDefault: { type: Boolean, default: false }
    }],

    // Restaurant specific fields
    restaurantProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
    },

    // Driver specific fields
    driverProfile: {
        vehicleType: { type: String, enum: ['bike', 'scooter', 'car'] },
        vehicleNumber: String,
        licenseNumber: String,
        isAvailable: { type: Boolean, default: false },
        currentLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number]
        },
        rating: { type: Number },
        totalDeliveries: { type: Number }
    },

    // Notification settings
    fcmToken: String,
    notificationsEnabled: {
        type: Boolean,
        default: true
    },

    // Account status
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,

    // Password reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create geospatial index for location-based queries
userSchema.index({ 'addresses.location': '2dsphere' });
userSchema.index({ 'driverProfile.currentLocation': '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    // Initialize driver profile defaults if role is driver
    if (this.role === 'driver' && !this.driverProfile) {
        this.driverProfile = {
            rating: 5.0,
            totalDeliveries: 0,
            isAvailable: false
        };
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT (to be used with jwt service)
userSchema.methods.getSignedJwtToken = function () {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

module.exports = mongoose.model('User', userSchema);
