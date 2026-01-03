const Order = require('../models/Order');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');

// Helper function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

// @desc    Get available orders for drivers
// @route   GET /api/delivery/available
// @access  Private (driver)
exports.getAvailableOrders = async (req, res, next) => {
    try {
        const driver = await User.findById(req.user.id);

        if (!driver.driverProfile.isAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Please mark yourself as available first'
            });
        }

        // Get driver's current location
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Current location is required'
            });
        }

        // Find orders ready for pickup within 10km
        const orders = await Order.find({
            status: 'ready',
            driver: null // Not yet assigned
        })
            .populate('restaurant', 'name address location')
            .populate('customer', 'name phone')
            .limit(20);

        // Calculate distance and filter
        const ordersWithDistance = orders
            .map(order => {
                const distance = calculateDistance(
                    parseFloat(lat),
                    parseFloat(lng),
                    order.restaurant.location.coordinates[1],
                    order.restaurant.location.coordinates[0]
                );
                return { ...order.toObject(), distance };
            })
            .filter(order => order.distance <= 10)
            .sort((a, b) => a.distance - b.distance);

        res.status(200).json({
            success: true,
            count: ordersWithDistance.length,
            data: ordersWithDistance
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Accept order for delivery
// @route   POST /api/delivery/accept/:orderId
// @access  Private (driver)
exports.acceptOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: 'Order is not ready for pickup'
            });
        }

        if (order.driver) {
            return res.status(400).json({
                success: false,
                message: 'Order already assigned to another driver'
            });
        }

        // Assign driver
        order.driver = req.user.id;
        order.status = 'assigned';
        await order.save();

        // Update driver's availability
        await User.findByIdAndUpdate(req.user.id, {
            'driverProfile.isAvailable': false
        });

        // Emit real-time event
        const io = req.app.get('io');
        io.to(`order:${order._id}`).emit('driverAssigned', {
            driverId: req.user.id,
            driverName: req.user.name,
            driverPhone: req.user.phone
        });

        res.status(200).json({
            success: true,
            message: 'Order accepted successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark order as picked up
// @route   PUT /api/delivery/:orderId/pickup
// @access  Private (driver)
exports.pickupOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.driver.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (order.status !== 'assigned') {
            return res.status(400).json({
                success: false,
                message: 'Order status invalid for pickup'
            });
        }

        order.status = 'picked-up';
        order.pickedUpAt = new Date();
        await order.save();

        // Emit real-time event
        const io = req.app.get('io');
        io.to(`order:${order._id}`).emit('orderPickedUp', {
            timestamp: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Order marked as picked up',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update driver location
// @route   PUT /api/delivery/location
// @access  Private (driver)
exports.updateLocation = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        await User.findByIdAndUpdate(req.user.id, {
            'driverProfile.currentLocation': {
                type: 'Point',
                coordinates: [longitude, latitude]
            }
        });

        // Find active delivery
        const activeOrder = await Order.findOne({
            driver: req.user.id,
            status: { $in: ['picked-up', 'on-the-way'] }
        });

        if (activeOrder) {
            // Emit location to order room
            const io = req.app.get('io');
            io.to(`order:${activeOrder._id}`).emit('driverLocation', {
                latitude,
                longitude,
                timestamp: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: 'Location updated'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Complete delivery
// @route   PUT /api/delivery/:orderId/complete
// @access  Private (driver)
exports.completeDelivery = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.driver.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        order.status = 'delivered';
        order.deliveredAt = new Date();
        order.payment.status = 'completed';
        order.payment.paidAt = new Date();
        await order.save();

        // Update driver stats and make available again
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { 'driverProfile.totalDeliveries': 1 },
            'driverProfile.isAvailable': true
        });

        // Update restaurant stats
        await Restaurant.findByIdAndUpdate(order.restaurant, {
            $inc: {
                'stats.totalOrders': 1,
                'stats.totalRevenue': order.pricing.restaurantEarnings
            }
        });

        // Emit real-time event
        const io = req.app.get('io');
        io.to(`order:${order._id}`).emit('orderDelivered', {
            timestamp: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Delivery completed successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get driver earnings
// @route   GET /api/delivery/earnings
// @access  Private (driver)
exports.getEarnings = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const query = {
            driver: req.user.id,
            status: 'delivered'
        };

        if (startDate && endDate) {
            query.deliveredAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query);

        const totalEarnings = orders.reduce((sum, order) => sum + order.pricing.driverEarnings, 0);
        const totalDeliveries = orders.length;
        const averageEarning = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

        res.status(200).json({
            success: true,
            data: {
                totalEarnings,
                totalDeliveries,
                averageEarning,
                orders
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle driver availability
// @route   PUT /api/delivery/toggle-availability
// @access  Private (driver)
exports.toggleAvailability = async (req, res, next) => {
    try {
        const driver = await User.findById(req.user.id);

        driver.driverProfile.isAvailable = !driver.driverProfile.isAvailable;
        await driver.save();

        res.status(200).json({
            success: true,
            message: `You are now ${driver.driverProfile.isAvailable ? 'available' : 'unavailable'}`,
            data: { isAvailable: driver.driverProfile.isAvailable }
        });
    } catch (error) {
        next(error);
    }
};
