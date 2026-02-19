PakStream - Video Streaming App

A modern MERN stack video streaming application with a Netflix-style dark theme UI and a complete authentication system.

📁 Project Structure
PakStream/
│
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── controllers/
│   │   │   └── authController.js
│   │   ├── models/
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   └── auth.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── config/
│   │   └── server.js
│   ├── package.json
│   └── .env
│
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginModal.tsx
│   │   │   │   ├── RegisterModal.tsx
│   │   │   │   ├── AdminRegisterModal.tsx
│   │   │   │   └── UserProfile.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── VideoGrid.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   └── authService.ts
│   │   ├── types/
│   │   │   └── auth.ts
│   │   └── pages/
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env
│
└── README.md

🚀 Features
🔐 Complete Authentication System

User Registration (Email & Password)

Admin Registration (With Admin Key)

Secure Login / Logout (JWT Based)

Editable User Profiles

Role-Based Access Control (User / Admin)

Protected Routes (Auth + Admin Only)

🎨 UI / UX Features

Netflix-inspired Dark Theme

Fully Responsive (Mobile First)

Clean Modal-based Authentication Forms

Loading Indicators

User-friendly Error Handling

⚙️ Technical Features
Backend

Express.js

MongoDB

JWT Authentication

bcrypt Password Hashing

Role-based Middleware Protection

Frontend

React + TypeScript

Tailwind CSS

Context API for Authentication State

API Service Layer with Token Handling

Full Type Safety

🛠 Getting Started
Prerequisites

Node.js (v14 or higher)

MongoDB (Local or Cloud)

npm or yarn

🔧 Backend Setup
cd backend
npm install
npm run dev


Backend runs at:

http://localhost:5000

💻 Frontend Setup
cd frontend
npm install
npm start


Frontend runs at:

http://localhost:3000

📡 API Endpoints
Authentication
Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/register-admin	Register admin (requires admin key)
POST	/api/auth/login	Login user
GET	/api/auth/profile	Get user profile (Protected)
PUT	/api/auth/profile	Update profile (Protected)
PUT	/api/auth/change-password	Change password (Protected)
Health Check
GET /api/health

🌍 Environment Variables
Backend (.env)
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pakstream
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
ADMIN_REGISTRATION_KEY=admin123
NODE_ENV=development

Frontend (.env)
REACT_APP_API_URL=http://localhost:5000/api

📌 Usage Guide
Register as Regular User

Click Sign Up

Enter username, email, and password

Click Sign Up

Register as Admin

Click Sign Up

Click Register as Admin

Enter details + Admin Key
Default key: admin123

Click Register

Login

Click Login

Enter email and password

Click Login

Admin Features

Admin badge appears in navbar

Access admin-only routes

Use:

<ProtectedRoute requireAdmin={true}>
  <AdminDashboard />
</ProtectedRoute>

✅ Development Status

✔ User Registration & Login
✔ Admin Registration
✔ JWT Authentication
✔ Password Hashing (bcrypt)
✔ Profile Management
✔ Role-Based Access Control
✔ Protected Routes
✔ Modal-based UI
✔ Error Handling
✔ TypeScript Support

🔮 Next Planned Features

Video Upload & Streaming

User Playlists & Favorites

Search & Filtering

Payment Integration

Real-time Notifications

Video Categories

Watch History

Comments & Ratings

🔒 Security Notes

Change JWT_SECRET in production

Change ADMIN_REGISTRATION_KEY in production

Use HTTPS in production

Implement Rate Limiting

Add Input Validation & Sanitization

Consider Refresh Tokens for better security