const path = require('path');

/**
 * Check if targetPath is safely contained within baseDir to prevent path traversal attacks.
 * Resolves both paths to canonical form and verifies targetPath starts with baseDir.
 *
 * @param {string} baseDir
 * @param {string} targetPath
 * @returns {boolean}
 */
function isSafePath(baseDir, targetPath) {
  if (!baseDir || !targetPath) return false;
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

/**
 * Sanitize filename to prevent directory traversal or file system injection.
 * Removes path separators, control characters, and dangerous null bytes.
 *
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'unnamed_file';
  // Strip path traversal attempts and directory separators
  let clean = path.basename(filename);
  // Remove null bytes and control characters
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  // Remove unsafe filesystem characters
  clean = clean.replace(/[<>:"/\\|?*~]/g, '_');
  // Trim spaces and leading/trailing dots
  clean = clean.trim().replace(/^\.+/, '').replace(/\.+$/, '');
  return clean || 'document.pdf';
}

/**
 * Validate magic bytes / file signatures to prevent disguised executables or invalid files.
 *
 * @param {Buffer} buffer - First few bytes of file
 * @param {string} expectedMimeType
 * @returns {boolean}
 */
function validateFileSignature(buffer, expectedMimeType = '') {
  if (!buffer || buffer.length < 4) return false;

  const hex = buffer.slice(0, 8).toString('hex').toLowerCase();
  const ascii = buffer.slice(0, 5).toString('ascii');

  // PDF signature: starts with %PDF- (hex: 25 50 44 46 2d)
  if (ascii.startsWith('%PDF-') || hex.startsWith('25504446')) {
    return true;
  }

  // PNG: 89 50 4e 47 0d 0a 1a 0a
  if (hex.startsWith('89504e47')) {
    return expectedMimeType.includes('png') || expectedMimeType.includes('image');
  }

  // JPEG / JPG: ff d8 ff
  if (hex.startsWith('ffd8ff')) {
    return expectedMimeType.includes('jpeg') || expectedMimeType.includes('jpg') || expectedMimeType.includes('image');
  }

  // DOCX / XLSX / PPTX / ZIP: 50 4b 03 04
  if (hex.startsWith('504b0304')) {
    return (
      expectedMimeType.includes('word') ||
      expectedMimeType.includes('officedocument') ||
      expectedMimeType.includes('sheet') ||
      expectedMimeType.includes('presentation') ||
      expectedMimeType.includes('zip')
    );
  }

  // Text or HTML files: allow ASCII text content
  if (expectedMimeType.includes('text') || expectedMimeType.includes('html')) {
    // Check if primarily printable ASCII
    for (let i = 0; i < Math.min(buffer.length, 32); i++) {
      const byte = buffer[i];
      if (byte === 0) return false; // Null byte indicates binary
    }
    return true;
  }

  // By default, if mime-type is generic octet-stream, check PDF
  return ascii.startsWith('%PDF');
}

module.exports = {
  isSafePath,
  sanitizeFilename,
  validateFileSignature
};
