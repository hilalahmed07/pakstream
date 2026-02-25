const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Ensure upload directories exist
const ensureUploadDirs = async () => {
  const dirs = [
    'uploads/videos/original',
    'uploads/videos/processed',
    'uploads/videos/temp',
    'public/videos'
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log('Created directory:', dir);
    } catch (error) {
      console.error('Error creating directory:', dir, error);
    }
  }
};

// Initialize upload directories
ensureUploadDirs();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = 'uploads/videos/original';
    console.log('Saving file to:', dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `video-${uniqueSuffix}${ext}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter for video files
const fileFilter = (req, file, cb) => {
  console.log('File upload attempt:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedMimes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'video/mkv',
    'video/3gp',
    'application/octet-stream'
  ];

  const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.3gp'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check by MIME type or file extension
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    console.log('File accepted:', file.originalname, 'MIME type:', file.mimetype, 'Extension:', fileExtension);
    cb(null, true);
  } else {
    console.log('File rejected:', file.originalname, 'MIME type:', file.mimetype, 'Extension:', fileExtension);
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};


// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  console.error('Upload error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 2GB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed.'
      });
    }
  }

  if (error.message === 'Invalid file type. Only video files are allowed.') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};

// Multer instance for video uploads (for reuse)
const multerInstance = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    files: 1 // Only one file at a time
  }
});

// Multer configuration for verification (saves to temp directory)
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = 'uploads/videos/temp';
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `verify-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const verificationUpload = multer({
  storage: verificationStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    files: 1 // Only one file at a time
  }
});

module.exports = {
  upload: multerInstance.single('video'),
  multerInstance: multerInstance, // Export multer instance for reuse
  verificationUpload: verificationUpload.single('video'), // Export verification upload middleware
  handleUploadError
};
