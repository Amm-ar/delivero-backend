const admin = require('firebase-admin');

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error.message);
    }
}

// @desc    Send push notification
// @param   {string} token - FCM token
// @param   {object} notification - Notification payload
// @param   {object} data - Data payload
exports.sendPushNotification = async (token, notification, data = {}) => {
    try {
        if (!admin.apps.length) {
            console.warn('Firebase not initialized, skipping notification');
            return null;
        }

        const message = {
            notification: {
                title: notification.title,
                body: notification.body,
                imageUrl: notification.image
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token: token,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'delivero_orders'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        return response;
    } catch (error) {
        console.error('Error sending notification:', error);
        return null;
    }
};

// @desc    Send notification to multiple tokens
// @param   {array} tokens - Array of FCM tokens
// @param   {object} notification - Notification payload
// @param   {object} data - Data payload
exports.sendMulticastNotification = async (tokens, notification, data = {}) => {
    try {
        if (!admin.apps.length || tokens.length === 0) {
            return null;
        }

        const message = {
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            tokens: tokens,
            android: {
                priority: 'high'
            }
        };

        const response = await admin.messaging().sendMulticast(message);
        return response;
    } catch (error) {
        console.error('Error sending multicast notification:', error);
        return null;
    }
};

// Order notification helpers
exports.notifyNewOrder = async (restaurantUser) => {
    if (!restaurantUser.fcmToken) return;

    return await exports.sendPushNotification(
        restaurantUser.fcmToken,
        {
            title: '🔔 New Order!',
            body: 'You have received a new order. Tap to view details.'
        },
        {
            type: 'new_order',
            screen: 'orders'
        }
    );
};

exports.notifyOrderStatusUpdate = async (customerUser, status, orderNumber) => {
    if (!customerUser.fcmToken) return;

    const statusMessages = {
        confirmed: '✅ Order confirmed! Your food is being prepared.',
        preparing: '👨‍🍳 Your order is being prepared.',
        ready: '🎉 Your order is ready for pickup!',
        'picked-up': '🛵 Driver picked up your order!',
        'on-the-way': '🚀 Your order is on the way!',
        delivered: '✨ Your order has been delivered! Enjoy!',
        cancelled: '❌ Your order has been cancelled.',
    };

    return await exports.sendPushNotification(
        customerUser.fcmToken,
        {
            title: `Order ${orderNumber}`,
            body: statusMessages[status] || 'Order status updated'
        },
        {
            type: 'order_status',
            status,
            screen: 'order_tracking'
        }
    );
};

exports.notifyDriverAssignment = async (driverUser, orderNumber) => {
    if (!driverUser.fcmToken) return;

    return await exports.sendPushNotification(
        driverUser.fcmToken,
        {
            title: '🎯 New Delivery Request',
            body: `Order ${orderNumber} has been assigned to you.`
        },
        {
            type: 'delivery_assigned',
            screen: 'active_delivery'
        }
    );
};
