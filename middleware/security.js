const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const router = express.Router();

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message: message || 'Too many requests, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// General API rate limiting
const generalLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again after 15 minutes'
);

// Strict rate limiting for auth endpoints
const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 auth requests per windowMs
    'Too many authentication attempts, please try again after 15 minutes'
);

// Password reset rate limiting
const passwordResetLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // limit each IP to 3 password reset requests per hour
    'Too many password reset attempts, please try again after an hour'
);

// Apply general rate limiting to all API routes
router.use('/api', generalLimiter);

// Apply strict rate limiting to auth routes
router.use('/api/auth', authLimiter);

// Apply password reset rate limiting
router.use('/api/auth/forgot-password', passwordResetLimiter);
router.use('/api/auth/reset-password', passwordResetLimiter);

// Enhanced CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In production, specify allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : [
                'http://localhost:3000',
                'http://localhost:8080',
                'https://delivero-backend-gay2.onrender.com'
            ];
            
        if (process.env.NODE_ENV === 'production') {
            if (!allowedOrigins.includes(origin)) {
                return callback(new Error('Not allowed by CORS'));
            }
        }
        
        callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Enhanced Helmet configuration for production
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.stripe.com", "wss://delivero-backend-gay2.onrender.com"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
};

// Security middleware configuration
const configureSecurity = (app) => {
    // Apply Helmet with custom configuration
    if (process.env.NODE_ENV === 'production') {
        app.use(helmet(helmetConfig));
    } else {
        app.use(helmet());
    }
    
    // Apply CORS
    app.use(cors(corsOptions));
    
    // Apply rate limiting
    app.use(router);
};

module.exports = {
    configureSecurity,
    generalLimiter,
    authLimiter,
    passwordResetLimiter,
    corsOptions
};
