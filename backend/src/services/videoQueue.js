const Video = require('../models/Video');
const VideoProcessor = require('./videoProcessor');
const path = require('path');
const storageService = require('./storageService');
const { isMinIOEnabled } = require('../config/storage');

class VideoQueue {
  constructor(maxConcurrent = 1) { // Reduce to 1 to prevent memory issues
    this.queue = [];
    this.processing = new Map();
    this.maxConcurrent = maxConcurrent;
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  addToQueue(videoId, inputPath) {
    const job = { videoId, inputPath, addedAt: Date.now() };
    this.queue.push(job);

    console.log(`Added video ${videoId} to processing queue. Queue length: ${this.queue.length}`);

    // Try to process immediately if slots available
    this.processNext();

    return job;
  }

  async processNext() {
    // Check if we can process more videos
    if (this.processing.size >= this.maxConcurrent) {
      console.log(`Max concurrent processing limit reached (${this.maxConcurrent}). Waiting...`);
      return;
    }

    // Get next job from queue
    if (this.queue.length === 0) {
      console.log('Queue is empty');
      return;
    }

    const job = this.queue.shift();
    console.log(`Starting to process video ${job.videoId}. Active jobs: ${this.processing.size + 1}/${this.maxConcurrent}`);

    // Mark as processing
    this.processing.set(job.videoId, job);

    // Process the video
    try {
      await this.processVideo(job.videoId, job.inputPath);
    } catch (error) {
      console.error(`Error processing video ${job.videoId}:`, error);
    } finally {
      // Remove from processing map
      this.processing.delete(job.videoId);

      // Process next video in queue
      this.processNext();
    }
  }

  async processVideo(videoId, inputPath) {
    try {
      const video = await Video.findById(videoId);
      if (!video) {
        console.error(`Video ${videoId} not found`);
        return;
      }

      video.status = 'processing';
      await video.save();

      const outputDir = path.join(__dirname, '../../uploads/videos/processed', videoId.toString());

      const videoProcessor = new VideoProcessor();
      const processedData = await videoProcessor.processVideo(videoId, inputPath, outputDir, this.io);

      video.status = 'ready';
      video.duration = processedData.duration;
      video.resolution = processedData.resolution;
      video.fileSize = processedData.fileSize;
      video.processedFiles = processedData.processedFiles;

      await video.save();

      // --- START MINIO CONVERSION ---
      // This section uploads processed files to MinIO/Storage Service
      try {
        console.log(`Uploading processed files for video ${videoId} to storage...`);

        // 1. Upload original video
        const originalObjectName = `original/${video.originalFile.filename}`;
        await storageService.uploadFile(inputPath, originalObjectName, video.originalFile.mimetype);

        // 2. Upload HLS files (master playlist, variants, segments, thumbnails)
        const hlsDir = path.join(outputDir, 'hls');
        const remoteHlsDir = `processed/${videoId}/hls`;
        await storageService.uploadDirectory(hlsDir, remoteHlsDir);

        console.log(`All files for video ${videoId} uploaded to storage service successfully`);
      } catch (uploadError) {
        console.error(`Failed to upload files for video ${videoId} to storage:`, uploadError);
        // We don't mark as error because local files still exist as fallback
      }
      // --- END MINIO CONVERSION ---

      console.log(`Video processing completed for ${videoId}`);

      // Emit completion event
      if (this.io) {
        this.io.emit('videoProcessingComplete', {
          videoId,
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Video processing error:', error);

      const video = await Video.findById(videoId);
      if (video) {
        video.status = 'error';
        video.processingError = error.message;
        await video.save();

        // Emit error event
        if (this.io) {
          this.io.emit('videoProcessingError', {
            videoId,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      throw error;
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: Array.from(this.processing.keys()),
      activeJobs: this.processing.size,
      maxConcurrent: this.maxConcurrent
    };
  }

  isProcessing(videoId) {
    return this.processing.has(videoId);
  }

  isQueued(videoId) {
    return this.queue.some(job => job.videoId === videoId);
  }

  removeFromQueue(videoId) {
    const index = this.queue.findIndex(job => job.videoId === videoId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`Removed video ${videoId} from queue`);
      return true;
    }
    return false;
  }

  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    console.log(`Cleared ${count} jobs from queue`);
    return count;
  }
}

// Create singleton instance
// Set maxConcurrent to 2 to allow parallel processing without overwhelming the system
const videoQueue = new VideoQueue(2);

module.exports = videoQueue;

