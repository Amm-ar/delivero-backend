const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');

// @desc    Get all menu items for a restaurant
// @route   GET /api/restaurants/:restaurantId/menu
// @access  Public
exports.getMenuItems = async (req, res, next) => {
    try {
        const { category, tags, search } = req.query;

        const query = {
            restaurant: req.params.restaurantId,
            isAvailable: true
        };

        if (category) {
            query.category = category;
        }

        if (tags) {
            query.tags = { $in: tags.split(',') };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const menuItems = await MenuItem.find(query)
            .sort('category -popularity');

        res.status(200).json({
            success: true,
            count: menuItems.length,
            data: menuItems
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
exports.getMenuItem = async (req, res, next) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id)
            .populate('restaurant', 'name logo deliveryTime');

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            data: menuItem
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create menu item
// @route   POST /api/restaurants/:restaurantId/menu
// @access  Private (restaurant owner)
exports.createMenuItem = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.restaurantId);

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
                message: 'Not authorized to add menu items to this restaurant'
            });
        }

        req.body.restaurant = req.params.restaurantId;
        const menuItem = await MenuItem.create(req.body);

        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            data: menuItem
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (restaurant owner)
exports.updateMenuItem = async (req, res, next) => {
    try {
        let menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        // Check ownership
        if (menuItem.restaurant.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this menu item'
            });
        }

        menuItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: 'Menu item updated successfully',
            data: menuItem
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (restaurant owner)
exports.deleteMenuItem = async (req, res, next) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        // Check ownership
        if (menuItem.restaurant.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this menu item'
            });
        }

        await menuItem.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Menu item deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle menu item availability
// @route   PUT /api/menu/:id/toggle
// @access  Private (restaurant owner)
exports.toggleAvailability = async (req, res, next) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        // Check ownership
        if (menuItem.restaurant.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        menuItem.isAvailable = !menuItem.isAvailable;
        await menuItem.save();

        res.status(200).json({
            success: true,
            message: `Menu item is now ${menuItem.isAvailable ? 'available' : 'unavailable'}`,
            data: { isAvailable: menuItem.isAvailable }
        });
    } catch (error) {
        next(error);
    }
};
