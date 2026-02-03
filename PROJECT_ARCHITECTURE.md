# PakStream - Project Architecture & Flow Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Database Models & Relationships](#database-models--relationships)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [API Flow & Communication](#api-flow--communication)
8. [Authentication Flow](#authentication-flow)
9. [File Processing Flow](#file-processing-flow)
10. [Real-time Features](#real-time-features)
11. [Project Structure](#project-structure)

---

## 🎯 Project Overview

**PakStream** is a comprehensive media streaming and document management platform built with the MERN stack. It supports:

- **Video Streaming**: HLS-based adaptive streaming with multiple quality levels
- **Document Management**: PDF upload, processing, and viewing
- **Presentation Management**: PPT/PPTX upload, conversion to slides, and viewing
- **Live Premieres**: Scheduled video premieres with real-time synchronization
- **User Management**: Role-based access control (Admin/User)
- **File Integrity Verification**: SHA-256 hash verification for documents and presentations

---

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Processing**: 
  - FFmpeg (video processing)
  - LibreOffice (presentation conversion)
  - ImageMagick (image processing)
  - Poppler-utils (PDF processing)
- **Real-time**: Socket.IO
- **Storage**: Local filesystem or MinIO (S3-compatible)

### Frontend
- **Framework**: React 19 with TypeScript
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Video Player**: HLS.js
- **HTTP Client**: Fetch API
- **Real-time**: Socket.IO Client

### Infrastructure
- **Web Server**: Nginx (production)
- **Process Manager**: systemd (Linux) or PM2
- **Containerization**: Docker (optional)

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   React App   │  │  Socket.IO    │  │   HLS.js     │     │
│  │  (TypeScript) │  │    Client     │  │   Player     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼─────────────────┼──────────────────┼─────────────┘
          │                 │                   │
          │ HTTP/REST       │ WebSocket         │ HLS Streams
          │                 │                   │
┌─────────┼─────────────────┼──────────────────┼─────────────┐
│         │                 │                   │              │
│  ┌──────▼─────────────────▼──────────────────▼──────┐        │
│  │           NGINX (Reverse Proxy)                   │       │
│  │  - Serves static files (React build)               │      │
│  │  - Proxies API requests to backend                 │      │
│  │  - Serves HLS video segments                       │      │
│  └──────────────────┬────────────────────────────────┘       │
│                      │                                       │
│  ┌───────────────────▼────────────────────────────────┐      │
│  │         EXPRESS.JS BACKEND SERVER                  │      │
│  │  ┌──────────────────────────────────────────────┐  │      │
│  │  │  Routes Layer                                │  │      │
│  │  │  - /api/auth, /api/videos, /api/documents    │  │      │
│  │  └──────────────┬───────────────────────────────┘  │      │
│  │                 │                                  │      │
│  │  ┌──────────────▼───────────────────────────────┐  │      │
│  │  │  Controllers Layer                           │  │      │
│  │  │  - authController, videoController, etc.     │  │      │
│  │  └──────────────┬───────────────────────────────┘  │      │
│  │                 │                                  │      │
│  │  ┌──────────────▼───────────────────────────────┐  │      │
│  │  │  Services Layer                               │  │      │
│  │  │  - videoProcessor, documentProcessor          │  │      │
│  │  │  - hashService, storageService                 │  │      │
│  │  └──────────────┬───────────────────────────────┘  │      │
│  │                 │                                   │      │
│  │  ┌──────────────▼───────────────────────────────┐  │      │
│  │  │  Models Layer (Mongoose)                       │  │      │
│  │  │  - User, Video, Document, Presentation        │  │      │
│  │  └──────────────┬───────────────────────────────┘  │      │
│  └─────────────────┼──────────────────────────────────┘      │
│                    │                                           │
│  ┌─────────────────▼──────────────────────────────────┐       │
│  │              MONGODB DATABASE                        │       │
│  │  - Users collection                                 │       │
│  │  - Videos collection                                │       │
│  │  - Documents collection                              │       │
│  │  - Presentations collection                          │       │
│  └────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐       │
│  │         FILE STORAGE (Local/MinIO)                  │       │
│  │  - /uploads/videos/ (original & processed)          │       │
│  │  - /uploads/documents/                              │       │
│  │  - /uploads/presentations/                           │       │
│  └────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄 Database Models & Relationships

### User Model
```javascript
User {
  _id: ObjectId
  username: String (unique)
  email: String (unique)
  password: String (hashed with bcrypt)
  role: 'user' | 'admin'
  isActive: Boolean
  profile: {
    firstName, lastName, avatar, bio
  }
  organization, contactNumber, address
  preferences: { theme, language }
  timestamps: createdAt, updatedAt
}
```

### Video Model
```javascript
Video {
  _id: ObjectId
  title, description: String
  uploadedBy: ObjectId → User (reference)
  originalFile: { filename, path, size, mimetype, duration }
  processedFiles: {
    hls: { masterPlaylist, segments, variants[] }
    thumbnails: String[]
    poster: String
  }
  status: 'uploading' | 'processing' | 'ready' | 'error' | 'failed'
  processingProgress: Number (0-100)
  duration, resolution, fileSize: Number
  views, likes, dislikes: Number
  tags: String[]
  category: 'movie' | 'tv-show' | 'documentary' | 'short-film' | 'other'
  isPublic, isFeatured, isForPremiere: Boolean
  sha256Hash: String (for integrity verification)
  timestamps: createdAt, updatedAt
}
```

### Document Model
```javascript
Document {
  _id: ObjectId
  title, description: String
  uploadedBy: ObjectId → User (reference)
  originalFile: { filename, path, size, mimetype }
  status: 'processing' | 'ready' | 'error'
  processingProgress: Number (0-100)
  pageCount: Number
  views, likes: Number
  category: 'academic' | 'business' | 'legal' | 'technical' | 'other'
  tags: String[]
  isPublic: Boolean
  thumbnail: String
  sha256Hash: String (for integrity verification)
  timestamps: createdAt, updatedAt
}
```

### Presentation Model
```javascript
Presentation {
  _id: ObjectId
  title, description: String
  uploadedBy: ObjectId → User (reference)
  originalFile: { filename, path, size, mimetype }
  status: 'processing' | 'ready' | 'error'
  processingProgress: Number (0-100)
  slides: [{
    slideNumber: Number
    imagePath: String
    thumbnailPath: String
    notes: String
  }]
  totalSlides, duration: Number
  views, likes: Number
  category: 'business' | 'education' | 'marketing' | 'technology' | 'design' | 'other'
  tags: String[]
  isPublic: Boolean
  thumbnail: String
  sha256Hash: String (for integrity verification)
  timestamps: createdAt, updatedAt
}
```

### Relationships
```
User (1) ────< (Many) Video
User (1) ────< (Many) Document
User (1) ────< (Many) Presentation
```

**Key Points:**
- All content models reference `User` via `uploadedBy` field
- Mongoose `populate()` is used to fetch user details when needed
- Indexes are created on frequently queried fields (title, status, uploadedBy)

---

## 🔧 Backend Architecture

### Directory Structure
```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── appConfig.js  # Main app configuration
│   │   ├── cdn.js        # CDN configuration
│   │   └── storage.js    # Storage configuration
│   │
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   ├── videoController.js
│   │   ├── documentController.js
│   │   ├── presentationController.js
│   │   ├── userController.js
│   │   ├── premiereController.js
│   │   └── downloadController.js
│   │
│   ├── middleware/       # Express middleware
│   │   ├── auth.js              # JWT authentication
│   │   ├── upload.js            # Video upload
│   │   ├── documentUpload.js    # Document upload
│   │   └── presentationUpload.js # Presentation upload
│   │
│   ├── models/          # Mongoose schemas
│   │   ├── User.js
│   │   ├── Video.js
│   │   ├── Document.js
│   │   ├── Presentation.js
│   │   ├── Premiere.js
│   │   └── VideoDownload.js
│   │
│   ├── routes/          # API route definitions
│   │   ├── auth.js
│   │   ├── video.js
│   │   ├── document.js
│   │   ├── presentation.js
│   │   ├── user.js
│   │   ├── premiere.js
│   │   └── download.js
│   │
│   ├── services/        # Business logic
│   │   ├── videoProcessor.js      # FFmpeg video processing
│   │   ├── documentProcessor.js   # PDF processing
│   │   ├── presentationProcessor.js # PPT processing
│   │   ├── hashService.js          # SHA-256 hash calculation
│   │   ├── storageService.js       # File storage abstraction
│   │   └── videoQueue.js          # Video processing queue
│   │
│   ├── socket/          # Socket.IO handlers
│   │   └── socketHandler.js
│   │
│   ├── utils/           # Utility functions
│   │   └── cdnUtils.js
│   │
│   └── server.js        # Main server entry point
│
├── uploads/             # File uploads directory
│   ├── videos/
│   ├── documents/
│   └── presentations/
│
└── package.json
```

### Request Flow

```
HTTP Request
    │
    ▼
server.js (Express app)
    │
    ▼
Route Handler (routes/*.js)
    │
    ▼
Middleware (auth.js, upload.js)
    │
    ▼
Controller (controllers/*.js)
    │
    ├──► Service Layer (services/*.js)
    │       │
    │       ├──► Model (models/*.js)
    │       │       │
    │       │       ▼
    │       │   MongoDB
    │       │
    │       └──► File System / MinIO
    │
    ▼
Response (JSON)
```

### Key Backend Components

#### 1. Server Initialization (`server.js`)
- Sets up Express app
- Connects to MongoDB
- Configures CORS
- Registers API routes
- Initializes Socket.IO
- Serves static files

#### 2. Authentication Middleware (`middleware/auth.js`)
- `authenticateToken`: Verifies JWT token
- `requireAdmin`: Ensures user is admin
- `requireAdminOrOwner`: Admin or resource owner

#### 3. Controllers
Each controller handles:
- Request validation
- Business logic coordination
- Service layer calls
- Response formatting
- Error handling

#### 4. Services
- **videoProcessor.js**: Converts videos to HLS format
- **documentProcessor.js**: Processes PDFs, extracts pages
- **presentationProcessor.js**: Converts PPT to images
- **hashService.js**: Calculates SHA-256 hashes
- **storageService.js**: Abstracts file storage (local/MinIO)

---

## 🎨 Frontend Architecture

### Directory Structure
```
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── admin/       # Admin-specific components
│   │   ├── auth/        # Authentication components
│   │   ├── document/    # Document-related components
│   │   ├── presentation/ # Presentation components
│   │   ├── video/       # Video components
│   │   └── common/      # Shared components
│   │
│   ├── pages/           # Page components
│   │   ├── admin/       # Admin pages
│   │   └── user/        # User pages
│   │
│   ├── services/        # API service layer
│   │   ├── authService.ts
│   │   ├── videoService.ts
│   │   ├── documentService.ts
│   │   ├── presentationService.ts
│   │   ├── userService.ts
│   │   ├── premiereService.ts
│   │   ├── downloadService.ts
│   │   └── socketService.ts
│   │
│   ├── hooks/           # Custom React hooks
│   │   └── useAuth.tsx
│   │
│   ├── contexts/        # React Context providers
│   │   ├── AuthContext (via useAuth)
│   │   ├── ThemeContext.tsx
│   │   └── NotificationContext.tsx
│   │
│   ├── types/           # TypeScript type definitions
│   │   ├── auth.ts
│   │   ├── video.ts
│   │   ├── document.ts
│   │   ├── presentation.ts
│   │   ├── user.ts
│   │   ├── premiere.ts
│   │   └── download.ts
│   │
│   ├── utils/           # Utility functions
│   │   ├── hashUtils.ts
│   │   └── videoUtils.ts
│   │
│   ├── config/          # Configuration
│   │   ├── api.ts       # API URL configuration
│   │   └── themes.ts    # Theme configuration
│   │
│   ├── App.tsx          # Main app component
│   └── index.tsx        # Entry point
│
└── public/              # Static assets
```

### Component Hierarchy

```
App.tsx
├── ThemeProvider
│   └── AuthProvider
│       └── NotificationProvider
│           └── AppContent
│               ├── Navbar (conditional)
│               ├── AdminSidebar (conditional)
│               ├── Routes
│               │   ├── UserHomePage
│               │   ├── AdminDashboard
│               │   ├── VideoManagementPage
│               │   ├── DocumentManagementPage
│               │   └── ...
│               └── Footer
```

### State Management

1. **Authentication State**: `useAuth` hook (Context API)
2. **Theme State**: `ThemeContext`
3. **Notifications**: `NotificationContext`
4. **Component State**: React `useState` hooks
5. **Server State**: Fetch API calls (no Redux)

---

## 🔄 API Flow & Communication

### API Endpoint Structure

```
Base URL: http://localhost:5000/api

Authentication:
  POST   /api/auth/register
  POST   /api/auth/register-admin
  POST   /api/auth/login
  GET    /api/auth/profile
  PUT    /api/auth/profile

Videos:
  GET    /api/videos              # List videos
  GET    /api/videos/:id           # Get video details
  POST   /api/videos/upload       # Upload video (admin)
  GET    /api/videos/:id/original  # Download original
  GET    /api/videos/:id/hash     # Get video hash
  POST   /api/videos/:id/verify   # Verify integrity

Documents:
  GET    /api/documents            # List documents
  GET    /api/documents/:id        # Get document details
  GET    /api/documents/:id/file  # View/download PDF
  GET    /api/documents/:id/hash  # Get document hash
  POST   /api/documents/:id/verify # Verify integrity
  POST   /api/documents/upload    # Upload (admin)

Presentations:
  GET    /api/presentations        # List presentations
  GET    /api/presentations/:id    # Get presentation details
  GET    /api/presentations/:id/slides # Get slides
  GET    /api/presentations/:id/image/:slideNumber # Get slide image
  GET    /api/presentations/:id/hash # Get hash
  POST   /api/presentations/:id/verify # Verify integrity
  POST   /api/presentations/upload # Upload (admin)

Users (Admin only):
  GET    /api/users
  GET    /api/users/:id
  POST   /api/users
  PUT    /api/users/:id
  DELETE /api/users/:id
```

### Request/Response Flow

#### Example: Upload Document

```
1. Frontend (DocumentUploadModal)
   │
   ├─► Creates FormData with file + metadata
   │
   └─► Calls documentService.uploadDocument()
       │
       ▼
2. Service Layer (documentService.ts)
   │
   ├─► POST /api/documents/upload
   │   Headers: Authorization: Bearer <token>
   │   Body: FormData
   │
   └─► Handles progress tracking (XMLHttpRequest)
       │
       ▼
3. Backend Route (routes/document.js)
   │
   ├─► authenticateToken middleware
   │   └─► Verifies JWT, sets req.user
   │
   ├─► requireAdmin middleware
   │   └─► Checks user.role === 'admin'
   │
   ├─► upload.single('document') middleware
   │   └─► Saves file to /uploads/documents/original/
   │
   └─► documentController.uploadDocument()
       │
       ▼
4. Controller (documentController.js)
   │
   ├─► Calculates SHA-256 hash (hashService)
   │
   ├─► Creates Document model instance
   │
   ├─► Saves to MongoDB
   │
   └─► Starts background processing
       │
       ▼
5. Service (documentProcessor.js)
   │
   ├─► Processes PDF (extracts pages, creates thumbnails)
   │
   ├─► Updates Document model (status, pageCount, thumbnail)
   │
   └─► Emits Socket.IO event (processing complete)
       │
       ▼
6. Frontend receives Socket.IO event
   │
   └─► Updates UI (shows document as ready)
```

---

## 🔐 Authentication Flow

### Registration Flow

```
1. User fills registration form
   │
   ▼
2. Frontend: authService.register()
   POST /api/auth/register
   Body: { username, email, password }
   │
   ▼
3. Backend: authController.register()
   ├─► Validates input
   ├─► Checks if user exists
   ├─► Hashes password (bcrypt)
   ├─► Creates User model
   └─► Returns user data (no password)
   │
   ▼
4. Frontend receives response
   └─► Stores token in localStorage
   └─► Updates AuthContext
```

### Login Flow

```
1. User enters credentials
   │
   ▼
2. Frontend: authService.login()
   POST /api/auth/login
   Body: { email, password }
   │
   ▼
3. Backend: authController.login()
   ├─► Finds user by email
   ├─► Compares password (bcrypt.compare)
   ├─► Generates JWT token
   │   Payload: { userId, role }
   │   Secret: process.env.JWT_SECRET
   │   Expires: 24 hours
   └─► Returns { token, user }
   │
   ▼
4. Frontend receives token
   ├─► localStorage.setItem('token', token)
   └─► Updates AuthContext
```

### Protected Route Access

```
1. User navigates to protected route
   │
   ▼
2. Frontend: ProtectedRoute component
   ├─► Checks useAuth().user
   ├─► If no user → Redirect to login
   └─► If requireAdmin && user.role !== 'admin' → Redirect
   │
   ▼
3. API Request (if needed)
   ├─► Gets token from localStorage
   ├─► Adds header: Authorization: Bearer <token>
   │
   ▼
4. Backend: authenticateToken middleware
   ├─► Extracts token from header
   ├─► Verifies token (jwt.verify)
   ├─► Finds user in database
   ├─► Sets req.user
   └─► Calls next()
```

---

## 📁 File Processing Flow

### Video Processing Flow

```
1. Admin uploads video
   │
   ▼
2. File saved to /uploads/videos/original/
   │
   ▼
3. Video model created (status: 'uploading')
   │
   ▼
4. Background processing starts (videoQueue)
   │
   ├─► videoProcessor.processVideo()
   │   │
   │   ├─► Extracts metadata (duration, resolution)
   │   │
   │   ├─► Generates thumbnails
   │   │
   │   ├─► Converts to HLS format
   │   │   ├─► 360p variant
   │   │   ├─► 480p variant
   │   │   ├─► 720p variant
   │   │   └─► 1080p variant (if source supports)
   │   │
   │   ├─► Creates master playlist (.m3u8)
   │   │
   │   └─► Saves to /uploads/videos/processed/{videoId}/
   │
   ▼
5. Updates Video model
   ├─► status: 'ready'
   ├─► processingProgress: 100
   └─► processedFiles: { hls: {...}, thumbnails: [...] }
   │
   ▼
6. Emits Socket.IO event: 'video:processing:complete'
   │
   ▼
7. Frontend receives event
   └─► Updates UI (video ready to play)
```

### Document Processing Flow

```
1. Admin uploads PDF
   │
   ▼
2. File saved to /uploads/documents/original/
   │
   ▼
3. SHA-256 hash calculated
   │
   ▼
4. Document model created
   ├─► status: 'processing'
   ├─► sha256Hash: <calculated hash>
   │
   ▼
5. Background processing (documentProcessor)
   │
   ├─► Extracts first page as thumbnail
   │
   ├─► Counts total pages
   │
   └─► Saves processed files to /uploads/documents/processed/{docId}/
   │
   ▼
6. Updates Document model
   ├─► status: 'ready'
   ├─► pageCount: <number>
   └─► thumbnail: <path>
```

### Presentation Processing Flow

```
1. Admin uploads PPT/PPTX
   │
   ▼
2. File saved to /uploads/presentations/original/
   │
   ▼
3. SHA-256 hash calculated
   │
   ▼
4. Presentation model created
   ├─► status: 'processing'
   ├─► sha256Hash: <calculated hash>
   │
   ▼
5. Background processing (presentationProcessor)
   │
   ├─► Converts PPT → PDF (LibreOffice)
   │
   ├─► Converts PDF → PNG slides
   │   ├─► Primary: ImageMagick
   │   ├─► Fallback: Poppler (pdftoppm)
   │   └─► Final fallback: LibreOffice PNG
   │
   ├─► Creates thumbnails for each slide
   │
   └─► Saves to /uploads/presentations/processed/{presId}/
   │
   ▼
6. Updates Presentation model
   ├─► status: 'ready'
   ├─► slides: [{ slideNumber, imagePath, ... }]
   └─► totalSlides: <number>
```

---

## ⚡ Real-time Features

### Socket.IO Integration

**Backend Setup:**
```javascript
// server.js
const SocketHandler = require('./socket/socketHandler');
const socketHandler = new SocketHandler(server);
```

**Frontend Setup:**
```typescript
// socketService.ts
import { io } from 'socket.io-client';
socket.connect();
```

### Real-time Events

#### Video Processing Progress
```
Backend emits:
  socket.emit('video:processing:progress', {
    videoId,
    progress: 0-100
  })

Frontend listens:
  socket.on('video:processing:progress', (data) => {
    updateProgressBar(data.progress)
  })
```

#### Processing Complete
```
Backend emits:
  socket.emit('video:processing:complete', {
    videoId,
    status: 'ready'
  })

Frontend listens:
  socket.on('video:processing:complete', (data) => {
    refreshVideoList()
  })
```

---

## 📂 Project Structure

### Complete File Organization

```
PakStream/
├── backend/
│   ├── src/
│   │   ├── config/          # App configuration
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── socket/         # Socket.IO handlers
│   │   ├── utils/          # Utilities
│   │   └── server.js       # Entry point
│   ├── uploads/            # File storage
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/          # Custom hooks
│   │   ├── contexts/       # Context providers
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utilities
│   │   ├── config/         # Configuration
│   │   ├── App.tsx         # Main component
│   │   └── index.tsx       # Entry point
│   ├── public/             # Static assets
│   ├── package.json
│   └── .env
│
└── README.md
```

---

## 🔗 Key Connections

### Frontend → Backend

1. **API Services** (`frontend/src/services/*.ts`)
   - Make HTTP requests to backend
   - Handle authentication tokens
   - Format request/response data

2. **Socket Service** (`frontend/src/services/socketService.ts`)
   - Establishes WebSocket connection
   - Listens for real-time events
   - Emits client events

### Backend → Database

1. **Models** (`backend/src/models/*.js`)
   - Define Mongoose schemas
   - Create database collections
   - Define relationships

2. **Controllers** use Models
   - `User.findById()`, `Video.find()`, etc.
   - `populate()` for relationships
   - `save()`, `updateOne()`, `deleteOne()`

### Backend → File System

1. **Upload Middleware** (`middleware/*Upload.js`)
   - Saves files using Multer
   - Stores in `/uploads/` directory

2. **Storage Service** (`services/storageService.js`)
   - Abstracts local/MinIO storage
   - Handles file operations

### Processing Services

1. **Video Processor** → FFmpeg
2. **Document Processor** → PDF libraries
3. **Presentation Processor** → LibreOffice, ImageMagick, Poppler

---

## 🚀 Development Workflow

### Starting the Application

**Backend:**
```bash
cd backend
npm install
npm run dev  # Uses nodemon for auto-reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start  # Runs on http://localhost:3000
```

### Environment Variables

**Backend (.env):**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pakstream
JWT_SECRET=your-secret-key
NODE_ENV=development
FFMPEG_PATH=/usr/bin/ffmpeg
```

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## 📝 Important Notes for New Developers

1. **Authentication**: Always check `req.user` in protected routes
2. **File Uploads**: Use appropriate middleware (upload.js, documentUpload.js, etc.)
3. **Processing**: File processing happens asynchronously in background
4. **Real-time Updates**: Use Socket.IO for progress updates
5. **Error Handling**: Always wrap async operations in try-catch
6. **Type Safety**: Frontend uses TypeScript - define types in `types/` directory
7. **State Management**: Use Context API for global state, useState for local
8. **API Calls**: All API calls go through service layer (services/*.ts)

---

## 🔍 Debugging Tips

1. **Backend Logs**: Check `console.log` output in terminal
2. **Frontend Logs**: Check browser console (F12)
3. **Database**: Use MongoDB Compass or `mongosh` to inspect data
4. **Network**: Use browser DevTools Network tab for API calls
5. **Socket.IO**: Check Socket.IO debug logs in browser console

---

## 📚 Additional Resources

- **Express.js**: https://expressjs.com/
- **Mongoose**: https://mongoosejs.com/
- **React**: https://react.dev/
- **Socket.IO**: https://socket.io/
- **FFmpeg**: https://ffmpeg.org/
- **HLS.js**: https://github.com/video-dev/hls.js/

---

**Last Updated**: 2025-01-23
**Version**: 1.0

