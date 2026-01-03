const express = require('express');
const router = express.Router({ mergeParams: true }); // To access restaurantId from parent route
const {
    getMenuItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability
} = require('../controllers/MenuController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getMenuItems); // GET /api/restaurants/:restaurantId/menu
router.get('/:id', getMenuItem); // GET /api/menu/:id

// Protected routes - Restaurant owners
router.post('/', protect, authorize('restaurant'), createMenuItem);
router.put('/:id', protect, authorize('restaurant'), updateMenuItem);
router.delete('/:id', protect, authorize('restaurant'), deleteMenuItem);
router.put('/:id/toggle', protect, authorize('restaurant'), toggleAvailability);

module.exports = router;
