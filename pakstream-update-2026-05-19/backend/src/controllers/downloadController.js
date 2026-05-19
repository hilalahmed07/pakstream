const Download = require('../models/Download');
const Video = require('../models/Video');
const Document = require('../models/Document');
const Presentation = require('../models/Presentation');
const Patch = require('../models/Patch');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get download statistics
const getDownloadStats = async (req, res) => {
  try {
    // Total downloads
    const totalDownloads = await Download.countDocuments();

    // Downloads per asset (top 10 across all types)
    const downloadsPerAsset = await Download.aggregate([
      {
        $group: {
          _id: { assetType: '$assetType', assetId: '$assetId' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
    ]);

    // Look up asset titles per type
    const assetLookups = await Promise.all(
      downloadsPerAsset.map(async (item) => {
        const { assetType, assetId } = item._id;
        let title = 'Unknown';

        try {
          if (assetType === 'video') {
            const video = await Video.findById(assetId).select('title').lean();
            if (video) title = video.title;
          } else if (assetType === 'document') {
            const document = await Document.findById(assetId).select('title').lean();
            if (document) title = document.title;
          } else if (assetType === 'presentation') {
            const presentation = await Presentation.findById(assetId).select('title').lean();
            if (presentation) title = presentation.title;
          } else if (assetType === 'patch') {
            const patch = await Patch.findById(assetId).select('title').lean();
            if (patch) title = patch.title;
          }
        } catch (e) {
          // If lookup fails, keep default title
        }

        return {
          assetType,
          assetId,
          assetTitle: title,
          downloadCount: item.count,
        };
      })
    );

    // For backwards compatibility, derive downloadsPerVideo from unified data
    const downloadsPerVideo = assetLookups
      .filter((item) => item.assetType === 'video')
      .map((item) => ({
        videoId: item.assetId,
        videoTitle: item.assetTitle,
        downloadCount: item.downloadCount,
      }));

    // Downloads per user (top 10)
    const downloadsPerUser = await Download.aggregate([
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

    const downloadsOverTime = await Download.aggregate([
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
        downloadsPerAsset: assetLookups,
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
      assetType,
      assetId, 
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

    if (assetType) {
      query.assetType = assetType;
    }

    // Validate and add assetId only if it's a valid ObjectId
    if (assetId) {
      if (mongoose.Types.ObjectId.isValid(assetId)) {
        query.assetId = assetId;
      } else {
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
      if (endDate) {
        // <input type="date"> sends a bare YYYY-MM-DD, which `new Date(...)`
        // parses as midnight UTC. Using that as $lte excludes everything
        // that happened later the same day. Push the bound to the very end
        // of the selected day so the End Date filter is inclusive.
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.downloadedAt.$lte = end;
      }
    }

    // Only return downloads where both user and asset still exist
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
          pipeline: [
            {
              $project: {
                username: 1,
                email: 1,
                profile: 1,
                organization: 1,
                contactNumber: 1,
                address: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'videos',
          localField: 'assetId',
          foreignField: '_id',
          as: 'videoDoc',
          pipeline: [{ $project: { title: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'documents',
          localField: 'assetId',
          foreignField: '_id',
          as: 'documentDoc',
          pipeline: [{ $project: { title: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'presentations',
          localField: 'assetId',
          foreignField: '_id',
          as: 'presentationDoc',
          pipeline: [{ $project: { title: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'patches',
          localField: 'assetId',
          foreignField: '_id',
          as: 'patchDoc',
          pipeline: [{ $project: { title: 1 } }],
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: '$userDoc' }, 0] },
              {
                $or: [
                  { $and: [{ $eq: ['$assetType', 'video'] }, { $gt: [{ $size: '$videoDoc' }, 0] }] },
                  { $and: [{ $eq: ['$assetType', 'document'] }, { $gt: [{ $size: '$documentDoc' }, 0] }] },
                  {
                    $and: [
                      { $eq: ['$assetType', 'presentation'] },
                      { $gt: [{ $size: '$presentationDoc' }, 0] },
                    ],
                  },
                  { $and: [{ $eq: ['$assetType', 'patch'] }, { $gt: [{ $size: '$patchDoc' }, 0] }] },
                ],
              },
            ],
          },
        },
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
                assetType: 1,
                asset: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ['$assetType', 'video'] },
                        then: { $arrayElemAt: ['$videoDoc', 0] },
                      },
                      {
                        case: { $eq: ['$assetType', 'document'] },
                        then: { $arrayElemAt: ['$documentDoc', 0] },
                      },
                      {
                        case: { $eq: ['$assetType', 'presentation'] },
                        then: { $arrayElemAt: ['$presentationDoc', 0] },
                      },
                      {
                        case: { $eq: ['$assetType', 'patch'] },
                        then: { $arrayElemAt: ['$patchDoc', 0] },
                      },
                    ],
                    default: null,
                  },
                },
                assetId: 1,
                downloadedAt: 1,
                ipAddress: 1,
                userAgent: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ];

    const result = await Download.aggregate(pipeline);
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

    const downloads = await Download.find({ user: userId })
      .populate('user', 'username email profile organization contactNumber address')
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Download.countDocuments({ user: userId });

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

    const downloads = await Download.find({ assetType: 'video', assetId: videoId })
      .populate('user', 'username email profile organization contactNumber address')
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Download.countDocuments({ assetType: 'video', assetId: videoId });

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

