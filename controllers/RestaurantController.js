const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// @desc    Get all restaurants (with filters)
// @route   GET /api/restaurants
// @access  Public
exports.getRestaurants = async (req, res, next) => {
    try {
        const {
            cuisine,
            priceRange,
            search,
            lat,
            lng,
            radius = 10, // km
            sort = '-rating',
            page = 1,
            limit = 20
        } = req.query;

        // Build query
        const query = { isActive: true };

        // Filter by cuisine
        if (cuisine) {
            query.cuisine = { $in: cuisine.split(',') };
        }

        // Filter by price range
        if (priceRange) {
            query.priceRange = { $in: priceRange.split(',') };
        }

        // Search by name or description
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by location (geospatial query)
        if (lat && lng) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
                }
            };
        }

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const restaurants = await Restaurant.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-documents -stats');

        const total = await Restaurant.countDocuments(query);

        res.status(200).json({
            success: true,
            count: restaurants.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: restaurants
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
// @access  Public
exports.getRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id)
            .populate('owner', 'name email phone')
            .populate('menuItems');

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        res.status(200).json({
            success: true,
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create restaurant
// @route   POST /api/restaurants
// @access  Private (restaurant role)
exports.createRestaurant = async (req, res, next) => {
    try {
        console.log('Creating restaurant for user:', req.user.id);
        console.log('Request body:', req.body);

        // Add user as owner
        req.body.owner = req.user.id;

        // Check if user already has a restaurant
        const existingRestaurant = await Restaurant.findOne({ owner: req.user.id });
        if (existingRestaurant) {
            return res.status(400).json({
                success: false,
                message: 'You already have a restaurant registered'
            });
        }

        const restaurant = await Restaurant.create(req.body);

        // Update user's restaurant profile reference
        await require('../models/User').findByIdAndUpdate(req.user.id, {
            restaurantProfile: restaurant._id
        });

        res.status(201).json({
            success: true,
            message: 'Restaurant created successfully. Awaiting admin approval.',
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
// @access  Private (owner or admin)
exports.updateRestaurant = async (req, res, next) => {
    try {
        console.log('Update restaurant - Restaurant ID:', req.params.id);
        console.log('Update restaurant - Request body:', JSON.stringify(req.body, null, 2));
        console.log('Update restaurant - User ID:', req.user.id);
        console.log('Update restaurant - User role:', req.user.role);

        let restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Check ownership
        if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this restaurant'
            });
        }

        // Don't allow owner to change approval status
        if (req.user.role !== 'admin') {
            delete req.body.isActive;
            delete req.body.isVerified;
            delete req.body.commissionRate;
        }

        // Remove null or undefined values to avoid validation issues
        const updateData = {};
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== null && req.body[key] !== undefined) {
                updateData[key] = req.body[key];
            }
        });

        console.log('Update restaurant - Data to update:', JSON.stringify(updateData, null, 2));

        restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        console.log('Update restaurant - Success, updated restaurant:', restaurant.name);

        res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: restaurant
        });
    } catch (error) {
        console.error('Update restaurant - Error:', error);
        console.error('Update restaurant - Error name:', error.name);
        console.error('Update restaurant - Error message:', error.message);
        if (error.errors) {
            console.error('Update restaurant - Validation errors:', error.errors);
        }
        next(error);
    }
};

// @desc    Delete restaurant
// @route   DELETE /api/restaurants/:id
// @access  Private (owner or admin)
exports.deleteRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Check ownership
        if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this restaurant'
            });
        }

        await restaurant.deleteOne();

        // Delete associated menu items
        await MenuItem.deleteMany({ restaurant: req.params.id });

        res.status(200).json({
            success: true,
            message: 'Restaurant deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle restaurant open/close status
// @route   PUT /api/restaurants/:id/toggle-status
// @access  Private (owner)
exports.toggleStatus = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Check ownership
        if (restaurant.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        restaurant.isOpen = !restaurant.isOpen;
        await restaurant.save();

        res.status(200).json({
            success: true,
            message: `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`,
            data: { isOpen: restaurant.isOpen }
        });
    } catch (error) {
        next(error);
    }
};
// @desc    Get restaurant analytics
// @route   GET /api/restaurants/:id/analytics
// @access  Private (restaurant/admin)
exports.getAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const restaurantId = req.params.id;

        const dateFilter = { restaurant: mongoose.Types.ObjectId(restaurantId) };
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

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
                    totalRevenue: { $sum: '$pricing.restaurantEarnings' },
                    averageOrderValue: { $avg: '$pricing.restaurantEarnings' }
                }
            }
        ]);

        const revenue = revenueStats[0] || {
            totalRevenue: 0,
            averageOrderValue: 0
        };

        // Top selling items
        const topItems = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.menuItem',
                    name: { $first: '$items.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        // Orders by day (for chart)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyStats = await Order.aggregate([
            {
                $match: {
                    restaurant: mongoose.Types.ObjectId(restaurantId),
                    createdAt: { $gte: last7Days }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$pricing.restaurantEarnings' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalOrders,
                    completedOrders,
                    cancelledOrders,
                    totalRevenue: revenue.totalRevenue,
                    averageOrderValue: revenue.averageOrderValue
                },
                topItems,
                dailyStats
            }
        });
    } catch (error) {
        next(error);
    }
};
