const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');

const UPLOAD_ROOT = process.env.UPLOAD_DIR || (
  fs.existsSync(path.join(__dirname, '../../uploads'))
    ? path.join(__dirname, '../../uploads')
    : path.join(__dirname, '../uploads')
);
const TEMP_DIR = path.join(UPLOAD_ROOT, 'temp');
const RESULTS_DIR = path.join(UPLOAD_ROOT, 'results');

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

ensureDirs();

/**
 * Generate a safe unique file path in temp directory
 */
function getTempFilePath(extension = '.pdf') {
  ensureDirs();
  const fileId = uuidv4();
  const filename = `${fileId}${extension}`;
  const filePath = path.join(TEMP_DIR, filename);
  return { fileId, filename, filePath };
}

/**
 * Read PDF page count using pdf-lib
 */
async function getPdfPageCount(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.warn('[StorageService] Could not inspect PDF page count:', error.message);
    return 1;
  }
}

/**
 * Clean up expired files from temp directory
 */
function cleanExpiredTempFiles(expiryHours = 24) {
  try {
    ensureDirs();
    const now = Date.now();
    const expiryMs = expiryHours * 60 * 60 * 1000;
    const files = fs.readdirSync(TEMP_DIR);

    let deletedCount = 0;
    for (const file of files) {
      const fullPath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(fullPath);
      if (now - stats.mtimeMs > expiryMs) {
        fs.unlinkSync(fullPath);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`[StorageService] Cleaned up ${deletedCount} expired temporary files.`);
    }
  } catch (err) {
    console.error('[StorageService] Error during temp file cleanup:', err.message);
  }
}

// Run cleanup once every 6 hours
setInterval(() => {
  cleanExpiredTempFiles(parseInt(process.env.TEMP_FILE_EXPIRY_HOURS, 10) || 24);
}, 6 * 60 * 60 * 1000);

module.exports = {
  UPLOAD_ROOT,
  TEMP_DIR,
  RESULTS_DIR,
  ensureDirs,
  getTempFilePath,
  getPdfPageCount,
  cleanExpiredTempFiles
};
