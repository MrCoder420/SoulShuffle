const axios = require('axios');

const BASE_URL = 'https://api.mrcoder420.me/api/v1';

async function probe() {
  const email = `probe_${Date.now()}@test.com`;
  console.log(`Registering user with email: ${email}`);

  try {
    const signupRes = await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'Probe User',
      email,
      password: 'password123'
    });

    const token = signupRes.data.data.accessToken;
    console.log('User registered. Token acquired.');

    const headers = { Authorization: `Bearer ${token}` };

    const endpoints = [
      '/dares',
      '/dares/master',
      '/dares/deck',
      '/challenges',
      '/challenges/master',
      '/challenges/deck',
      '/rooms/dares',
      '/rooms/challenges',
      '/rooms/deck',
      '/deck',
      '/master-deck',
      '/cards',
      '/rooms/active',
      '/questionnaire',
      '/profile/me'
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
        console.log(`🟢 GET ${endpoint} -> Status ${res.status}`);
        console.log(`Response:`, JSON.stringify(res.data).substring(0, 300));
      } catch (err) {
        if (err.response) {
          console.log(`🔴 GET ${endpoint} -> Status ${err.response.status} (${err.response.data?.message || 'Error'})`);
        } else {
          console.log(`🔴 GET ${endpoint} -> Network Error: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Signup failed:', err.response?.data || err.message);
  }
}

probe();
