const express = require('express');
const router = express.Router();
const {
    getStats,
    getUsers,
    verifyRestaurant,
    approveRestaurant,
    updateUser,
    getRevenueAnalytics,
    deleteUser
} = require('../controllers/AdminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/restaurants/:id/verify', verifyRestaurant);
router.put('/restaurants/:id/approve', approveRestaurant);
router.get('/analytics/revenue', getRevenueAnalytics);

module.exports = router;
