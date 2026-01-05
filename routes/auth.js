const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
    register,
    login,
    getMe,
    updateDetails,
    updatePassword,
    updateFCMToken,
    logout
} = require('../controllers/AuthController');
const { protect } = require('../middleware/auth');

// Public routes
router.post(
    '/register',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('phone').trim().notEmpty().withMessage('Phone is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(['customer', 'restaurant', 'driver', 'admin']).withMessage('Invalid role')
    ],
    register
);

router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.put('/fcm-token', protect, updateFCMToken);
router.post('/logout', protect, logout);

module.exports = router;
