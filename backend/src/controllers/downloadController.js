const VideoDownload = require('../models/VideoDownload');
const Video = require('../models/Video');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get download statistics
const getDownloadStats = async (req, res) => {
  try {
    // Total downloads
    const totalDownloads = await VideoDownload.countDocuments();

    // Downloads per video (top 10)
    const downloadsPerVideo = await VideoDownload.aggregate([
      {
        $group: {
          _id: '$video',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video'
        }
      },
      {
        $unwind: '$video'
      },
      {
        $project: {
          videoId: '$_id',
          videoTitle: '$video.title',
          downloadCount: '$count'
        }
      }
    ]);

    // Downloads per user (top 10)
    const downloadsPerUser = await VideoDownload.aggregate([
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          downloadCount: '$count'
        }
      }
    ]);

    // Downloads over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const downloadsOverTime = await VideoDownload.aggregate([
      {
        $match: {
          downloadedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$downloadedAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          date: '$_id',
          count: '$count'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalDownloads,
        downloadsPerVideo,
        downloadsPerUser,
        downloadsOverTime
      }
    });
  } catch (error) {
    console.error('Error getting download stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download statistics',
      error: error.message
    });
  }
};

// Get all downloads with pagination and filtering
const getAllDownloads = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userId, 
      videoId, 
      startDate, 
      endDate,
      sortBy = 'downloadedAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Build query with ObjectId validation
    const query = {};
    
    // Validate and add userId only if it's a valid ObjectId
    if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        query.user = userId;
      } else {
        // If not a valid ObjectId, no results will match (return empty)
        return res.json({
          success: true,
          data: {
            downloads: [],
            pagination: {
              current: parseInt(page),
              pages: 0,
              total: 0,
              limit: parseInt(limit)
            }
          }
        });
      }
    }
    
    // Validate and add videoId only if it's a valid ObjectId
    if (videoId) {
      if (mongoose.Types.ObjectId.isValid(videoId)) {
        query.video = videoId;
      } else {
        // If not a valid ObjectId, no results will match (return empty)
        return res.json({
          success: true,
          data: {
            downloads: [],
            pagination: {
              current: parseInt(page),
              pages: 0,
              total: 0,
              limit: parseInt(limit)
            }
          }
        });
      }
    }
    
    if (startDate || endDate) {
      query.downloadedAt = {};
      if (startDate) query.downloadedAt.$gte = new Date(startDate);
      if (endDate) query.downloadedAt.$lte = new Date(endDate);
    }

    // Only return downloads where both user and video still exist (exclude "User deleted" / "Video deleted" rows)
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
          pipeline: [{ $project: { username: 1, email: 1, profile: 1, organization: 1, contactNumber: 1, address: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'videos',
          localField: 'video',
          foreignField: '_id',
          as: 'videoDoc',
          pipeline: [{ $project: { title: 1 } }]
        }
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: '$userDoc' }, 0] },
              { $gt: [{ $size: '$videoDoc' }, 0] }
            ]
          }
        }
      },
      {
        $facet: {
          totalBranch: [{ $count: 'total' }],
          dataBranch: [
            { $sort: sortOptions },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                user: { $arrayElemAt: ['$userDoc', 0] },
                video: { $arrayElemAt: ['$videoDoc', 0] },
                downloadedAt: 1,
                ipAddress: 1,
                userAgent: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ]
        }
      }
    ];

    const result = await VideoDownload.aggregate(pipeline);
    const total = result[0]?.totalBranch?.[0]?.total ?? 0;
    const downloads = result[0]?.dataBranch ?? [];

    res.json({
      success: true,
      data: {
        downloads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting downloads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get downloads',
      error: error.message
    });
  }
};

// Get downloads by user
const getUserDownloads = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const downloads = await VideoDownload.find({ user: userId })
      .populate('user', 'username email profile organization contactNumber address')
      .populate('video', 'title description')
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VideoDownload.countDocuments({ user: userId });

    res.json({
      success: true,
      data: {
        downloads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error getting user downloads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user downloads',
      error: error.message
    });
  }
};

// Get downloads by video
const getVideoDownloads = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const downloads = await VideoDownload.find({ video: videoId })
      .populate('user', 'username email profile organization contactNumber address')
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VideoDownload.countDocuments({ video: videoId });

    res.json({
      success: true,
      data: {
        downloads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error getting video downloads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video downloads',
      error: error.message
    });
  }
};

module.exports = {
  getDownloadStats,
  getAllDownloads,
  getUserDownloads,
  getVideoDownloads
};

