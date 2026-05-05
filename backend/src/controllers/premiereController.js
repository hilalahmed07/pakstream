const Premiere = require('../models/Premiere');
const Video = require('../models/Video');
const { ensureUniqueTitle } = require('../utils/uniqueTitle');

const PREMIERE_TITLE_MAX = 90;
const PREMIERE_DESCRIPTION_MAX = 180;

const normalizePremiereDescription = (value) => String(value || '').trim();

const createPremiere = async (req, res) => {
  try {
    const { videoId, title, description, startTime, duration } = req.body;

    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Reject start times in the past. Allow a 1-minute grace window for clock
    // skew between admin machine and server.
    if (startTime) {
      const requested = new Date(startTime);
      if (Number.isNaN(requested.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start time'
        });
      }
      const nowMinus1m = new Date(Date.now() - 60 * 1000);
      if (requested < nowMinus1m) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in the future'
        });
      }
    }

    // Check if there's already an active premiere
    const activePremiere = await Premiere.findOne({
      status: { $in: ['scheduled', 'live'] },
      isActive: true
    });

    if (activePremiere) {
      return res.status(409).json({
        success: false,
        message: 'There is already an active premiere. Please end it first.'
      });
    }

    // Calculate start and end times
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + (duration || video.duration) * 1000);

    const rawPremiereTitle = String(title || video.title || 'Premiere').trim() || 'Premiere';
    const rawPremiereDescription = normalizePremiereDescription(description || video.description || '');

    if (rawPremiereTitle.length > PREMIERE_TITLE_MAX) {
      return res.status(400).json({
        success: false,
        message: `Title must be ${PREMIERE_TITLE_MAX} characters or fewer`
      });
    }

    if (rawPremiereDescription.length > PREMIERE_DESCRIPTION_MAX) {
      return res.status(400).json({
        success: false,
        message: `Description must be ${PREMIERE_DESCRIPTION_MAX} characters or fewer`
      });
    }

    const resolvedPremiereTitle = await ensureUniqueTitle(Premiere, rawPremiereTitle, {
      maxLength: PREMIERE_TITLE_MAX,
    });

    const premiere = new Premiere({
      video: videoId,
      title: resolvedPremiereTitle,
      description: rawPremiereDescription,
      startTime: start,
      endTime: end,
      createdBy: req.user.id,
      status: start <= new Date() ? 'live' : 'scheduled'
    });

    await premiere.save();
    
    // Mark video as premiere-only so it stays out of the main "all videos" list
    await Video.findByIdAndUpdate(videoId, { isForPremiere: true });

    await premiere.populate({
      path: 'video',
      select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
    });

    res.status(201).json({
      success: true,
      message: 'Premiere created successfully',
      data: { premiere }
    });
  } catch (error) {
    console.error('Create premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create premiere',
      error: error.message
    });
  }
};

const getActivePremiere = async (req, res) => {
  try {
    const premiere = await Premiere.findOne({ 
      status: { $in: ['scheduled', 'live'] },
      isActive: true
    })
    .populate({
      path: 'video',
      select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
    })
    .populate('createdBy', 'username');

    if (!premiere) {
      return res.json({
        success: true,
        data: { premiere: null }
      });
    }

    // Update status if needed. When the scheduled startTime has passed, flip
    // the premiere to 'live' and broadcast the transition so every connected
    // admin dashboard AND every user's live-premiere modal updates without a
    // manual refresh. Without this broadcast, admin windows and countdown
    // dialogs can get stuck in an in-between state until the next page reload.
    const now = new Date();
    if (premiere.status === 'scheduled' && premiere.startTime <= now) {
      premiere.status = 'live';
      await premiere.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('premiere-started', {
          premiere,
          currentTime: 0,
          isPlaying: false,
        });
        io.emit('premiere-status-updated', {
          premiereId: premiere._id.toString(),
          action: 'started',
          premiere,
        });
      }
    }

    // Similarly auto-end premieres whose endTime has passed so viewers don't
    // see a stuck "live" state after the video should be over.
    if (premiere.status === 'live' && premiere.endTime && premiere.endTime <= now) {
      premiere.status = 'ended';
      premiere.isActive = false;
      await premiere.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('premiere-ended', { premiere });
        io.emit('premiere-status-updated', {
          premiereId: premiere._id.toString(),
          action: 'ended',
          premiere,
        });
      }

      return res.json({
        success: true,
        data: { premiere: null }, // treat as no active premiere now
      });
    }

    res.json({
      success: true,
      data: { premiere }
    });
  } catch (error) {
    console.error('Get active premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active premiere',
      error: error.message
    });
  }
};

const getPremiereById = async (req, res) => {
  try {
    const premiere = await Premiere.findById(req.params.id)
      .populate({
        path: 'video',
        select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
      })
      .populate('createdBy', 'username');

    if (!premiere) {
      return res.status(404).json({
        success: false,
        message: 'Premiere not found'
      });
    }

    res.json({
      success: true,
      data: { premiere }
    });
  } catch (error) {
    console.error('Get premiere by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get premiere',
      error: error.message
    });
  }
};

const getUpcomingPremieres = async (req, res) => {
  try {
    const now = new Date();
    
    // Get scheduled premieres and live premieres, sorted by start time
    const premieres = await Premiere.find({
      status: { $in: ['scheduled', 'live'] },
      isActive: true,
      startTime: { $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } // Within 7 days
    })
      .populate({
        path: 'video',
        select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
      })
      .populate('createdBy', 'username')
      .sort({ startTime: 1 }) // Sort by start time ascending
      .limit(12);

    res.json({
      success: true,
      data: { premieres }
    });
  } catch (error) {
    console.error('Get upcoming premieres error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming premieres',
      error: error.message
    });
  }
};

const getAllPremieres = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    const premieres = await Premiere.find(query)
      .populate({
        path: 'video',
        select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
      })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Premiere.countDocuments(query);

    res.json({
      success: true,
      data: {
        premieres,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get premieres error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get premieres',
      error: error.message
    });
  }
};

const joinPremiere = async (req, res) => {
  try {
    const premiere = await Premiere.findOne({ 
      status: 'live',
      isActive: true
    });

    if (!premiere) {
      return res.status(404).json({
        success: false,
        message: 'No active premiere found'
      });
    }

    // Add viewer if not already joined
    const existingViewer = premiere.viewers.find(
      viewer => viewer.user.toString() === req.user.id
    );

    if (!existingViewer) {
      premiere.viewers.push({ user: req.user.id });
      premiere.totalViewers += 1;
      await premiere.save();
    }

    res.json({
      success: true,
      message: 'Joined premiere successfully',
      data: { premiere }
    });
  } catch (error) {
    console.error('Join premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join premiere',
      error: error.message
    });
  }
};

const endPremiere = async (req, res) => {
  try {
    const premiere = await Premiere.findOne({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!premiere) {
      return res.status(404).json({
        success: false,
        message: 'Premiere not found or access denied'
      });
    }

    premiere.status = 'ended';
    premiere.isActive = false;
    await premiere.save();

    res.json({
      success: true,
      message: 'Premiere ended successfully',
      data: { premiere }
    });
  } catch (error) {
    console.error('End premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end premiere',
      error: error.message
    });
  }
};

const updatePremiere = async (req, res) => {
  try {
    const { title, description, startTime, duration } = req.body;
    
    const premiere = await Premiere.findOne({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!premiere) {
      return res.status(404).json({
        success: false,
        message: 'Premiere not found or access denied'
      });
    }

    if (premiere.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update live premiere'
      });
    }

    if (title) {
      const trimmedTitle = String(title).trim();
      if (trimmedTitle.length > PREMIERE_TITLE_MAX) {
        return res.status(400).json({
          success: false,
          message: `Title must be ${PREMIERE_TITLE_MAX} characters or fewer`
        });
      }

      premiere.title = await ensureUniqueTitle(Premiere, String(title).trim(), {
        excludeId: premiere._id,
        maxLength: PREMIERE_TITLE_MAX,
      });
    }
    if (description !== undefined) {
      const trimmedDescription = normalizePremiereDescription(description);
      if (trimmedDescription.length > PREMIERE_DESCRIPTION_MAX) {
        return res.status(400).json({
          success: false,
          message: `Description must be ${PREMIERE_DESCRIPTION_MAX} characters or fewer`
        });
      }
      premiere.description = trimmedDescription;
    }
    if (startTime) {
      premiere.startTime = new Date(startTime);
      if (duration) {
        premiere.endTime = new Date(premiere.startTime.getTime() + duration * 1000);
      }
    }

    await premiere.save();

    res.json({
      success: true,
      message: 'Premiere updated successfully',
      data: { premiere }
    });
  } catch (error) {
    console.error('Update premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update premiere',
      error: error.message
    });
  }
};

const deletePremiere = async (req, res) => {
  try {
    const premiere = await Premiere.findOne({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!premiere) {
      return res.status(404).json({
        success: false,
        message: 'Premiere not found or access denied'
      });
    }

    if (premiere.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete live premiere'
      });
    }

    await Premiere.findByIdAndDelete(req.params.id);

    // Broadcast so other admin sessions update their dashboards live without
    // needing a manual refresh. Emitted globally because the premiere room is
    // gone after delete — any connected admin should see it.
    const io = req.app.get('io');
    if (io) {
      io.emit('premiere-deleted', { premiereId: req.params.id });
    }

    res.json({
      success: true,
      message: 'Premiere deleted successfully'
    });
  } catch (error) {
    console.error('Delete premiere error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete premiere',
      error: error.message
    });
  }
};

module.exports = {
  createPremiere,
  getActivePremiere,
  getPremiereById,
  getUpcomingPremieres,
  getAllPremieres,
  joinPremiere,
  endPremiere,
  updatePremiere,
  deletePremiere
};
