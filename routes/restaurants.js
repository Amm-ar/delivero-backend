const express = require('express');
const router = express.Router();
const {
    getRestaurants,
    getRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    toggleStatus,
    getAnalytics
} = require('../controllers/RestaurantController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Public routes
router.get('/', optionalAuth, getRestaurants);
router.get('/:id', getRestaurant);

// Protected routes - Restaurant owners
router.post('/', protect, authorize('restaurant'), createRestaurant);
router.put('/:id', protect, authorize('restaurant', 'admin'), updateRestaurant);
router.delete('/:id', protect, authorize('restaurant', 'admin'), deleteRestaurant);
router.put('/:id/toggle-status', protect, authorize('restaurant'), toggleStatus);
router.get('/:id/analytics', protect, authorize('restaurant', 'admin'), getAnalytics);

module.exports = router;
