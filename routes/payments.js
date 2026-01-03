const express = require('express');
const router = express.Router();
const {
    createPaymentIntent,
    confirmPayment,
    processRefund,
    getPaymentHistory,
    stripeWebhook
} = require('../controllers/PaymentController');
const { protect, authorize } = require('../middleware/auth');

// Webhook (must be before body parser middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Protected routes
router.post('/create-intent', protect, createPaymentIntent);
router.post('/confirm', protect, confirmPayment);
router.get('/history', protect, getPaymentHistory);

// Admin only
router.post('/refund', protect, authorize('admin'), processRefund);

module.exports = router;
