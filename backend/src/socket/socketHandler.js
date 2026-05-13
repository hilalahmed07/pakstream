const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Premiere = require('../models/Premiere');
const { appConfig } = require('../config/appConfig');

class SocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: appConfig.socketCors
    });

    this.premiereRooms = new Map(); // Store premiere room data
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    // Socket authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        
        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('username email role');
            
            if (user && user.isActive) {
              socket.userId = user._id.toString();
              socket.userName = user.username;
              socket.userRole = user.role;
              console.log('Socket authenticated:', socket.userName, socket.id);
            }
          } catch (error) {
            console.log('Socket authentication failed:', error.message);
            // Continue without authentication (anonymous user)
          }
        }
        next();
      } catch (error) {
        next();
      }
    });

    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id, socket.userName || 'Anonymous');

      // Join premiere room
      socket.on('join-premiere', async (premiereId) => {
        try {
          const premiere = await Premiere.findById(premiereId)
            .populate({
              path: 'video',
              select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
            })
            .populate('createdBy', 'username');
          
          if (!premiere) {
            socket.emit('error', { message: 'Premiere not found' });
            return;
          }
          
          // Validate that video has required data for playback
          if (!premiere.video || !premiere.video.processedFiles || !premiere.video.processedFiles.hls) {
            console.error('Premiere video missing processedFiles:', premiereId);
            socket.emit('error', { message: 'Premiere video is not ready for playback' });
            return;
          }

          // Join the premiere room
          socket.join(`premiere-${premiereId}`);
          
          // Determine viewer role in this premiere
          const isAdminUser = socket.userRole === 'admin' || 
            (premiere.createdBy && socket.userId && premiere.createdBy._id?.toString?.() === socket.userId);

          // Get or create room data
          if (!this.premiereRooms.has(premiereId)) {
            // Calculate the actual start time based on when premiere started
            // If premiere is live, use its startTime, otherwise use now
            const premiereStartTime = premiere.status === 'live' 
              ? new Date(premiere.startTime) 
              : new Date();
              
            this.premiereRooms.set(premiereId, {
              viewers: new Map(), // Changed from Set to Map to track viewer playback times
              isLive: premiere.status === 'live',
              startTime: premiereStartTime, // Track when premiere started playing
              isPlaying: false,
              chat: [],
              totalViewers: 0
            });
          }

          const roomData = this.premiereRooms.get(premiereId);
          
          // Calculate the playback time based on when premiere started
          // This simulates a TV broadcast - viewers join in the middle get the live current time
          const elapsedTime = (new Date() - roomData.startTime) / 1000; // in seconds
          const currentPlaybackTime = Math.max(0, Math.min(elapsedTime, premiere.video?.duration || elapsedTime)); // Don't exceed video duration
          
          console.log('🎬 Viewer joining premiere:', {
            premiereId,
            premiereStatus: premiere.status,
            roomStartTime: roomData.startTime,
            elapsedTime,
            currentPlaybackTime,
            videoDuration: premiere.video?.duration
          });
          
          // Store viewer info with their playback position
          roomData.viewers.set(socket.id, {
            userId: socket.userId,
            joinedAt: new Date(),
            lastKnownTime: currentPlaybackTime,
            role: isAdminUser ? 'admin' : 'viewer'
          });

          // Update lifetime viewer count only once per unique user (best-effort)
          if (socket.userId) {
            const hasSeenKey = `seen-${socket.userId}`;
            if (!roomData[hasSeenKey]) {
              roomData[hasSeenKey] = true;
              await Premiere.findByIdAndUpdate(premiereId, {
                $inc: { totalViewers: 1 }
              }).catch(console.error);
            }
          }

          // Send room data to the user with their resume position
          socket.emit('premiere-joined', {
            premiere,
            viewerCount: roomData.viewers.size,
            currentTime: currentPlaybackTime, // Send calculated playback time for resume
            isPlaying: roomData.isPlaying,
            chat: roomData.chat.slice(-50) // Last 50 messages
          });

          // Notify other viewers
          socket.to(`premiere-${premiereId}`).emit('viewer-joined', {
            viewerCount: roomData.viewers.size
          });

          console.log(`User ${socket.id} joined premiere ${premiereId}`);
        } catch (error) {
          console.error('Error joining premiere:', error);
          socket.emit('error', { message: 'Failed to join premiere' });
        }
      });

      // Leave premiere room
      socket.on('leave-premiere', async (premiereId) => {
        socket.leave(`premiere-${premiereId}`);
        
        if (this.premiereRooms.has(premiereId)) {
          const roomData = this.premiereRooms.get(premiereId);
          roomData.viewers.delete(socket.id);

          // Notify other viewers
          socket.to(`premiere-${premiereId}`).emit('viewer-left', {
            viewerCount: roomData.viewers.size
          });

          // Clean up empty rooms
          if (roomData.viewers.size === 0) {
            this.premiereRooms.delete(premiereId);
          }
        }

        console.log(`User ${socket.id} left premiere ${premiereId}`);
      });

      // Admin controls
      socket.on('admin-start-premiere', async (premiereId) => {
        try {
          let premiere = await Premiere.findById(premiereId)
          .populate({
            path: 'video',
            select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
          })
          .populate('createdBy', 'username');

          if (!premiere) {
            socket.emit('error', { message: 'Premiere not found' });
            return;
          }

          // Only allow the premiere creator or admin to start
          if (!socket.userId || (socket.userRole !== 'admin' && premiere.createdBy?._id?.toString?.() !== socket.userId)) {
            socket.emit('error', { message: 'Not authorized to start premiere' });
            return;
          }

          const now = new Date();
          if (premiere.status === 'scheduled' && premiere.startTime && premiere.startTime > now) {
            socket.emit('error', { message: 'Cannot start premiere before its scheduled date and time' });
            return;
          }
          
          // Validate video data before starting
          if (!premiere.video || !premiere.video.processedFiles || !premiere.video.processedFiles.hls) {
            console.error('Cannot start premiere - video not ready:', premiereId);
            socket.emit('error', { message: 'Cannot start premiere - video is not ready for playback' });
            return;
          }

          premiere = await Premiere.findByIdAndUpdate(
            premiereId,
            {
              status: 'live',
              startTime: now,
              isActive: true
            },
            { new: true }
          )
          .populate({
            path: 'video',
            select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
          })
          .populate('createdBy', 'username');

          // Update room data with start time for TV broadcast behavior
          if (this.premiereRooms.has(premiereId)) {
            const roomData = this.premiereRooms.get(premiereId);
            roomData.isLive = true;
            roomData.isPlaying = true;
            roomData.startTime = new Date(); // Set start time when admin starts
          } else {
            // Create room data if it doesn't exist
            this.premiereRooms.set(premiereId, {
              viewers: new Map(),
              isLive: true,
              startTime: new Date(),
              isPlaying: true,
              chat: []
            });
          }

          // Notify all viewers
          this.io.to(`premiere-${premiereId}`).emit('premiere-started', {
            premiere,
            currentTime: 0,
            isPlaying: true
          });

          // Auto-play video for all viewers when admin starts premiere
          setTimeout(() => {
            this.io.to(`premiere-${premiereId}`).emit('video-play');
          }, 1000);

          console.log(`Premiere ${premiereId} started by admin`);
        } catch (error) {
          console.error('Error starting premiere:', error);
          socket.emit('error', { message: 'Failed to start premiere' });
        }
      });

      socket.on('admin-end-premiere', async (premiereId) => {
        try {
          const premiere = await Premiere.findByIdAndUpdate(
            premiereId,
            { 
              status: 'ended',
              endTime: new Date(),
              isActive: false
            },
            { new: true }
          )
          .populate({
            path: 'video',
            select: '_id title description duration resolution status processedFiles originalFile uploadedBy'
          })
          .populate('createdBy', 'username');

          if (!premiere) {
            socket.emit('error', { message: 'Premiere not found' });
            return;
          }

          // Only allow the premiere creator or admin to end
          if (!socket.userId || (socket.userRole !== 'admin' && premiere.createdBy?._id?.toString?.() !== socket.userId)) {
            socket.emit('error', { message: 'Not authorized to end premiere' });
            return;
          }

          // Update room data
          if (this.premiereRooms.has(premiereId)) {
            const roomData = this.premiereRooms.get(premiereId);
            roomData.isLive = false;
            roomData.isPlaying = false;
          }

          // Notify all viewers
          this.io.to(`premiere-${premiereId}`).emit('premiere-ended', {
            premiere
          });
          this.io.emit('premiere-status-updated', {
            premiereId: premiere._id.toString(),
            action: 'ended',
            premiere
          });

          console.log(`Premiere ${premiereId} ended by admin`);
        } catch (error) {
          console.error('Error ending premiere:', error);
          socket.emit('error', { message: 'Failed to end premiere' });
        }
      });

      // Video playback controls - ONLY admin/creator is allowed to drive these.
      // Each handler accepts an optional ack callback so the client can surface
      // failures immediately instead of silently doing nothing.
      socket.on('play-video', (premiereId, ack) => {
        const roomData = this.premiereRooms.get(premiereId);
        if (!roomData) {
          const err = { code: 'NOT_FOUND', action: 'play-video', message: 'Premiere room not active' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        const viewer = roomData.viewers.get(socket.id);
        const isAdminViewer = viewer?.role === 'admin';

        if (!isAdminViewer) {
          const err = { code: 'FORBIDDEN', action: 'play-video', message: 'Only the premiere admin can play the video' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        roomData.isPlaying = true;
        this.io.to(`premiere-${premiereId}`).emit('video-play');
        if (typeof ack === 'function') ack({ ok: true });
      });

      socket.on('pause-video', (premiereId, ack) => {
        const roomData = this.premiereRooms.get(premiereId);
        if (!roomData) {
          const err = { code: 'NOT_FOUND', action: 'pause-video', message: 'Premiere room not active' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        const viewer = roomData.viewers.get(socket.id);
        const isAdminViewer = viewer?.role === 'admin';

        if (!isAdminViewer) {
          const err = { code: 'FORBIDDEN', action: 'pause-video', message: 'Only the premiere admin can pause the video' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        roomData.isPlaying = false;
        this.io.to(`premiere-${premiereId}`).emit('video-pause');
        if (typeof ack === 'function') ack({ ok: true });
      });

      socket.on('seek-video', (premiereId, time, ack) => {
        const roomData = this.premiereRooms.get(premiereId);
        if (!roomData) {
          const err = { code: 'NOT_FOUND', action: 'seek-video', message: 'Premiere room not active' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        const viewer = roomData.viewers.get(socket.id);
        const isAdminViewer = viewer?.role === 'admin';

        if (!isAdminViewer) {
          const err = { code: 'FORBIDDEN', action: 'seek-video', message: 'Only the premiere admin can seek the video' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        // Update room-level "virtual clock" by shifting startTime based on seek
        const now = new Date();
        roomData.startTime = new Date(now.getTime() - time * 1000);

        this.io.to(`premiere-${premiereId}`).emit('video-seek', { time });
        if (typeof ack === 'function') ack({ ok: true });
      });

      // Chat functionality
      socket.on('send-message', (premiereId, message, username, ack) => {
        if (!this.premiereRooms.has(premiereId)) {
          const err = { code: 'NOT_FOUND', action: 'send-message', message: 'Premiere room not active' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        const roomData = this.premiereRooms.get(premiereId);
        const viewer = roomData.viewers.get(socket.id);
        if (!viewer) {
          const err = { code: 'FORBIDDEN', action: 'send-message', message: 'Join the premiere room before sending messages' };
          socket.emit('error', err);
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        const text = String(message || '').trim();
        if (!text) {
          const err = { code: 'VALIDATION', action: 'send-message', message: 'Message cannot be empty' };
          if (typeof ack === 'function') ack({ ok: false, error: err });
          return;
        }

        // Use provided username, socket.userName, or fallback to Anonymous
        const displayName = username || socket.userName || 'Anonymous';

        const chatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user: displayName,
          message: text,
          timestamp: new Date()
        };

        roomData.chat.push(chatMessage);

        // Keep only last 100 messages
        if (roomData.chat.length > 100) {
          roomData.chat = roomData.chat.slice(-100);
        }

        // Always echo to sender + everyone else in room.
        socket.emit('new-message', chatMessage);
        socket.to(`premiere-${premiereId}`).emit('new-message', chatMessage);
        if (typeof ack === 'function') ack({ ok: true });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove from all premiere rooms
        for (const [premiereId, roomData] of this.premiereRooms.entries()) {
          if (roomData.viewers.has(socket.id)) {
            roomData.viewers.delete(socket.id);

            // Notify other viewers
            socket.to(`premiere-${premiereId}`).emit('viewer-left', {
              viewerCount: roomData.viewers.size
            });
            
            // Clean up empty rooms
            if (roomData.viewers.size === 0) {
              this.premiereRooms.delete(premiereId);
            }
          }
        }
      });
    });
  }

  // Method to get room data
  getRoomData(premiereId) {
    return this.premiereRooms.get(premiereId);
  }

  // Method to broadcast to all users
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Method to broadcast to specific premiere
  broadcastToPremiere(premiereId, event, data) {
    this.io.to(`premiere-${premiereId}`).emit(event, data);
  }
}

module.exports = SocketHandler;
