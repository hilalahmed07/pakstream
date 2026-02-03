const Video = require('../models/Video');
const Premiere = require('../models/Premiere');
const VideoDownload = require('../models/VideoDownload');
const videoQueue = require('../services/videoQueue');
const { addCdnUrlsToVideos, addCdnUrlsToVideo } = require('../utils/cdnUtils');
const { calculateFileHash, calculateBufferHash } = require('../services/hashService');
const path = require('path');
const fs = require('fs').promises;

/**
 * Check if a video is part of an active/scheduled premiere
 * Returns the premiere if found, null otherwise
 */
const getActivePremiereForVideo = async (videoId) => {
  try {
    const premiere = await Premiere.findOne({
      video: videoId,
      status: { $in: ['scheduled', 'live'] },
      isActive: true
    });
    return premiere;
  } catch (error) {
    console.error('Error checking premiere for video:', error);
    return null;
  }
};

/**
 * Check if a video can be accessed (not part of a premiere or premiere has started)
 * Returns { canAccess: boolean, premiere: Premiere | null, message: string }
 */
const checkVideoAccess = async (videoId, user = null) => {
  const premiere = await getActivePremiereForVideo(videoId);
  
  // If not part of a premiere, allow access
  if (!premiere) {
    return { canAccess: true, premiere: null, message: null };
  }
  
  // Admins can always access premiere videos
  if (user && user.role === 'admin') {
    return { canAccess: true, premiere, message: null };
  }
  
  // If premiere is live, allow access (but should be through premiere interface)
  if (premiere.status === 'live') {
    return { canAccess: true, premiere, message: 'This video is part of a live premiere' };
  }
  
  // If premiere is scheduled and hasn't started, deny access
  if (premiere.status === 'scheduled') {
    const now = new Date();
    if (premiere.startTime > now) {
      return { 
        canAccess: false, 
        premiere, 
        message: 'This video is part of a scheduled premiere and is not yet available. Please wait for the premiere to start.' 
      };
    }
    // If start time has passed but status hasn't updated, allow access
    return { canAccess: true, premiere, message: null };
  }
  
  return { canAccess: true, premiere, message: null };
};

const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const { title, description, category, tags, isForPremiere } = req.body;
    
    // Calculate SHA-256 hash of the uploaded file
    let sha256Hash = null;
    try {
      sha256Hash = await calculateFileHash(req.file.path);
      console.log(`Calculated SHA-256 hash for video: ${sha256Hash.substring(0, 16)}...`);
    } catch (hashError) {
      console.error('Error calculating file hash:', hashError);
      // Don't fail upload if hash calculation fails, but log the error
    }
    
    // Create video record
    const video = new Video({
      title,
      description,
      category: category || 'other',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      uploadedBy: req.user.id,
      isForPremiere: isForPremiere === 'true' || isForPremiere === true,
      originalFile: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      sha256Hash: sha256Hash,
      status: 'uploading'
    });

    await video.save();

    // Add video to processing queue
    videoQueue.addToQueue(video._id, req.file.path);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully. Added to processing queue.',
      data: { 
        video,
        queueStatus: videoQueue.getQueueStatus()
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
};

// Get queue status endpoint
const getQueueStatus = async (req, res) => {
  try {
    const status = videoQueue.getQueueStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status',
      error: error.message
    });
  }
};

const getVideos = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { isPublic: true };
    
    // Only show ready videos to public users (not processing/uploading)
    // Admins can see all via /admin/all endpoint
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'ready';
      // Exclude premiere-only videos from public listings
      query.isForPremiere = { $ne: true };
    } else if (status) {
      // Admin can filter by status
      query.status = status;
    }
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all videos matching the query
    const allVideos = await Video.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out videos that are part of active/scheduled premieres (unless admin)
    let videos = allVideos;
    if (!req.user || req.user.role !== 'admin') {
      // First, filter out videos marked as isForPremiere
      videos = allVideos.filter(video => video.isForPremiere !== true);
      
      // Then, also filter out videos that are part of active premieres
      const videoIds = videos.map(v => v._id);
      
      // Find all premieres that include these videos
      const activePremieres = await Premiere.find({
        video: { $in: videoIds },
        status: { $in: ['scheduled', 'live'] },
        isActive: true
      }).select('video status startTime');
      
      const premiereVideoIds = new Set(activePremieres.map(p => p.video.toString()));
      
      // Filter out videos that are part of active premieres
      videos = videos.filter(video => !premiereVideoIds.has(video._id.toString()));
    }

    // Recalculate total excluding premiere videos
    let total = await Video.countDocuments(query);
    if (!req.user || req.user.role !== 'admin') {
      const allVideoIds = await Video.find(query).select('_id');
      const allIds = allVideoIds.map(v => v._id);
      const premiereVideos = await Premiere.find({
        video: { $in: allIds },
        status: { $in: ['scheduled', 'live'] },
        isActive: true
      }).select('video');
      const premiereIds = new Set(premiereVideos.map(p => p.video.toString()));
      total = allIds.filter(id => !premiereIds.has(id.toString())).length;
    }

    // Add CDN URLs to videos
    const videosWithCdn = addCdnUrlsToVideos(videos);

    // Add isLiked status for each video if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const videosWithLikeStatus = videosWithCdn.map(video => {
      const videoObj = typeof video.toObject === 'function' ? video.toObject() : video;
      if (userId && video.likedBy && Array.isArray(video.likedBy)) {
        videoObj.isLiked = video.likedBy.some(
          likeId => likeId && likeId.toString() === userId.toString()
        );
      } else {
        videoObj.isLiked = false;
      }
      return videoObj;
    });

    res.json({
      success: true,
      data: {
        videos: videosWithLikeStatus,
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
      message: 'Failed to fetch videos',
      error: error.message
    });
  }
};

const getFeaturedVideos = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get featured videos that are ready for playback
    const allFeaturedVideos = await Video.find({
      isPublic: true,
      isFeatured: true,
      status: 'ready',
      // Exclude premiere-only videos from featured listings (unless admin)
      ...((!req.user || req.user.role !== 'admin') ? { isForPremiere: { $ne: true } } : {})
    })
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Filter out premiere videos (unless admin)
    let videos = allFeaturedVideos;
    if (!req.user || req.user.role !== 'admin') {
      const videoIds = allFeaturedVideos.map(v => v._id);
      const activePremieres = await Premiere.find({
        video: { $in: videoIds },
        status: { $in: ['scheduled', 'live'] },
        isActive: true
      }).select('video');
      const premiereVideoIds = new Set(activePremieres.map(p => p.video.toString()));
      videos = allFeaturedVideos.filter(video => !premiereVideoIds.has(video._id.toString()));
    }

    // If no featured videos, return latest ready videos (excluding premieres)
    if (videos.length === 0) {
      const allLatestVideos = await Video.find({
        isPublic: true,
        status: 'ready',
        // Exclude premiere-only videos from fallback listings (unless admin)
        ...((!req.user || req.user.role !== 'admin') ? { isForPremiere: { $ne: true } } : {})
      })
        .populate('uploadedBy', 'username email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      // Filter out premiere videos
      let latestVideos = allLatestVideos;
      if (!req.user || req.user.role !== 'admin') {
        const latestVideoIds = allLatestVideos.map(v => v._id);
        const latestPremieres = await Premiere.find({
          video: { $in: latestVideoIds },
          status: { $in: ['scheduled', 'live'] },
          isActive: true
        }).select('video');
        const latestPremiereIds = new Set(latestPremieres.map(p => p.video.toString()));
        latestVideos = allLatestVideos.filter(video => !latestPremiereIds.has(video._id.toString()));
      }

      return res.json({
        success: true,
        data: {
          videos: latestVideos,
          isFallback: true,
          message: 'No featured videos available, showing latest videos'
        }
      });
    }

    res.json({
      success: true,
      data: {
        videos,
        isFallback: false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured videos',
      error: error.message
    });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('uploadedBy', 'username email');

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Check if video is part of a premiere and if access should be restricted
    const accessCheck = await checkVideoAccess(req.params.id, req.user);
    
    if (!accessCheck.canAccess) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message || 'This video is not available yet',
        data: {
          premiere: accessCheck.premiere ? {
            title: accessCheck.premiere.title,
            startTime: accessCheck.premiere.startTime,
            status: accessCheck.premiere.status
          } : null
        }
      });
    }

    // Add isLiked status if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const videoObj = video.toObject();
    if (userId && video.likedBy && Array.isArray(video.likedBy)) {
      videoObj.isLiked = video.likedBy.some(
        likeId => likeId && likeId.toString() === userId.toString()
      );
    } else {
      videoObj.isLiked = false;
    }

    res.json({
      success: true,
      data: { video: videoObj }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video',
      error: error.message
    });
  }
};

const getUserVideos = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const videos = await Video.find({ uploadedBy: req.user.id })
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Video.countDocuments({ uploadedBy: req.user.id });

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
      message: 'Failed to fetch user videos',
      error: error.message
    });
  }
};

const updateVideo = async (req, res) => {
  try {
    const { title, description, category, tags, isPublic } = req.body;
    
    const video = await Video.findOne({
      _id: req.params.id,
      uploadedBy: req.user.id
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found or access denied'
      });
    }

    if (title) video.title = title;
    if (description) video.description = description;
    if (category) video.category = category;
    if (tags) video.tags = tags.split(',').map(tag => tag.trim());
    if (typeof isPublic !== 'undefined') video.isPublic = isPublic;

    await video.save();

    res.json({
      success: true,
      message: 'Video updated successfully',
      data: { video }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update video',
      error: error.message
    });
  }
};

const deleteVideo = async (req, res) => {
  try {
    // Find video
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // ONLY admins can delete videos - no exceptions
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can delete videos.'
      });
    }

    // Delete files
    try {
      if (video.originalFile?.path) {
        try {
          await fs.unlink(video.originalFile.path);
          console.log(`Deleted original file: ${video.originalFile.path}`);
        } catch (unlinkError) {
          if (unlinkError.code === 'ENOENT') {
            console.log(`Original file not found (already deleted): ${video.originalFile.path}`);
          } else {
            throw unlinkError;
          }
        }
      }
      
      const processedDir = path.join(__dirname, '../../uploads/videos/processed', video._id.toString());
      try {
        await fs.rmdir(processedDir, { recursive: true });
        console.log(`Deleted processed directory: ${processedDir}`);
      } catch (dirError) {
        if (dirError.code === 'ENOENT') {
          console.log(`Processed directory not found (already deleted): ${processedDir}`);
        } else {
          console.log(`Could not delete processed directory: ${dirError.message}`);
        }
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    await Video.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Video deleted successfully by administrator'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete video',
      error: error.message
    });
  }
};

const getVideoStatus = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    res.json({
      success: true,
      data: {
        status: video.status,
        processingProgress: video.processingProgress || 0,
        error: video.processingError
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get video status',
      error: error.message
    });
  }
};

// Track video view (only track once per session)
const trackVideoView = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query; // Session ID to prevent duplicate tracking

    // Check if video exists
    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Note: We rely on frontend sessionStorage to prevent duplicate calls
    // For production, consider using Redis or a ViewTracking collection
    
    // Increment view count atomically (only once per session)
    const updated = await Video.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).catch(err => {
      console.error('Failed to update view count:', err);
      return null;
    });

    // Return success response
    res.json({
      success: true,
      message: 'View tracked',
      data: {
        videoId: id,
        views: updated ? updated.views : video.views + 1
      }
    });
  } catch (error) {
    console.error('View tracking error:', error);
    // Don't fail the request - view tracking is non-critical
    res.status(200).json({
      success: true,
      message: 'View tracking attempted'
    });
  }
};

// Download video (original file in best quality)
const downloadVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.user.id;

    // Find video
    const video = await Video.findById(videoId);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Check if video is public and ready
    if (!video.isPublic || video.status !== 'ready') {
      return res.status(403).json({
        success: false,
        message: 'Video is not available for download'
      });
    }

    // Check if original file exists
    if (!video.originalFile || !video.originalFile.filename) {
      return res.status(404).json({
        success: false,
        message: 'Video file not found'
      });
    }

    const filePath = path.join(__dirname, '../../uploads/videos/original', video.originalFile.filename);
    
    // Check if file exists
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Video file not found on server'
      });
    }

    // Track download (async, don't wait for it)
    VideoDownload.create({
      user: userId,
      video: videoId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    }).catch(err => {
      console.error('Failed to track download:', err);
      // Don't fail the download if tracking fails
    });

    const fileSize = stat.size;
    const range = req.headers.range;

    // Generate safe filename for download
    const safeTitle = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileExtension = path.extname(video.originalFile.filename);
    const downloadFilename = `${safeTitle}${fileExtension}`;

    if (range) {
      // Parse range header for partial content
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
        'Content-Type': video.originalFile.mimetype || 'video/mp4',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Cache-Control': 'no-cache'
      });

      file.pipe(res);
    } else {
      // No range requested, send entire file
      const fsSync = require('fs');
      const file = fsSync.createReadStream(filePath);

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': video.originalFile.mimetype || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Cache-Control': 'no-cache'
      });

      file.pipe(res);
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download video',
      error: error.message
    });
  }
};

// Get video hash for manual verification
const getVideoHash = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    if (!video.sha256Hash) {
      return res.status(404).json({
        success: false,
        message: 'Hash not available for this video. It may have been uploaded before hash calculation was implemented.'
      });
    }

    res.json({
      success: true,
      data: {
        videoId: video._id,
        title: video.title,
        sha256Hash: video.sha256Hash,
        uploadedAt: video.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting video hash:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video hash',
      error: error.message
    });
  }
};

// Verify video integrity
const verifyVideoIntegrity = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    if (!video.sha256Hash) {
      return res.status(400).json({
        success: false,
        message: 'Hash not available for this video. It may have been uploaded before hash calculation was implemented.',
        data: {
          videoId: video._id,
          title: video.title,
          canVerify: false
        }
      });
    }

    // Check if file was uploaded or hash string was provided
    let providedHash = null;
    
    if (req.file) {
      // File was uploaded, calculate its hash
      try {
        providedHash = await calculateFileHash(req.file.path);
        // Clean up temporary file
        await fs.unlink(req.file.path).catch(() => {
          // Ignore cleanup errors
        });
      } catch (hashError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to calculate hash of uploaded file',
          error: hashError.message
        });
      }
    } else if (req.body.hash) {
      // Hash string was provided directly
      providedHash = req.body.hash.toLowerCase().trim();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a video file or a hash string',
        data: {
          videoId: video._id,
          title: video.title
        }
      });
    }

    // Compare hashes
    const storedHash = video.sha256Hash.toLowerCase().trim();
    const matches = providedHash === storedHash;

    res.json({
      success: true,
      data: {
        videoId: video._id,
        title: video.title,
        verified: matches,
        providedHash: providedHash,
        storedHash: storedHash,
        message: matches 
          ? 'Video integrity verified. The file matches the original.' 
          : 'Video integrity check failed. The file does not match the original and may have been tampered with.',
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying video integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify video integrity',
      error: error.message
    });
  }
};

// Toggle video like
const toggleVideoLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id; // Get user ID from auth middleware
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Initialize likedBy array if it doesn't exist
    if (!video.likedBy) {
      video.likedBy = [];
    }

    const isLiked = video.likedBy.some(
      likeId => likeId && likeId.toString() === userId.toString()
    );

    let newLikes;
    let isLikedAfter;

    if (req.body.action === 'unlike') {
      // Remove user from likedBy array
      video.likedBy = video.likedBy.filter(
        likeId => likeId && likeId.toString() !== userId.toString()
      );
      newLikes = Math.max(0, video.likes - 1);
      isLikedAfter = false;
    } else {
      // Add user to likedBy array if not already liked
      if (!isLiked) {
        video.likedBy.push(userId);
        newLikes = video.likes + 1;
      } else {
        // Already liked, don't increment
        newLikes = video.likes;
      }
      isLikedAfter = true;
    }

    await Video.findByIdAndUpdate(
      id,
      { 
        $set: { 
          likes: newLikes,
          likedBy: video.likedBy
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: req.body.action === 'unlike' ? 'Unliked' : 'Liked',
      data: {
        videoId: id,
        likes: newLikes,
        isLiked: isLikedAfter
      }
    });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message
    });
  }
};

module.exports = {
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
  verifyVideoIntegrity
};
