const express = require('express');
const router = express.Router();
const {
    getAvailableOrders,
    acceptOrder,
    pickupOrder,
    updateLocation,
    completeDelivery,
    getEarnings,
    toggleAvailability
} = require('../controllers/DeliveryController');
const { protect, authorize } = require('../middleware/auth');

// All routes require driver authentication
router.use(protect);
router.use(authorize('driver'));

router.get('/available', getAvailableOrders);
router.post('/accept/:orderId', acceptOrder);
router.put('/:orderId/pickup', pickupOrder);
router.put('/location', updateLocation);
router.put('/:orderId/complete', completeDelivery);
router.get('/earnings', getEarnings);
router.put('/toggle-availability', toggleAvailability);

module.exports = router;
