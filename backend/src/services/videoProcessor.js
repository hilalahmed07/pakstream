const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

// Get FFmpeg path from environment or system PATH
function getFfmpegPath() {
  // Check environment variable first
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  
  // Try to find ffmpeg in system PATH
  try {
    const ffmpegPath = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
    if (ffmpegPath) {
      return ffmpegPath;
    }
  } catch (error) {
    // FFmpeg not found in PATH, will use default
    console.warn('FFmpeg not found in PATH, using default');
  }
  
  // Default to 'ffmpeg' (assumes it's in PATH)
  return 'ffmpeg';
}

// Set FFmpeg path
const ffmpegPath = getFfmpegPath();
console.log(`Using FFmpeg at: ${ffmpegPath}`);
ffmpeg.setFfmpegPath(ffmpegPath);

class VideoProcessor {
  constructor() {
    this.qualities = [
      { resolution: '360p', width: 640, height: 360, bitrate: '500k' },
      { resolution: '480p', width: 854, height: 480, bitrate: '1000k' },
      { resolution: '720p', width: 1280, height: 720, bitrate: '2500k' },
      { resolution: '1080p', width: 1920, height: 1080, bitrate: '5000k' }
    ];
  }

  async processVideo(videoId, inputPath, outputDir, io = null) {
    try {
      console.log(`Starting video processing for ${videoId}`);
      
      // Create output directories
      const hlsDir = path.join(outputDir, 'hls');
      await fs.mkdir(hlsDir, { recursive: true });

      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);
      console.log(`Video metadata:`, metadata);
      
      // Emit progress update
      this.emitProgress(io, videoId, 10, 'Getting video metadata...');

      // Generate thumbnails (in parallel with HLS)
      const thumbnailPromise = this.generateThumbnails(inputPath, hlsDir, videoId, io);
      
      // Generate HLS variants for different qualities
      const variants = await this.generateHLSVariants(inputPath, hlsDir, videoId, metadata, io);
      
      // Wait for thumbnails to complete
      const thumbnails = await thumbnailPromise;
      
      // Only generate master playlist if we have variants
      let masterPlaylist = null;
      if (variants.length > 0) {
        masterPlaylist = await this.generateMasterPlaylist(variants, hlsDir, videoId);
        this.emitProgress(io, videoId, 95, 'Generating master playlist...');
      }
      
      console.log(`Video processing completed for ${videoId}`);
      this.emitProgress(io, videoId, 100, 'Processing completed!');
      
      return {
        duration: metadata.duration,
        resolution: metadata.resolution,
        fileSize: metadata.fileSize,
        processedFiles: {
          hls: {
            masterPlaylist,
            variants,
            segments: this.getAllSegments(variants)
          },
          thumbnails,
          poster: thumbnails[0] || null
        }
      };
    } catch (error) {
      console.error('Video processing error:', error);
      this.emitProgress(io, videoId, -1, 'The uploaded file is not a valid video. Please upload a proper video file (MP4, AVI, MOV, etc.).');
      throw error;
    }
  }

  emitProgress(io, videoId, progress, message) {
    if (io) {
      io.emit('videoProcessingProgress', {
        videoId,
        progress: Math.max(0, Math.min(100, progress)),
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getVideoMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }
        
        resolve({
          duration: parseFloat(metadata.format.duration),
          width: videoStream.width,
          height: videoStream.height,
          resolution: `${videoStream.width}x${videoStream.height}`,
          fileSize: parseInt(metadata.format.size)
        });
      });
    });
  }

  async generateThumbnails(inputPath, outputDir, videoId, io) {
    const thumbnails = [];
    const duration = await this.getVideoDuration(inputPath);
    
    // Generate 5 thumbnails evenly distributed
    for (let i = 1; i <= 5; i++) {
      const time = (duration / 6) * i;
      const thumbnailPath = path.join(outputDir, `${videoId}_thumb_${i}.jpg`);
      
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .seekInput(time)
            .frames(1)
            .size('320x180')
            .output(thumbnailPath)
            .on('end', () => {
              thumbnails.push(`${videoId}_thumb_${i}.jpg`);
              this.emitProgress(io, videoId, 15 + (i * 2), `Generating thumbnail ${i}/5...`);
              resolve();
            })
            .on('error', reject)
            .run();
        });
      } catch (error) {
        console.error(`Failed to generate thumbnail ${i}:`, error);
        // Continue with other thumbnails
      }
    }
    
    return thumbnails;
  }

  async getVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(parseFloat(metadata.format.duration));
      });
    });
  }

  async generateHLSVariants(inputPath, outputDir, videoId, metadata, io) {
    const variants = [];
    const totalQualities = this.qualities.filter(q => 
      metadata.width >= q.width && metadata.height >= q.height
    ).length;
    
    if (totalQualities === 0) {
      // If video is too small for any quality, create a single variant at original resolution
      const originalQuality = { 
        resolution: 'original', 
        width: metadata.width, 
        height: metadata.height, 
        bitrate: '500k' 
      };
      const variant = await this.generateHLSVariant(
        inputPath, 
        outputDir, 
        videoId, 
        originalQuality,
        metadata,
        io,
        0,
        1
      );
      variants.push(variant);
      console.log(`Created original quality variant: ${metadata.width}x${metadata.height}`);
      return variants;
    }

    let completed = 0;
    for (const quality of this.qualities) {
      // Skip if video resolution is smaller than target resolution
      if (metadata.width < quality.width || metadata.height < quality.height) {
        console.log(`Skipping ${quality.resolution} - video too small (${metadata.width}x${metadata.height})`);
        continue;
      }
      
      try {
        const variant = await this.generateHLSVariant(
          inputPath, 
          outputDir, 
          videoId, 
          quality, 
          metadata,
          io,
          completed,
          totalQualities
        );
        variants.push(variant);
        completed++;
        console.log(`Generated ${quality.resolution} variant successfully`);
      } catch (error) {
        console.error(`Failed to generate ${quality.resolution} variant:`, error);
        // Continue with other qualities even if one fails
      }
    }
    
    return variants;
  }

  async generateHLSVariant(inputPath, outputDir, videoId, quality, metadata, io, completed, total) {
    const playlistPath = path.join(outputDir, `${videoId}_${quality.resolution}.m3u8`);
    const segmentPattern = path.join(outputDir, `${videoId}_${quality.resolution}_%03d.ts`);
    
    return new Promise((resolve, reject) => {
      console.log(`Generating HLS variant: ${quality.resolution} (${quality.width}x${quality.height})`);
      
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${quality.width}x${quality.height}`)
        .videoBitrate(quality.bitrate)
        .audioBitrate('128k')
        .format('hls')
        .outputOptions([
          '-hls_time 10',
          '-hls_list_size 0',
          '-hls_segment_filename', segmentPattern,
          '-f hls',
          '-preset fast', // Faster encoding, less memory
          '-crf 23', // Better quality (lower CRF = better quality, was 28)
          '-maxrate', quality.bitrate,
          '-bufsize', `${parseInt(quality.bitrate) * 2}k`,
          '-avoid_negative_ts make_zero',
          '-fflags +genpts',
          '-threads 4', // Limit threads to reduce memory usage
          '-profile:v main', // H.264 profile for better compatibility
          '-movflags +faststart', // Enable fast start for better streaming
          '-g 48', // GOP size (keyframe interval) for better seeking
          '-sc_threshold 0', // Disable scene detection to prevent extra keyframes
          '-max_muxing_queue_size 1024' // Prevent muxing queue overflow
        ])
        .output(playlistPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            const baseProgress = 25 + (completed / total) * 60; // 25-85% range for HLS processing
            const variantProgress = (progress.percent / 100) * (60 / total);
            const totalProgress = Math.min(85, baseProgress + variantProgress);
            
            this.emitProgress(io, videoId, totalProgress, 
              `Processing ${quality.resolution} (${progress.percent.toFixed(1)}%)...`);
          }
        })
        .on('end', () => {
          console.log(`HLS variant ${quality.resolution} completed`);
          // Get generated segments
          this.getSegments(outputDir, videoId, quality.resolution)
            .then(segments => {
              resolve({
                resolution: quality.resolution,
                width: quality.width,
                height: quality.height,
                bitrate: parseInt(quality.bitrate),
                playlist: `${videoId}_${quality.resolution}.m3u8`,
                segments
              });
            })
            .catch(reject);
        })
        .on('error', (err) => {
          console.error(`FFmpeg error for ${quality.resolution}:`, err);
          reject(err);
        });

      // Add timeout to prevent hanging (increased for large videos)
      const timeout = setTimeout(() => {
        command.kill('SIGKILL');
        reject(new Error(`FFmpeg timeout for ${quality.resolution}`));
      }, 900000); // 15 minutes timeout per variant

      command.on('end', () => clearTimeout(timeout));
      command.on('error', () => clearTimeout(timeout));
      
      command.run();
    });
  }

  async getSegments(outputDir, videoId, resolution) {
    try {
      const files = await fs.readdir(outputDir);
      return files
        .filter(file => file.startsWith(`${videoId}_${resolution}_`) && file.endsWith('.ts'))
        .sort();
    } catch (error) {
      console.error('Error getting segments:', error);
      return [];
    }
  }

  getAllSegments(variants) {
    const allSegments = [];
    variants.forEach(variant => {
      allSegments.push(...variant.segments);
    });
    return allSegments;
  }

  async generateMasterPlaylist(variants, outputDir, videoId) {
    // Ensure directory exists before writing
    await fs.mkdir(outputDir, { recursive: true });
    
    const masterPlaylistPath = path.join(outputDir, `${videoId}_master.m3u8`);
    
    let playlistContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    
    variants.forEach(variant => {
      // HLS spec requires RESOLUTION in WIDTHxHEIGHT format (e.g., 1280x720)
      // NOT "720p" - this is critical for HLS.js to parse quality levels correctly
      const resolution = variant.width && variant.height 
        ? `${variant.width}x${variant.height}`
        : variant.resolution;
        
      playlistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate * 1000},RESOLUTION=${resolution}\n`;
      playlistContent += `${variant.playlist}\n`;
    });
    
    await fs.writeFile(masterPlaylistPath, playlistContent);
    console.log(`Master playlist created with ${variants.length} quality variants`);
    return `${videoId}_master.m3u8`;
  }
}

module.exports = VideoProcessor;
