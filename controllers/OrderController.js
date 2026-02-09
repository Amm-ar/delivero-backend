const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

// Helper function to calculate pricing
const calculatePricing = (items, deliveryFee, isSurgeTime = false) => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const serviceFee = subtotal * parseFloat(process.env.SERVICE_FEE_RATE || 0.08);
    const surgeMultiplier = isSurgeTime ? parseFloat(process.env.SURGE_MULTIPLIER || 1.5) : 1.0;
    const adjustedDeliveryFee = deliveryFee * surgeMultiplier;
    const total = subtotal + adjustedDeliveryFee + serviceFee;

    // Calculate commission
    const commissionRate = parseFloat(process.env.COMMISSION_RATE || 0.20);
    const platformCommission = subtotal * commissionRate + serviceFee;
    const restaurantEarnings = subtotal - (subtotal * commissionRate);
    const driverEarnings = adjustedDeliveryFee;

    return {
        subtotal,
        deliveryFee: adjustedDeliveryFee,
        serviceFee,
        tax: 0,
        discount: 0,
        total,
        platformCommission,
        restaurantEarnings,
        driverEarnings
    };
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (customer)
exports.createOrder = async (req, res, next) => {
    try {
        const {
            restaurant: restaurantId,
            items,
            deliveryAddress,
            paymentMethod,
            isSurgeTime
        } = req.body;

        // Verify restaurant exists and is active
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !restaurant.isActive || !restaurant.isOpen) {
            return res.status(400).json({
                success: false,
                message: 'Restaurant is not available for orders'
            });
        }

        // Validate payment method
        const validPaymentMethods = ['card', 'cash', 'wallet'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `Invalid payment method: ${paymentMethod}. Valid methods are: ${validPaymentMethods.join(', ')}`
            });
        }

        // Validate and calculate item prices
        const orderItems = [];
        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem || !menuItem.isAvailable) {
                return res.status(400).json({
                    success: false,
                    message: `Menu item ${item.menuItem} is not available`
                });
            }

            // Calculate item subtotal including customizations
            let itemPrice = menuItem.price * item.quantity;
            if (item.customizations) {
                for (const custom of item.customizations) {
                    for (const option of custom.selectedOptions) {
                        itemPrice += option.price * item.quantity;
                    }
                }
            }

            orderItems.push({
                menuItem: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                customizations: item.customizations || [],
                specialInstructions: item.specialInstructions || '',
                subtotal: itemPrice
            });
        }

        // Calculate pricing
        const pricing = calculatePricing(
            orderItems,
            restaurant.deliveryFee,
            isSurgeTime
        );

        // Check minimum order amount
        if (pricing.subtotal < restaurant.minimumOrder) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount is $${restaurant.minimumOrder}`
            });
        }

        // Create order
        const order = await Order.create({
            customer: req.user.id,
            restaurant: restaurantId,
            items: orderItems,
            pricing,
            deliveryAddress,
            customerPhone: req.user.phone,
            customerName: req.user.name,
            payment: {
                method: paymentMethod,
                status: paymentMethod === 'cash' ? 'pending' : 'pending'
            },
            isSurgeTime: isSurgeTime || false,
            surgeMultiplier: isSurgeTime ? parseFloat(process.env.SURGE_MULTIPLIER) : 1.0,
            estimatedDeliveryTime: new Date(Date.now() + restaurant.deliveryTime.max * 60 * 1000)
        });

        // Emit real-time event to restaurant
        const io = req.app.get('io');
        io.to(`user:${restaurant.owner}`).emit('newOrder', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            items: orderItems.length,
            total: pricing.total
        });

        // Update menu item popularity
        for (const item of orderItems) {
            await MenuItem.findByIdAndUpdate(item.menuItem, {
                $inc: { totalOrders: item.quantity, popularity: item.quantity }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all orders (with filters)
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        let query = {};

        // Role-based filtering
        if (req.user.role === 'customer') {
            query.customer = req.user.id;
        } else if (req.user.role === 'restaurant') {
            const restaurant = await Restaurant.findOne({ owner: req.user.id });
            if (restaurant) {
                query.restaurant = restaurant._id;
            }
        } else if (req.user.role === 'driver') {
            query.driver = req.user.id;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .populate('customer', 'name phone avatar')
            .populate('restaurant', 'name logo phone')
            .populate('driver', 'name phone')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'name phone avatar')
            .populate('restaurant', 'name logo phone address')
            .populate('driver', 'name phone avatar')
            .populate('items.menuItem', 'name image');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check authorization
        const isAuthorized =
            order.customer.toString() === req.user.id ||
            (req.user.restaurantProfile && order.restaurant._id.toString() === req.user.restaurantProfile.toString()) ||
            (order.driver && order.driver._id.toString() === req.user.id) ||
            req.user.role === 'admin';

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this order'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (restaurant/driver)
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id)
            .populate('restaurant')
            .populate('customer', 'fcmToken');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Authorization checks based on status
        const restaurant = await Restaurant.findById(order.restaurant._id);

        if (['confirmed', 'preparing', 'ready', 'rejected'].includes(status)) {
            if (!restaurant || restaurant.owner.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized'
                });
            }
        }

        if (['picked-up', 'on-the-way', 'delivered'].includes(status)) {
            if (!order.driver || order.driver.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized'
                });
            }
        }

        // Update status
        order.status = status;

        // Update timestamps
        if (status === 'confirmed') order.acceptedAt = new Date();
        if (status === 'ready') order.preparedAt = new Date();
        if (status === 'picked-up') order.pickedUpAt = new Date();
        if (status === 'delivered') {
            order.deliveredAt = new Date();
            order.payment.status = 'completed';
            order.payment.paidAt = new Date();
        }

        await order.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to(`order:${order._id}`).emit('orderStatusUpdate', {
            orderId: order._id,
            status: order.status,
            timestamp: new Date()
        });

        // Notify customer
        io.to(`user:${order.customer}`).emit('orderUpdate', {
            orderId: order._id,
            status: order.status
        });

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private (customer/restaurant)
exports.cancelOrder = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const order = await Order.findById(req.params.id).populate('restaurant');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Only allow cancellation before delivery
        if (['delivered', 'cancelled'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled'
            });
        }

        // Check authorization
        const restaurant = await Restaurant.findById(order.restaurant._id);
        const isCustomer = order.customer.toString() === req.user.id;
        const isRestaurant = restaurant && restaurant.owner.toString() === req.user.id;

        if (!isCustomer && !isRestaurant && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this order'
            });
        }

        order.status = 'cancelled';
        order.cancellation = {
            reason,
            cancelledBy: isCustomer ? 'customer' : isRestaurant ? 'restaurant' : 'admin',
            cancelledAt: new Date()
        };

        await order.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to(`order:${order._id}`).emit('orderCancelled', {
            orderId: order._id,
            reason
        });

        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};
