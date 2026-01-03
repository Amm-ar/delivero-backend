const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder
} = require('../controllers/OrderController');
const { protect, authorize } = require('../middleware/auth');

// All order routes require authentication
router.use(protect);

// Customer routes
router.post('/', authorize('customer'), createOrder);
router.get('/', getOrders); // All roles can get their orders
router.get('/:id', getOrder);

// Restaurant & Driver routes
router.put('/:id/status', authorize('restaurant', 'driver'), updateOrderStatus);

// Cancel order (customer, restaurant, admin)
router.put('/:id/cancel', authorize('customer', 'restaurant', 'admin'), cancelOrder);

module.exports = router;
