# Admin User Setup Guide

## Overview

Admin users in PakStream are created through the backend API using a special admin registration key. The admin signup option has been removed from the frontend UI for security reasons.

---

## Methods to Create Admin Users

### Method 1: Using cURL (Recommended)

#### Step 1: Make sure backend is running
```bash
cd backend
npm run dev
```

#### Step 2: Create admin user via API
```bash
curl -X POST http://localhost:5000/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@pakstream.com",
    "password": "YourSecurePassword123",
    "adminKey": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Admin registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "username": "admin",
      "email": "admin@pakstream.com",
      "role": "admin",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Method 2: Using the Shell Script

#### Run the provided script:
```bash
./create-admin.sh
```

**Note:** You can edit the script to customize admin credentials before running.

---

### Method 3: Using Postman or API Client

#### Request Details:
- **Method:** POST
- **URL:** `http://localhost:5000/api/auth/register-admin`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (JSON):**
  ```json
  {
    "username": "admin",
    "email": "admin@pakstream.com",
    "password": "YourSecurePassword123",
    "adminKey": "admin123"
  }
  ```

---

### Method 4: Using Node.js Script

Create a file `create-admin.js`:

```javascript
const fetch = require('node-fetch');

const createAdmin = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/register-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        email: 'admin@pakstream.com',
        password: 'YourSecurePassword123',
        adminKey: 'admin123'
      })
    });

    const data = await response.json();
    console.log('Admin created:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

createAdmin();
```

Run:
```bash
node create-admin.js
```

---

## Environment Configuration

### Current Admin Key
The admin registration key is configured in `/backend/.env`:

```env
ADMIN_REGISTRATION_KEY=admin123
```

### Change Admin Key (Production)
For production, change the admin key to something secure:

```env
ADMIN_REGISTRATION_KEY=your_very_secure_random_key_here_min_32_chars
```

Generate a secure key:
```bash
openssl rand -base64 32
```

---

## Admin Registration Endpoint

### Endpoint Details
- **Route:** `POST /api/auth/register-admin`
- **Access:** Public (but requires admin key)
- **Required Fields:**
  - `username` - Admin username (min 3 chars)
  - `email` - Admin email (must be unique)
  - `password` - Admin password (min 6 chars)
  - `adminKey` - Admin registration key

### Security Features
1. Γ£à Requires admin key verification
2. Γ£à Email uniqueness check
3. Γ£à Username uniqueness check
4. Γ£à Password hashing with bcrypt
5. Γ£à Returns JWT token for immediate login

---

## Admin User Capabilities

Once logged in as admin, users can:

1. **Upload Videos** - Full video upload and management
2. **Upload Presentations** - PowerPoint presentation uploads
3. **Manage Premieres** - Create and manage live premieres
4. **Delete Content** - Delete any video or presentation
5. **Dashboard Access** - Access admin dashboard sections

---

## Troubleshooting

### Error: "Invalid admin registration key"
- Check that you're using the correct admin key from `.env`
- Verify the `ADMIN_REGISTRATION_KEY` environment variable

### Error: "Email already registered"
- The email is already in use
- Try a different email or login with existing account

### Error: "Username already taken"
- The username is already in use
- Try a different username

### Connection Refused
- Make sure the backend server is running (`npm run dev`)
- Check that MongoDB is running
- Verify the API URL is correct

---

## Quick Reference

```bash
# Start backend
cd backend && npm run dev

# Create admin (using default credentials)
curl -X POST http://localhost:5000/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@pakstream.com","password":"Admin@123","adminKey":"admin123"}'

# Login as admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pakstream.com","password":"Admin@123"}'
```

---

## Best Practices

1. **Change Default Admin Key** - Don't use "admin123" in production
2. **Use Strong Passwords** - Minimum 12 characters with mixed case, numbers, and symbols
3. **Limit Admin Access** - Only create admin accounts for trusted users
4. **Monitor Admin Activity** - Keep track of admin actions in production
5. **Rotate Admin Keys** - Periodically change the admin registration key

---

**Last Updated:** January 2025




In user management while creating new user i want to add some more information or fields required for registration. 1. oraganization, its date of enrollement. and contact number, address/location.. same is updated in user management dashboard section where these fields should be displayed as well. secondly these new fields and name of the user should be displayed in the download management section where to more filed will be shown like name, organzation, location and contact number
