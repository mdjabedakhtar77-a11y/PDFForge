const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TEMP_DIR, ensureDirs } = require('../services/storageService');
const { sanitizeFilename } = require('../utils/pathSecurity');

ensureDirs();

const dangerousExtensions = ['.exe', '.sh', '.bat', '.cmd', '.vbs', '.scr', '.msi', '.ps1', '.php', '.phtml', '.jsp', '.py', '.pl'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureDirs();
    cb(null, TEMP_DIR);
  },
  filename: function (req, file, cb) {
    file.originalname = sanitizeFilename(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const uniqueId = uuidv4();
    req.generatedFileId = uniqueId;
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'text/html',
    'text/plain'
  ];
  const allowedExtensions = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.html', '.htm', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (dangerousExtensions.includes(ext)) {
    return cb(new Error(`Security rejection: Dangerous executable file type "${ext}" is not permitted.`), false);
  }

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload a PDF, DOCX, image (PNG/JPG), text or HTML document.'), false);
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50;

const upload = multer({
  storage: storage,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024 // 50MB
  },
  fileFilter: fileFilter
});

module.exports = upload;
