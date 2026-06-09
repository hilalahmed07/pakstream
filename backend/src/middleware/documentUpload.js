const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads/documents');
const originalDir = path.join(uploadDir, 'original');
const processedDir = path.join(uploadDir, 'processed');
const tempDir = path.join(uploadDir, 'temp');

[uploadDir, originalDir, processedDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${ext}`);
  }
});

// File filter for PDF documents
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf'
  ];
  
  const allowedExts = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  console.log('Document upload - MIME type:', file.mimetype);
  console.log('Document upload - File extension:', ext);
  
  // Both MIME type AND extension must match to prevent renamed files (e.g. PPT renamed to .pdf)
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF files (.pdf) are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
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
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Error handling middleware for verification uploads
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.'
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

module.exports = upload;
module.exports.verificationUpload = verificationUpload.single('document');
module.exports.handleUploadError = handleUploadError;

