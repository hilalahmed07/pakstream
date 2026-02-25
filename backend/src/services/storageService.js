// Storage Service Abstraction
// Supports both local filesystem and MinIO object storage

const fs = require('fs').promises;
const path = require('path');
const { isMinIOEnabled, getStorageConfig } = require('../config/storage');

let minioClient = null;
let Minio = null;

// Lazy load MinIO module only when needed
function getMinioClient() {
  if (!isMinIOEnabled()) {
    return null;
  }

  // Load MinIO module only when MinIO is enabled
  if (!Minio) {
    try {
      Minio = require('minio');
    } catch (error) {
      console.error('MinIO module not found. Install it with: npm install minio');
      console.error('Or set STORAGE_TYPE=local to use local filesystem storage');
      throw new Error('MinIO module not installed. Run: npm install minio');
    }
  }

  return Minio;
}

// Initialize MinIO client if enabled
function initializeMinIO() {
  if (!isMinIOEnabled()) {
    return null;
  }

  if (minioClient) {
    return minioClient;
  }

  const MinioModule = getMinioClient();
  if (!MinioModule) {
    return null;
  }

  const config = getStorageConfig();
  const { minio } = config;

  try {
    minioClient = new MinioModule.Client({
      endPoint: minio.endpoint,
      port: minio.port,
      useSSL: minio.useSSL,
      accessKey: minio.accessKey,
      secretKey: minio.secretKey
    });

    // Ensure bucket exists
    ensureBucketExists(minio.bucketName).catch(err => {
      console.error('Error ensuring bucket exists:', err);
    });

    console.log('MinIO client initialized');
    return minioClient;
  } catch (error) {
    console.error('Failed to initialize MinIO client:', error);
    throw error;
  }
}

// Ensure MinIO bucket exists
async function ensureBucketExists(bucketName) {
  if (!isMinIOEnabled() || !minioClient) {
    return;
  }

  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      try {
        await minioClient.makeBucket(bucketName, 'us-east-1');
        console.log(`Created MinIO bucket: ${bucketName}`);
      } catch (makeError) {
        // If multiple processes try to create the bucket at once, one might fail with 'BucketAlreadyOwnedByYou'
        if (makeError.code !== 'BucketAlreadyOwnedByYou' && makeError.code !== 'BucketAlreadyExists') {
          throw makeError;
        }
        console.log(`MinIO bucket already exists: ${bucketName}`);
      }
    }
  } catch (error) {
    console.error(`Error ensuring bucket exists: ${bucketName}`, error);
    // Log but don't necessarily throw if the error is just about existence
    if (error.code !== 'BucketAlreadyOwnedByYou' && error.code !== 'BucketAlreadyExists') {
      throw error;
    }
  }
}


class StorageService {
  /**
   * Upload a file to storage
   * @param {string} filePath - Local file path
   * @param {string} objectName - Object name in storage (e.g., 'videos/original/filename.mp4')
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} - Storage path or URL
   */
  async uploadFile(filePath, objectName, contentType = 'application/octet-stream') {
    if (isMinIOEnabled()) {
      return this.uploadToMinIO(filePath, objectName, contentType);
    } else {
      return this.uploadToLocal(filePath, objectName);
    }
  }

  /**
   * Upload to MinIO
   */
  async uploadToMinIO(filePath, objectName, contentType) {
    const client = initializeMinIO();
    if (!client) {
      throw new Error('MinIO client not initialized');
    }

    const config = getStorageConfig();
    const bucketName = config.minio.bucketName;

    await ensureBucketExists(bucketName);

    const stat = await fs.stat(filePath);
    const fileStream = require('fs').createReadStream(filePath);

    await client.putObject(bucketName, objectName, fileStream, stat.size, {
      'Content-Type': contentType
    });

    console.log(`Uploaded to MinIO: ${objectName}`);
    return objectName;
  }

  /**
   * Upload to local filesystem (copy file)
   */
  async uploadToLocal(filePath, objectName) {
    const config = getStorageConfig();
    const destPath = path.join(config.local.videosPath, objectName);
    const destDir = path.dirname(destPath);

    // Ensure directory exists
    await fs.mkdir(destDir, { recursive: true });

    // Copy file
    await fs.copyFile(filePath, destPath);

    console.log(`Copied to local storage: ${destPath}`);
    return destPath;
  }

  /**
   * Get file stream from storage
   * @param {string} objectName - Object name in storage
   * @returns {Promise<Stream>}
   */
  async getFileStream(objectName) {
    if (isMinIOEnabled()) {
      return this.getFileStreamFromMinIO(objectName);
    } else {
      return this.getFileStreamFromLocal(objectName);
    }
  }

  /**
   * Get file stream from MinIO
   */
  async getFileStreamFromMinIO(objectName) {
    const client = initializeMinIO();
    if (!client) {
      throw new Error('MinIO client not initialized');
    }

    const config = getStorageConfig();
    const bucketName = config.minio.bucketName;

    return await client.getObject(bucketName, objectName);
  }

  /**
   * Get file stream from local storage
   */
  async getFileStreamFromLocal(objectName) {
    const config = getStorageConfig();
    const filePath = path.join(config.local.videosPath, objectName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${objectName}`);
    }

    return require('fs').createReadStream(filePath);
  }

  /**
   * Get presigned URL for file access (MinIO only)
   * @param {string} objectName - Object name
   * @param {number} expirySeconds - URL expiry in seconds (default: 7 days)
   * @returns {Promise<string>} - Presigned URL
   */
  async getPresignedUrl(objectName, expirySeconds = 7 * 24 * 60 * 60) {
    if (!isMinIOEnabled()) {
      // For local storage, return relative path
      return `/api/videos/storage/${encodeURIComponent(objectName)}`;
    }

    const client = initializeMinIO();
    if (!client) {
      throw new Error('MinIO client not initialized');
    }

    const config = getStorageConfig();
    const bucketName = config.minio.bucketName;

    return await client.presignedGetObject(bucketName, objectName, expirySeconds);
  }

  /**
   * Get public URL for file (if MinIO public URL is configured)
   * @param {string} objectName - Object name
   * @returns {string} - Public URL or null
   */
  getPublicUrl(objectName) {
    if (!isMinIOEnabled()) {
      return `/api/videos/storage/${encodeURIComponent(objectName)}`;
    }

    const config = getStorageConfig();
    const publicUrl = config.minio.publicUrl;

    if (publicUrl) {
      const separator = publicUrl.endsWith('/') ? '' : '/';
      return `${publicUrl}${separator}${objectName}`;
    }

    return null;
  }

  /**
   * Delete file from storage
   * @param {string} objectName - Object name
   * @returns {Promise<void>}
   */
  async deleteFile(objectName) {
    if (isMinIOEnabled()) {
      return this.deleteFromMinIO(objectName);
    } else {
      return this.deleteFromLocal(objectName);
    }
  }

  /**
   * Delete from MinIO
   */
  async deleteFromMinIO(objectName) {
    const client = initializeMinIO();
    if (!client) {
      throw new Error('MinIO client not initialized');
    }

    const config = getStorageConfig();
    const bucketName = config.minio.bucketName;

    await client.removeObject(bucketName, objectName);
    console.log(`Deleted from MinIO: ${objectName}`);
  }

  /**
   * Delete from local storage
   */
  async deleteFromLocal(objectName) {
    const config = getStorageConfig();
    const filePath = path.join(config.local.videosPath, objectName);

    try {
      await fs.unlink(filePath);
      console.log(`Deleted from local storage: ${filePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's okay
    }
  }

  /**
   * Check if file exists
   * @param {string} objectName - Object name
   * @returns {Promise<boolean>}
   */
  async fileExists(objectName) {
    if (isMinIOEnabled()) {
      return this.fileExistsInMinIO(objectName);
    } else {
      return this.fileExistsInLocal(objectName);
    }
  }

  /**
   * Check if file exists in MinIO
   */
  async fileExistsInMinIO(objectName) {
    try {
      const client = initializeMinIO();
      if (!client) {
        return false;
      }

      const config = getStorageConfig();
      const bucketName = config.minio.bucketName;

      await client.statObject(bucketName, objectName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file exists in local storage
   */
  async fileExistsInLocal(objectName) {
    try {
      const config = getStorageConfig();
      const filePath = path.join(config.local.videosPath, objectName);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file stats
   * @param {string} objectName - Object name
   * @returns {Promise<Object>} - File stats
   */
  async getFileStats(objectName) {
    if (isMinIOEnabled()) {
      return this.getFileStatsFromMinIO(objectName);
    } else {
      return this.getFileStatsFromLocal(objectName);
    }
  }

  /**
   * Get file stats from MinIO
   */
  async getFileStatsFromMinIO(objectName) {
    const client = initializeMinIO();
    if (!client) {
      throw new Error('MinIO client not initialized');
    }

    const config = getStorageConfig();
    const bucketName = config.minio.bucketName;

    const stat = await client.statObject(bucketName, objectName);
    return {
      size: stat.size,
      contentType: stat.metaData['content-type'] || 'application/octet-stream',
      lastModified: stat.lastModified
    };
  }

  /**
   * Get file stats from local storage
   */
  async getFileStatsFromLocal(objectName) {
    const config = getStorageConfig();
    const filePath = path.join(config.local.videosPath, objectName);

    const stat = await fs.stat(filePath);
    return {
      size: stat.size,
      contentType: 'application/octet-stream', // Could be improved with mime-type detection
      lastModified: stat.mtime
    };
  }

  /**
   * Upload all files from a directory to storage
   * @param {string} localDirPath - Local directory path
   * @param {string} remoteBaseDir - Remote base directory (e.g., 'processed/videoId/hls')
   * @returns {Promise<void>}
   */
  async uploadDirectory(localDirPath, remoteBaseDir) {
    try {
      const files = await fs.readdir(localDirPath);

      for (const file of files) {
        const filePath = path.join(localDirPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile()) {
          const objectName = `${remoteBaseDir}/${file}`;
          let contentType = 'application/octet-stream';

          if (file.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
          else if (file.endsWith('.ts')) contentType = 'video/mp2t';
          else if (file.endsWith('.jpg') || file.endsWith('.jpeg')) contentType = 'image/jpeg';

          await this.uploadFile(filePath, objectName, contentType);
        }
      }
    } catch (error) {
      console.error(`Error uploading directory ${localDirPath}:`, error);
      throw error;
    }
  }
}


// Export singleton instance
const storageService = new StorageService();

module.exports = storageService;

