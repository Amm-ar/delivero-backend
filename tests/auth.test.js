const request = require('supertest');
const app = require('../server'); // Assuming server.js exports 'app'
const mongoose = require('mongoose');
const User = require('../models/User');

// Mock data
const customerUser = {
    name: 'Test Customer',
    email: `customer_${Date.now()}@test.com`,
    phone: `091${Date.now().toString().slice(-7)}`,
    password: 'password123',
    role: 'customer'
};

const restaurantUser = {
    name: 'Test Restaurant',
    email: `rest_${Date.now()}@test.com`,
    phone: `092${Date.now().toString().slice(-7)}`,
    password: 'password123',
    role: 'restaurant'
};

// Connect to DB before tests
beforeAll(async () => {
    // Jest environment handles connection usually, or we ensure it's connected
    // This assumes server.js connects. If not, we might need manual connection.
});

// Clean up after tests
afterAll(async () => {
    await mongoose.connection.close();
});

describe('Authentication API', () => {
    let customerToken;
    let restaurantToken;

    // Test Registration
    describe('POST /api/auth/register', () => {
        it('should register a new customer', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(customerUser);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.role).toBe('customer');

            customerToken = res.body.data.token;
        });

        it('should register a new restaurant', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(restaurantUser);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user.role).toBe('restaurant');

            restaurantToken = res.body.data.token;
        });

        it('should not register with existing email', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(customerUser); // Same user

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });
    });

    // Test Login
    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: customerUser.email,
                    password: customerUser.password
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
        });

        it('should not login with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: customerUser.email,
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toEqual(401);
        });
    });

    // Test Get Me
    describe('GET /api/auth/me', () => {
        it('should get current user profile', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.email).toBe(customerUser.email);
        });

        it('should fail without token', async () => {
            const res = await request(app)
                .get('/api/auth/me');

            expect(res.statusCode).toEqual(401);
        });
    });
});
