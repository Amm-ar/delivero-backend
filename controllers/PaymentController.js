const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private
exports.createPaymentIntent = async (req, res, next) => {
    try {
        const { amount, orderId } = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Amount and orderId are required'
            });
        }

        // Verify order belongs to user
        const order = await Order.findById(orderId);
        if (!order || order.customer.toString() !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'sdg', // Sudanese Pound
            metadata: {
                orderId: orderId,
                customerId: req.user.id
            }
        });

        // Update order with transaction ID
        order.payment.transactionId = paymentIntent.id;
        await order.save();

        res.status(200).json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
exports.confirmPayment = async (req, res, next) => {
    try {
        const { paymentIntentId, orderId } = req.body;

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: 'Payment not successful'
            });
        }

        // Update order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.payment.status = 'completed';
        order.payment.paidAt = new Date();
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Payment confirmed successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Process refund
// @route   POST /api/payments/refund
// @access  Private (admin)
exports.processRefund = async (req, res, next) => {
    try {
        const { orderId, amount, reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!order.payment.transactionId) {
            return res.status(400).json({
                success: false,
                message: 'No payment transaction found for this order'
            });
        }

        // Create refund in Stripe
        const refund = await stripe.refunds.create({
            payment_intent: order.payment.transactionId,
            amount: amount ? Math.round(amount * 100) : undefined,
            reason: reason || 'requested_by_customer'
        });

        // Update order
        order.payment.status = 'refunded';
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: {
                refundId: refund.id,
                amount: refund.amount / 100,
                status: refund.status
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
exports.getPaymentHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const query = {
            customer: req.user.id,
            'payment.status': { $in: ['completed', 'refunded'] }
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit))
            .select('orderNumber pricing payment createdAt restaurant')
            .populate('restaurant', 'name logo');

        const total = await Order.countDocuments(query);

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Webhook handler for Stripe events
// @route   POST /api/payments/webhook
// @access  Public (Stripe)
exports.stripeWebhook = async (req, res, next) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            // Update order
            await Order.findOneAndUpdate(
                { 'payment.transactionId': paymentIntent.id },
                {
                    'payment.status': 'completed',
                    'payment.paidAt': new Date()
                }
            );
            break;

        case 'payment_intent.payment_failed':
            // Handle failed payment
            await Order.findOneAndUpdate(
                { 'payment.transactionId': event.data.object.id },
                { 'payment.status': 'failed' }
            );
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};
