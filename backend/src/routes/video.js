const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const {
  uploadVideo,
  getVideos,
  getFeaturedVideos,
  getVideoById,
  getUserVideos,
  updateVideo,
  deleteVideo,
  getVideoStatus,
  getQueueStatus,
  trackVideoView,
  toggleVideoLike,
  downloadVideo,
  getVideoHash,
  verifyVideoIntegrity,
  getVideoLikedByUsers
} = require('../controllers/videoController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { upload, verificationUpload, handleUploadError } = require('../middleware/upload');
const storageService = require('../services/storageService');
const { isMinIOEnabled } = require('../config/storage');

// In-memory cache for video metadata to avoid DB hits on every segment request
// Cache expires after 5 minutes to ensure metadata stays reasonably fresh
const videoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedVideo = async (videoId) => {
  const cached = videoCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const Video = require('../models/Video');
  const video = await Video.findById(videoId).lean();
  
  if (video) {
    videoCache.set(videoId, {
      data: video,
      timestamp: Date.now()
    });
  }
  
  return video;
};

// Clear cache entry when video is updated/deleted
const clearVideoCache = (videoId) => {
  videoCache.delete(videoId);
};

// Helper function to check if origin matches allowed origins
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  
  // Allow all origins if configured as '*'
  if (allowedOrigins === '*') {
    return true;
  }
  
  // Handle array of origins
  if (Array.isArray(allowedOrigins)) {
    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string') {
        if (allowed === origin) return true;
      } else if (allowed instanceof RegExp) {
        if (allowed.test(origin)) return true;
      }
    }
  }
  
  return false;
}

// Public routes (with optional auth to get user like status)
router.get('/', optionalAuth, getVideos);
router.get('/featured/list', optionalAuth, getFeaturedVideos); // Must come before /:id route
router.get('/queue/status', getQueueStatus); // Get processing queue status
router.get('/:id', optionalAuth, getVideoById);
router.get('/:id/status', getVideoStatus);
router.get('/:id/hash', getVideoHash); // Get video hash for manual verification
router.post('/:id/view', trackVideoView); // Track video view (public endpoint)
router.post('/:id/like', authenticateToken, toggleVideoLike); // Toggle video like (requires auth)
// Only admins can see who liked a video
router.get('/:id/likedby', authenticateToken, requireAdmin, getVideoLikedByUsers);
router.post('/:id/verify', verificationUpload, handleUploadError, verifyVideoIntegrity); // Verify video integrity (public endpoint)

// Protected download route (requires authentication)
router.get('/:id/download', authenticateToken, downloadVideo);

// Serve video files with range request support for seeking
router.get('/:id/original', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const Premiere = require('../models/Premiere');
    const video = await Video.findById(req.params.id);
    
    if (!video || !video.originalFile) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if video is part of a premiere and restrict access if needed
    const premiere = await Premiere.findOne({
      video: req.params.id,
      status: { $in: ['scheduled', 'live'] },
      isActive: true
    });

    if (premiere) {
      // Admins can always access
      const isAdmin = req.user && req.user.role === 'admin';
      
      if (!isAdmin) {
        // If premiere is scheduled and hasn't started, deny access
        if (premiere.status === 'scheduled' && premiere.startTime > new Date()) {
          return res.status(403).json({ 
            message: 'This video is part of a scheduled premiere and is not yet available. Please wait for the premiere to start.' 
          });
        }
      }
    }

    // Determine object name in storage
    const objectName = `original/${video.originalFile.filename}`;
    
    // Check if file exists
    const exists = await storageService.fileExists(objectName);
    if (!exists) {
      // Fallback to local path for backward compatibility
      const filePath = path.join(__dirname, '../../uploads/videos/original', video.originalFile.filename);
      try {
        await fs.access(filePath);
        // Serve from local file
        return serveLocalFile(filePath, video.originalFile.mimetype || 'video/mp4', req, res);
      } catch (error) {
        return res.status(404).json({ message: 'Video file not found' });
      }
    }

    // Get file stats
    const stats = await storageService.getFileStats(objectName);
    const fileSize = stats.size;
    const range = req.headers.range;

    // Set CORS headers
    const { appConfig } = require('../config/appConfig');
    const origin = req.headers.origin;
    const corsOrigin = appConfig.cors.origin;
    
    if (corsOrigin === '*') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin && isOriginAllowed(origin, corsOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    // If MinIO and public URL is configured, redirect to presigned URL
    if (isMinIOEnabled()) {
      const publicUrl = storageService.getPublicUrl(objectName);
      if (publicUrl) {
        // Use presigned URL for better performance
        const presignedUrl = await storageService.getPresignedUrl(objectName, 3600); // 1 hour expiry
        return res.redirect(presignedUrl);
      }
    }

    // Get file stream from storage
    const fileStream = await storageService.getFileStream(objectName);

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // For MinIO, we need to handle range requests differently
      // For now, stream the entire file and let the client handle range
      // In production, you might want to implement proper range support for MinIO
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.originalFile.mimetype || 'video/mp4',
        'Cache-Control': 'public, max-age=86400'
      });

      // Note: Proper range support for MinIO streams would require additional handling
      fileStream.pipe(res);
    } else {
      // No range requested, send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': video.originalFile.mimetype || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });

      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Error serving video:', error);
    res.status(500).json({ message: 'Error serving video', error: error.message });
  }
});

// Helper function to serve local file (for backward compatibility)
function serveLocalFile(filePath, contentType, req, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const fsSync = require('fs');
        const file = fsSync.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        });

        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400'
        });

        const fsSync = require('fs');
        const file = fsSync.createReadStream(filePath);
        file.pipe(res);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Serve HLS files with caching to avoid DB hits on every segment request
router.get('/:id/hls/*', async (req, res) => {
  try {
    // Use cached video metadata instead of hitting DB every time
    const video = await getCachedVideo(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if video is part of a premiere and restrict access if needed
    // Note: We check the DB directly here instead of cache to ensure we have latest premiere status
    const Premiere = require('../models/Premiere');
    const premiere = await Premiere.findOne({
      video: req.params.id,
      status: { $in: ['scheduled', 'live'] },
      isActive: true
    });

    if (premiere) {
      // Admins can always access
      const isAdmin = req.user && req.user.role === 'admin';
      
      if (!isAdmin) {
        // If premiere is scheduled and hasn't started, deny access
        if (premiere.status === 'scheduled' && premiere.startTime > new Date()) {
          return res.status(403).json({ 
            message: 'This video is part of a scheduled premiere and is not yet available. Please wait for the premiere to start.' 
          });
        }
      }
    }

    const requestedFile = req.params[0]; // The * part of the route
    const filePath = path.join(__dirname, '../../uploads/videos/processed', video._id.toString(), 'hls', requestedFile);
    
    // Check if file exists and get stats
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      console.error('File not found:', filePath, error);
      return res.status(404).json({ message: 'File not found' });
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    // Enable CORS for HLS streaming using configured origins
    const { appConfig } = require('../config/appConfig');
    
    const origin = req.headers.origin;
    const corsOrigin = appConfig.cors.origin;
    
    // Set CORS headers BEFORE any other headers
    if (corsOrigin === '*') {
      // Allow all origins
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin && isOriginAllowed(origin, corsOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (Array.isArray(corsOrigin) && corsOrigin.length > 0) {
      // Find first string origin (not regex) as fallback
      const stringOrigin = corsOrigin.find(o => typeof o === 'string');
      if (stringOrigin) {
        res.setHeader('Access-Control-Allow-Origin', stringOrigin);
      }
    }
    
    // Set CORS headers for range requests
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    // Set appropriate content type and caching headers
    if (requestedFile.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Playlists should not be cached
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // For playlists, send entire file (no range support needed)
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      
      const fsSync = require('fs');
      const file = fsSync.createReadStream(filePath);
      file.pipe(res);
      return;
    } else if (requestedFile.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Segments can be cached forever
      
      // Handle range requests for segments (important for seeking)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        // Create read stream for the requested range
        const fsSync = require('fs');
        const file = fsSync.createReadStream(filePath, { start, end });

        // Set headers for partial content
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=31536000, immutable'
        });

        file.pipe(res);
        return;
      } else {
        // No range requested, send entire segment
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        
        const fsSync = require('fs');
        const file = fsSync.createReadStream(filePath);
        file.pipe(res);
        return;
      }
    } else if (requestedFile.endsWith('.jpg') || requestedFile.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache thumbnails for 1 day
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      
      const fsSync = require('fs');
      const file = fsSync.createReadStream(filePath);
      file.pipe(res);
      return;
    }

    // Fallback: send file as-is
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving HLS file:', error);
    res.status(500).json({ message: 'Error serving file', error: error.message });
  }
});

// Protected routes
router.post('/upload', authenticateToken, upload, handleUploadError, uploadVideo);
router.get('/user/my-videos', authenticateToken, getUserVideos);
router.put('/:id', authenticateToken, async (req, res, next) => {
  // Clear cache when video is updated
  clearVideoCache(req.params.id);
  next();
}, updateVideo);
router.delete('/:id', authenticateToken, async (req, res, next) => {
  // Clear cache when video is deleted
  clearVideoCache(req.params.id);
  next();
}, deleteVideo);

// Admin routes
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    const videos = await Video.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Video.countDocuments(query);

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all videos',
      error: error.message
    });
  }
});

module.exports = router;
