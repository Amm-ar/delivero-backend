const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

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

        restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: restaurant
        });
    } catch (error) {
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
