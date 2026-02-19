const User = require('../models/User');
const Video = require('../models/Video');
const Document = require('../models/Document');
const Presentation = require('../models/Presentation');

/**
 * Get analytics summary - platform totals, active users, top content, top users.
 * Requires admin authentication.
 */
const getSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Platform totals
    const [totalUsers, totalVideos, totalDocuments, totalPresentations] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Video.countDocuments(),
      Document.countDocuments(),
      Presentation.countDocuments()
    ]);

    // Active users: users with lastLogin in period
    const [dau, mau] = await Promise.all([
      User.countDocuments({ lastLogin: { $gte: startOfDay }, isActive: true }),
      User.countDocuments({ lastLogin: { $gte: startOfMonth }, isActive: true })
    ]);

    // Total views across content types
    const [videoViews, documentViews, presentationViews] = await Promise.all([
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Document.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Presentation.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }])
    ]);

    const totalViews =
      (videoViews[0]?.total || 0) +
      (documentViews[0]?.total || 0) +
      (presentationViews[0]?.total || 0);

    // Top videos by views (limit 10)
    const topVideos = await Video.find({ status: 'ready' })
      .select('title views likes uploadedBy createdAt')
      .populate('uploadedBy', 'username')
      .sort({ views: -1 })
      .limit(10)
      .lean();

    // Top documents by views (limit 10)
    const topDocuments = await Document.find({ status: 'ready' })
      .select('title views likes uploadedBy createdAt')
      .populate('uploadedBy', 'username')
      .sort({ views: -1 })
      .limit(10)
      .lean();

    // Top presentations by views (limit 10)
    const topPresentations = await Presentation.find({ status: 'ready' })
      .select('title views likes uploadedBy createdAt')
      .populate('uploadedBy', 'username')
      .sort({ views: -1 })
      .limit(10)
      .lean();

    // Top users by content engagement (upload count + total views on their content)
    const topUsersByVideos = await Video.aggregate([
      { $match: { status: 'ready' } },
      { $group: { _id: '$uploadedBy', videoCount: { $sum: 1 }, videoViews: { $sum: '$views' }, videoLikes: { $sum: '$likes' } } }
    ]);
    const topUsersByDocs = await Document.aggregate([
      { $match: { status: 'ready' } },
      { $group: { _id: '$uploadedBy', docCount: { $sum: 1 }, docViews: { $sum: '$views' }, docLikes: { $sum: '$likes' } } }
    ]);
    const topUsersByPres = await Presentation.aggregate([
      { $match: { status: 'ready' } },
      { $group: { _id: '$uploadedBy', presCount: { $sum: 1 }, presViews: { $sum: '$views' }, presLikes: { $sum: '$likes' } } }
    ]);

    // Merge user stats by _id
    const userStatsMap = new Map();
    for (const row of topUsersByVideos) {
      const id = row._id?.toString();
      if (!id) continue;
      const existing = userStatsMap.get(id) || { uploadCount: 0, totalViews: 0, totalLikes: 0 };
      existing.uploadCount += row.videoCount || 0;
      existing.totalViews += row.videoViews || 0;
      existing.totalLikes += row.videoLikes || 0;
      userStatsMap.set(id, existing);
    }
    for (const row of topUsersByDocs) {
      const id = row._id?.toString();
      if (!id) continue;
      const existing = userStatsMap.get(id) || { uploadCount: 0, totalViews: 0, totalLikes: 0 };
      existing.uploadCount += row.docCount || 0;
      existing.totalViews += row.docViews || 0;
      existing.totalLikes += row.docLikes || 0;
      userStatsMap.set(id, existing);
    }
    for (const row of topUsersByPres) {
      const id = row._id?.toString();
      if (!id) continue;
      const existing = userStatsMap.get(id) || { uploadCount: 0, totalViews: 0, totalLikes: 0 };
      existing.uploadCount += row.presCount || 0;
      existing.totalViews += row.presViews || 0;
      existing.totalLikes += row.presLikes || 0;
      userStatsMap.set(id, existing);
    }

    const topUserIds = Array.from(userStatsMap.entries())
      .sort((a, b) => (b[1].totalViews + b[1].totalLikes) - (a[1].totalViews + a[1].totalLikes))
      .slice(0, 10)
      .map(([id]) => id);

    const users = await User.find({ _id: { $in: topUserIds } })
      .select('username email')
      .lean();

    const topUsers = topUserIds.map((id) => {
      const stats = userStatsMap.get(id) || { uploadCount: 0, totalViews: 0, totalLikes: 0 };
      const user = users.find((u) => u._id.toString() === id);
      return {
        _id: id,
        username: user?.username || 'Unknown',
        email: user?.email || '',
        uploadCount: stats.uploadCount,
        totalViews: stats.totalViews,
        totalLikes: stats.totalLikes
      };
    });

    res.json({
      success: true,
      data: {
        platform: {
          totalUsers,
          totalVideos,
          totalDocuments,
          totalPresentations,
          totalContent: totalVideos + totalDocuments + totalPresentations,
          totalViews
        },
        activeUsers: {
          dau,
          mau
        },
        topVideos,
        topDocuments,
        topPresentations,
        topUsers
      }
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};

module.exports = {
  getSummary
};
