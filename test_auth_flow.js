const axios = require('axios');

const API_URL = 'https://delivero-backend-gay2.onrender.com/api/auth';
// For local testing if needed:
// const API_URL = 'http://localhost:5000/api/auth';

const testUser = {
    name: 'Test Customer',
    email: `customer_${Date.now()}@test.com`,
    phone: `+1${Date.now()}`,
    password: 'password123',
    role: 'customer'
};

const testRestaurant = {
    name: 'Test Restaurant Owner',
    email: `restaurant_${Date.now()}@test.com`,
    phone: `+2${Date.now()}`,
    password: 'password123',
    role: 'restaurant'
};

const testDriver = {
    name: 'Test Driver',
    email: `driver_${Date.now()}@test.com`,
    phone: `+3${Date.now()}`,
    password: 'password123',
    role: 'driver'
};

async function testAuth(user, roleName) {
    console.log(`\n--- Testing ${roleName} ---`);
    try {
        // 1. Register
        console.log(`Registering ${roleName}...`);
        const registerRes = await axios.post(`${API_URL}/register`, user);
        console.log('Register Success:', registerRes.data.success);
        console.log('User ID:', registerRes.data.data.user.id);

        if (!registerRes.data.token) {
            throw new Error('No token received on register');
        }

        // 2. Login
        console.log(`Logging in ${roleName}...`);
        constloginRes = await axios.post(`${API_URL}/login`, {
            email: user.email,
            password: user.password
        });
        console.log('Login Success:', loginRes.data.success);

        // 3. Get Me
        console.log(`Getting Profile for ${roleName}...`);
        const meRes = await axios.get(`${API_URL}/me`, {
            headers: {
                Authorization: `Bearer ${loginRes.data.data.token}`
            }
        });
        console.log('Get Profile Success:', meRes.data.success);
        console.log('Role matches:', meRes.data.data.role === user.role);

    } catch (error) {
        console.error(`${roleName} Test Failed:`);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

async function runTests() {
    await testAuth(testUser, 'Customer');
    await testAuth(testRestaurant, 'Restaurant');
    await testAuth(testDriver, 'Driver');
}

runTests();
