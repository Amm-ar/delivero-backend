const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');

// @desc    Get platform statistics
// @route   GET /api/admin/stats
// @access  Private (admin)
exports.getStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // User statistics
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const totalRestaurants = await Restaurant.countDocuments();
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const activeDrivers = await User.countDocuments({
            role: 'driver',
            'driverProfile.isAvailable': true
        });

        // Order statistics
        const totalOrders = await Order.countDocuments(dateFilter);
        const completedOrders = await Order.countDocuments({
            ...dateFilter,
            status: 'delivered'
        });
        const cancelledOrders = await Order.countDocuments({
            ...dateFilter,
            status: 'cancelled'
        });
        const activeOrders = await Order.countDocuments({
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked-up', 'on-the-way'] }
        });

        // Revenue statistics
        const revenueStats = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'delivered'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$pricing.total' },
                    platformCommission: { $sum: '$pricing.platformCommission' },
                    restaurantEarnings: { $sum: '$pricing.restaurantEarnings' },
                    driverEarnings: { $sum: '$pricing.driverEarnings' },
                    averageOrderValue: { $avg: '$pricing.total' }
                }
            }
        ]);

        const revenue = revenueStats[0] || {
            totalRevenue: 0,
            platformCommission: 0,
            restaurantEarnings: 0,
            driverEarnings: 0,
            averageOrderValue: 0
        };

        // Orders by status
        const ordersByStatus = await Order.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: {
                    totalCustomers,
                    totalRestaurants,
                    totalDrivers,
                    activeDrivers
                },
                orders: {
                    total: totalOrders,
                    completed: completedOrders,
                    cancelled: cancelledOrders,
                    active: activeOrders,
                    byStatus: ordersByStatus
                },
                revenue
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users with filters
// @route   GET /api/admin/users
// @access  Private (admin)
exports.getUsers = async (req, res, next) => {
    try {
        const { role, search, page = 1, limit = 20 } = req.query;

        const query = {};

        if (role) {
            query.role = role;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const users = await User.find(query)
            .select('-password')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: users
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve/reject restaurant
// @route   PUT /api/admin/restaurants/:id/verify
// @access  Private (admin)
exports.verifyRestaurant = async (req, res, next) => {
    try {
        const { isActive, isVerified } = req.body;

        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            { isActive, isVerified },
            { new: true, runValidators: true }
        );

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Restaurant ${isActive ? 'approved' : 'rejected'}`,
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user role or status
// @route   PUT /api/admin/users/:id
// @access  Private (admin)
exports.updateUser = async (req, res, next) => {
    try {
        const { isActive, role } = req.body;

        const updateData = {};
        if (typeof isActive !== 'undefined') updateData.isActive = isActive;
        if (role) updateData.role = role;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get revenue analytics
// @route   GET /api/admin/analytics/revenue
// @access  Private (admin)
exports.getRevenueAnalytics = async (req, res, next) => {
    try {
        const { period = 'week' } = req.query; // week, month, year

        let groupBy;
        let dateRange;

        switch (period) {
            case 'week':
                groupBy = { $dayOfWeek: '$createdAt' };
                dateRange = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                groupBy = { $dayOfMonth: '$createdAt' };
                dateRange = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                groupBy = { $month: '$createdAt' };
                dateRange = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                groupBy = { $dayOfWeek: '$createdAt' };
                dateRange = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }

        const analytics = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange },
                    status: 'delivered'
                }
            },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$pricing.platformCommission' },
                    orders: { $sum: 1 },
                    avgOrderValue: { $avg: '$pricing.total' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            period,
            data: analytics
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/admin/users/:id
// @access  Private (admin)
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};
