const Premiere = require('../models/Premiere');

function startPremiereScheduler(io, intervalMs = 15000) {
  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const now = new Date();

      // Auto-start scheduled premieres whose time has arrived.
      const scheduledPremieres = await Premiere.find({
        status: 'scheduled',
        isActive: true,
        startTime: { $lte: now },
      })
        .populate({
          path: 'video',
          select: '_id title description duration resolution status processedFiles originalFile uploadedBy',
        })
        .populate('createdBy', 'username');

      for (const premiere of scheduledPremieres) {
        premiere.status = 'live';
        await premiere.save();

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

      // Auto-end live premieres whose end time has passed.
      const livePremieresToEnd = await Premiere.find({
        status: 'live',
        isActive: true,
        endTime: { $lte: now },
      })
        .populate({
          path: 'video',
          select: '_id title description duration resolution status processedFiles originalFile uploadedBy',
        })
        .populate('createdBy', 'username');

      for (const premiere of livePremieresToEnd) {
        premiere.status = 'ended';
        premiere.isActive = false;
        await premiere.save();

        io.emit('premiere-ended', { premiere });
        io.emit('premiere-status-updated', {
          premiereId: premiere._id.toString(),
          action: 'ended',
          premiere,
        });
      }
    } catch (error) {
      console.error('Premiere scheduler error:', error.message);
    } finally {
      isRunning = false;
    }
  };

  // Run once on startup, then poll.
  tick();
  const timer = setInterval(tick, intervalMs);

  return () => clearInterval(timer);
}

module.exports = { startPremiereScheduler };
