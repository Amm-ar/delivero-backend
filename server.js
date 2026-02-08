require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketio = require('socket.io');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { configureSecurity } = require('./middleware/security');
const { logger, requestLogger } = require('./config/logger');
const fs = require('fs');

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Create HTTP server and Socket.io
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
    }
});

// Make io accessible to routes
app.set('io', io);

// Apply enhanced security middleware
configureSecurity(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Request logging
app.use(requestLogger);

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Static folder for uploads
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/restaurants/:restaurantId/menu', require('./routes/menu'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Welcome route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Delivero API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            restaurants: '/api/restaurants',
            menu: '/api/menu',
            orders: '/api/orders',
            delivery: '/api/delivery',
            payments: '/api/payments',
            admin: '/api/admin'
        }
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    // Join room for user-specific updates
    socket.on('join', (userId) => {
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId} joined their room`);
    });

    // Join room for order-specific updates
    socket.on('joinOrder', (orderId) => {
        socket.join(`order:${orderId}`);
        console.log(`📦 Joined order room: ${orderId}`);
    });

    // Driver location updates
    socket.on('updateLocation', (data) => {
        // Broadcast to order room
        socket.to(`order:${data.orderId}`).emit('driverLocation', {
            location: data.location,
            timestamp: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Error handler (must be last)
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 5000;

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`
      ╔════════════════════════════════════════╗
      ║                                        ║
      ║     🚀 DELIVERO API SERVER             ║
      ║                                        ║
      ║     Environment: ${process.env.NODE_ENV || 'development'}               ║
      ║     Port: ${PORT}                           ║
      ║     Socket.io: ✅ Enabled               ║
      ║                                        ║
      ║     waiting for database...            ║
      ╚════════════════════════════════════════╝
    `);
    });
}

module.exports = app;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});
