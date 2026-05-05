import videoService from './videoService';
import socketService from './socketService';
import { VideoUploadData, VideoResponse } from '../types/video';

export interface UploadProgress {
  progress: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  uploadedBytes: number;
  totalBytes: number;
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  message?: string; // human-readable stage label (e.g. "Generating 480p variant...")
  error?: string;
}

export interface UploadManagerEvents {
  progress: (progress: UploadProgress) => void;
  complete: (videoId: string) => void;
  error: (error: string) => void;
  cancel: () => void;
}

class UploadManager {
  private static instance: UploadManager;
  private currentUpload: {
    file: File;
    data: VideoUploadData;
    abortController: AbortController;
    startTime: number;
    lastProgressTime: number;
    lastUploadedBytes: number;
    retryCount: number;
    maxRetries: number;
  } | null = null;

  private eventListeners: { [K in keyof UploadManagerEvents]?: Array<UploadManagerEvents[K]> } = {};
  private progressInterval: NodeJS.Timeout | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private lastProgress: UploadProgress | null = null;
  private processingProgressHandler: ((data: any) => void) | null = null;
  private processingCompleteHandler: ((data: any) => void) | null = null;

  private readonly STORAGE_KEYS = {
    UPLOAD_STATE: 'videoUploadState',
    UPLOAD_FILE: 'uploadFileData',
    UPLOAD_PROGRESS: 'uploadProgress'
  };

  private constructor() {
    this.loadPersistedState();
  }

  static getInstance(): UploadManager {
    if (!UploadManager.instance) {
      UploadManager.instance = new UploadManager();
    }
    return UploadManager.instance;
  }

  // Event management — supports multiple listeners per event.
  // `on()` returns an unsubscribe function; callers should call it on cleanup
  // instead of the old off() API (which would remove every subscriber).
  on<K extends keyof UploadManagerEvents>(event: K, callback: UploadManagerEvents[K]): () => void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [] as any;
    }
    (this.eventListeners[event] as any[]).push(callback);

    // Immediately replay last known progress so newly mounted subscribers
    // (e.g. dashboard after a modal unmount) don't see stale 0% state.
    if (event === 'progress' && this.lastProgress) {
      (callback as any)(this.lastProgress);
    }

    return () => {
      const arr = this.eventListeners[event] as any[] | undefined;
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  private emit<K extends keyof UploadManagerEvents>(event: K, ...args: Parameters<UploadManagerEvents[K]>) {
    if (event === 'progress') {
      this.lastProgress = args[0] as UploadProgress;
    }
    const callbacks = this.eventListeners[event] as any[] | undefined;
    if (!callbacks) return;
    for (const cb of [...callbacks]) {
      cb(...args);
    }
  }

  // Upload methods
  async uploadVideo(file: File, uploadData: VideoUploadData): Promise<VideoResponse> {
    // Cancel any existing upload
    if (this.currentUpload) {
      this.cancelUpload();
    }

    const abortController = new AbortController();
    const startTime = Date.now();

    this.currentUpload = {
      file,
      data: uploadData,
      abortController,
      startTime,
      lastProgressTime: startTime,
      lastUploadedBytes: 0,
      retryCount: 0,
      maxRetries: 3
    };

    // Persist upload state
    this.saveUploadState(file, uploadData);

    try {
      const response = await this.performUpload(abortController);
      // Stop the upload-phase 1s interval (which emits status: 'uploading')
      // before we transition to the processing phase — otherwise it would
      // fight with socket progress events and cause the panel to flicker.
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
      const videoId = response.data.video._id;
      this.emit('complete', videoId);
      this.subscribeToProcessing(videoId);
      this.startProcessingPolling(videoId);
      return response;
    } catch (error) {
      this.handleUploadError(error);
      throw error;
    }
  }

  // Resume tracking a video that is already in the processing state on the
  // backend (e.g., the user refreshed the page mid-processing). Idempotent —
  // calling repeatedly with the same videoId is safe.
  resumeProcessing(videoId: string) {
    if (this.processingProgressHandler) return;
    this.subscribeToProcessing(videoId);
    this.startProcessingPolling(videoId);
  }

  // Subscribe to real-time processing progress events for a specific video.
  // The backend emits `videoProcessingProgress` at every HLS stage (10% metadata,
  // 15-25% thumbnails, 25-95% variants, 95% master playlist, 100% done), so the
  // progress bar can fill incrementally instead of sitting at 100%.
  private subscribeToProcessing(videoId: string) {
    this.unsubscribeFromProcessing();

    const totalBytes = this.lastProgress?.totalBytes ?? 0;

    // Reset the bar to 0 for the processing phase.
    this.emit('progress', {
      progress: 0,
      speed: 0,
      timeRemaining: 0,
      uploadedBytes: totalBytes,
      totalBytes,
      status: 'processing',
      message: 'Starting processing...'
    });

    this.processingProgressHandler = (data: { videoId: string; progress: number; message: string }) => {
      if (!data || data.videoId !== videoId) return;

      if (data.progress < 0) {
        this.handleProcessingError(data.message || 'Video processing failed');
        return;
      }

      const prev = this.lastProgress;
      this.emit('progress', {
        progress: Math.max(0, Math.min(100, data.progress)),
        speed: 0,
        timeRemaining: 0,
        uploadedBytes: prev?.totalBytes ?? totalBytes,
        totalBytes: prev?.totalBytes ?? totalBytes,
        status: 'processing',
        message: data.message
      });
    };

    this.processingCompleteHandler = (data: { videoId: string }) => {
      if (!data || data.videoId !== videoId) return;
      this.completeUpload();
    };

    socketService.on('videoProcessingProgress', this.processingProgressHandler);
    socketService.on('videoProcessingComplete', this.processingCompleteHandler);
  }

  private unsubscribeFromProcessing() {
    if (this.processingProgressHandler) {
      socketService.off('videoProcessingProgress', this.processingProgressHandler);
      this.processingProgressHandler = null;
    }
    if (this.processingCompleteHandler) {
      socketService.off('videoProcessingComplete', this.processingCompleteHandler);
      this.processingCompleteHandler = null;
    }
  }

  private async performUpload(abortController: AbortController): Promise<VideoResponse> {
    if (!this.currentUpload) throw new Error('No upload in progress');
    const upload = this.currentUpload;

    return new Promise((resolve, reject) => {
      const { file, data } = upload;

      // Start progress tracking
      this.startProgressTracking(file);

      videoService.uploadVideo(
        file,
        data,
        (progress) => {
          if (this.currentUpload) {
            this.updateProgress(progress);
          }
        },
        abortController
      ).then(resolve).catch(reject);
    });
  }

  private startProgressTracking(file: File) {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (!this.currentUpload) return;

      const now = Date.now();
      const timeElapsed = (now - this.currentUpload.startTime) / 1000;
      const timeSinceLastUpdate = (now - this.currentUpload.lastProgressTime) / 1000;

      // Calculate speed (bytes per second)
      const currentProgress = this.getStoredProgress();
      const speed = timeSinceLastUpdate > 0 ? 
        (currentProgress.uploadedBytes - this.currentUpload.lastUploadedBytes) / timeSinceLastUpdate : 0;

      // Update last tracked values
      this.currentUpload.lastProgressTime = now;
      this.currentUpload.lastUploadedBytes = currentProgress.uploadedBytes;

      // Calculate time remaining
      const remainingBytes = file.size - currentProgress.uploadedBytes;
      const timeRemaining = speed > 0 ? remainingBytes / speed : 0;

      const progressData: UploadProgress = {
        ...currentProgress,
        speed,
        timeRemaining,
        status: 'uploading'
      };

      this.saveProgress(progressData);
      this.emit('progress', progressData);
    }, 1000); // Update every second
  }

  private updateProgress(progress: number) {
    if (!this.currentUpload) return;

    const uploadedBytes = (progress / 100) * this.currentUpload.file.size;
    const prev = this.lastProgress;
    const progressData: UploadProgress = {
      progress,
      speed: prev?.speed ?? 0,
      timeRemaining: prev?.timeRemaining ?? 0,
      uploadedBytes,
      totalBytes: this.currentUpload.file.size,
      status: 'uploading'
    };

    this.saveProgress(progressData);
    this.emit('progress', progressData);
  }

  private getStoredProgress(): UploadProgress {
    const stored = localStorage.getItem(this.STORAGE_KEYS.UPLOAD_PROGRESS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.getDefaultProgress();
      }
    }
    return this.getDefaultProgress();
  }

  private getDefaultProgress(): UploadProgress {
    return {
      progress: 0,
      speed: 0,
      timeRemaining: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      status: 'uploading'
    };
  }

  private saveProgress(progress: UploadProgress) {
    localStorage.setItem(this.STORAGE_KEYS.UPLOAD_PROGRESS, JSON.stringify(progress));
  }

  private saveUploadState(file: File, data: VideoUploadData) {
    const uploadState = {
      fileName: file.name,
      fileSize: file.size,
      uploadData: data,
      startTime: Date.now(),
      status: 'uploading'
    };

    localStorage.setItem(this.STORAGE_KEYS.UPLOAD_STATE, JSON.stringify(uploadState));
  }

  private loadPersistedState() {
    const uploadState = localStorage.getItem(this.STORAGE_KEYS.UPLOAD_STATE);
    const progress = localStorage.getItem(this.STORAGE_KEYS.UPLOAD_PROGRESS);

    if (uploadState && progress) {
      try {
        const state = JSON.parse(uploadState);
        const progressData = JSON.parse(progress);
        
        // Check if upload is still valid (not too old)
        const uploadAge = Date.now() - state.startTime;
        const maxAge = 30 * 60 * 1000; // 30 minutes

        if (uploadAge < maxAge) {
          // Resume progress tracking
          this.emit('progress', {
            ...progressData,
            status: 'uploading'
          });
        } else {
          // Clear old upload
          this.clearPersistedState();
        }
      } catch {
        this.clearPersistedState();
      }
    }
  }

  private startProcessingPolling(videoId: string) {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Polling is now a fallback safety net — socket events drive real-time
    // progress. We only check DB status to detect completion / failure in
    // case the socket dropped a message.
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes at 10s interval

    this.processingInterval = setInterval(async () => {
      pollCount++;

      try {
        const videos = await videoService.getAdminVideos({ limit: 100 });
        const uploadedVideo = videos.data.videos.find(v => v._id === videoId);

        if (uploadedVideo) {
          if (uploadedVideo.status === 'ready') {
            this.completeUpload();
          } else if (uploadedVideo.status === 'error' || uploadedVideo.status === 'failed') {
            this.handleProcessingError('Video processing failed');
          }
          // While still processing, let socket events drive the UI.
        }

        if (pollCount >= maxPolls) {
          this.handleProcessingError('Processing timeout - please check video later');
        }
      } catch (error) {
        console.error('Error polling video status:', error);
      }
    }, 10000);
  }

  private completeUpload() {
    this.cleanup();
    const progress = this.getStoredProgress();
    this.emit('progress', {
      ...progress,
      progress: 100,
      status: 'completed',
      timeRemaining: 0
    });
  }

  private handleUploadError(error: any) {
    if (!this.currentUpload) return;

    const shouldRetry = this.currentUpload.retryCount < this.currentUpload.maxRetries;
    
    if (shouldRetry && error.message !== 'Upload cancelled by user') {
      this.currentUpload.retryCount++;
      
      // Exponential backoff
      const delay = Math.pow(2, this.currentUpload.retryCount) * 1000;
      
      setTimeout(() => {
        this.retryUpload();
      }, delay);
    } else {
      const progress = this.getStoredProgress();
      this.emit('error', error.message || 'Upload failed');
      this.emit('progress', {
        ...progress,
        status: 'error',
        error: error.message || 'Upload failed'
      });
      this.cleanup();
    }
  }

  private async retryUpload() {
    if (!this.currentUpload) return;

    try {
      const response = await this.performUpload(this.currentUpload.abortController);
      this.emit('complete', response.data.video._id);
      this.startProcessingPolling(response.data.video._id);
    } catch (error) {
      this.handleUploadError(error);
    }
  }

  private handleProcessingError(message: string) {
    const progress = this.getStoredProgress();
    this.emit('error', message);
    this.emit('progress', {
      ...progress,
      status: 'error',
      error: message
    });
    this.cleanup();
  }

  cancelUpload() {
    if (this.currentUpload) {
      this.currentUpload.abortController.abort();
      this.emit('cancel');
      this.emit('progress', {
        ...this.getStoredProgress(),
        status: 'cancelled'
      });
      this.cleanup();
    }
  }

  private cleanup() {
    // Clear intervals
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Tear down socket listeners
    this.unsubscribeFromProcessing();

    // Clear current upload
    this.currentUpload = null;
    this.lastProgress = null;

    // Clear persisted state
    this.clearPersistedState();
  }

  private clearPersistedState() {
    localStorage.removeItem(this.STORAGE_KEYS.UPLOAD_STATE);
    localStorage.removeItem(this.STORAGE_KEYS.UPLOAD_PROGRESS);
  }

  // Public methods
  isUploadInProgress(): boolean {
    return this.currentUpload !== null;
  }

  getCurrentProgress(): UploadProgress | null {
    return this.getStoredProgress();
  }
}

export default UploadManager.getInstance();
