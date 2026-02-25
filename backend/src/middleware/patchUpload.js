const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads/patches');
const originalDir = path.join(uploadDir, 'original');
const tempDir = path.join(uploadDir, 'temp');

[uploadDir, originalDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for patch uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `patch-${uniqueSuffix}${ext}`);
  }
});

// File filter for Windows patch files
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/x-msdownload',      // .exe
    'application/x-msi',              // .msi
    'application/x-msu-update',      // .msu
    'application/vnd.ms-cab-compressed', // .cab
    'text/plain',                     // .def
    'application/octet-stream'        // Fallback for executables
  ];

  const allowedExts = ['.exe', '.msi', '.msp', '.msu', '.cab', '.def'];
  const ext = path.extname(file.originalname).toLowerCase();

  console.log('Patch upload - MIME type:', file.mimetype);
  console.log('Patch upload - File extension:', ext);

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type (${ext}). Supported formats: .exe, .msi, .msp, .msu, .cab, .def`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit for patch files
  }
});

// Multer configuration for verification (saves to temp directory)
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
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
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  }
});

// Error handling middleware for verification uploads
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 500MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = {
  upload: upload.single('patch'),
  multerInstance: upload,
  verificationUpload: verificationUpload.single('patch'),
  handleUploadError: handleUploadError
};
