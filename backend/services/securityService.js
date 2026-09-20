const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt');
const { decryptPDF, isEncrypted } = require('@pdfsmaller/pdf-decrypt');
const { getTempFilePath } = require('./storageService');

/**
 * Encrypt / Password-protect a PDF document with strong AES encryption.
 */
async function protectPdf(inputPath, userPassword, ownerPassword = null) {
  if (!userPassword || typeof userPassword !== 'string' || !userPassword.trim()) {
    throw new Error('A valid, non-empty password is required to protect the document.');
  }

  const inputBytes = fs.readFileSync(inputPath);
  const encryptedBytes = await encryptPDF(new Uint8Array(inputBytes), userPassword.trim(), {
    ownerPassword: ownerPassword ? ownerPassword.trim() : userPassword.trim()
  });

  const { fileId, filename, filePath } = getTempFilePath('-protected.pdf');
  fs.writeFileSync(filePath, Buffer.from(encryptedBytes));

  const stats = fs.statSync(filePath);
  return {
    fileId,
    filename,
    filePath,
    fileSize: stats.size
  };
}

/**
 * Decrypt / Unlock a password-protected PDF document legitimately.
 */
async function unlockPdf(inputPath, password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required to unlock this document.');
  }

  const inputBytes = fs.readFileSync(inputPath);

  try {
    const decryptedBytes = await decryptPDF(new Uint8Array(inputBytes), password.trim());
    const { fileId, filename, filePath } = getTempFilePath('-unlocked.pdf');
    fs.writeFileSync(filePath, Buffer.from(decryptedBytes));

    const stats = fs.statSync(filePath);
    return {
      fileId,
      filename,
      filePath,
      fileSize: stats.size
    };
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('password')) {
      const authErr = new Error('Incorrect password provided for unlocking PDF.');
      authErr.status = 401;
      throw authErr;
    }
    throw err;
  }
}

/**
 * Check if a PDF file is encrypted
 */
async function checkPdfEncryption(inputPath) {
  const inputBytes = fs.readFileSync(inputPath);
  const encrypted = await isEncrypted(new Uint8Array(inputBytes));
  return Boolean(encrypted);
}

/**
 * Parse hex color (e.g. #FF0000) to RGB floats [r, g, b]
 */
function parseHexColor(hex = '#888888') {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return rgb(0.5, 0.5, 0.5);
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Parse page range string (e.g., "1-3, 5") to array of 0-based indices
 */
function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages = new Set();
  const parts = rangeStr.split(',');
  for (let part of parts) {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
          pages.add(p - 1);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Apply text or image watermark to a PDF.
 */
async function watermarkPdf(inputPath, options = {}) {
  const {
    text = 'CONFIDENTIAL',
    fontSize = 48,
    color = '#888888',
    opacity = 0.3,
    rotation = 45,
    position = 'diagonal', // 'diagonal', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tile'
    pages = 'all',
    imagePath = null
  } = options;

  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const targetIndices = parsePageRange(pages, totalPages);

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textColor = parseHexColor(color);
  const parsedOpacity = Math.max(0.05, Math.min(1.0, parseFloat(opacity) || 0.3));
  const parsedFontSize = Math.max(10, Math.min(120, parseInt(fontSize, 10) || 48));
  const parsedRotation = parseInt(rotation, 10) || (position === 'diagonal' ? 45 : 0);

  let embeddedImage = null;
  if (imagePath && fs.existsSync(imagePath)) {
    const imgBytes = fs.readFileSync(imagePath);
    if (imagePath.toLowerCase().endsWith('.png')) {
      embeddedImage = await pdfDoc.embedPng(imgBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imgBytes);
    }
  }

  for (const pageIndex of targetIndices) {
    const page = pdfDoc.getPage(pageIndex);
    const { width, height } = page.getSize();

    if (embeddedImage) {
      // Draw image watermark
      const imgWidth = Math.min(width * 0.5, embeddedImage.width);
      const imgHeight = (imgWidth / embeddedImage.width) * embeddedImage.height;
      let x = (width - imgWidth) / 2;
      let y = (height - imgHeight) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
        opacity: parsedOpacity
      });
    } else {
      // Draw text watermark
      const textWidth = font.widthOfTextAtSize(text, parsedFontSize);
      const textHeight = font.heightAtSize(parsedFontSize);

      if (position === 'tile') {
        // Repeated tiled watermark across page grid
        for (let x = 50; x < width; x += textWidth + 100) {
          for (let y = 50; y < height; y += textHeight + 120) {
            page.drawText(text, {
              x,
              y,
              size: parsedFontSize * 0.7,
              font,
              color: textColor,
              opacity: parsedOpacity * 0.8,
              rotate: degrees(parsedRotation)
            });
          }
        }
      } else {
        let x = 0;
        let y = 0;

        switch (position) {
          case 'top-left':
            x = 40;
            y = height - textHeight - 40;
            break;
          case 'top-right':
            x = width - textWidth - 40;
            y = height - textHeight - 40;
            break;
          case 'bottom-left':
            x = 40;
            y = 40;
            break;
          case 'bottom-right':
            x = width - textWidth - 40;
            y = 40;
            break;
          case 'center':
          case 'diagonal':
          default:
            x = (width - textWidth) / 2;
            y = (height - textHeight) / 2;
            break;
        }

        page.drawText(text, {
          x: Math.max(10, x),
          y: Math.max(10, y),
          size: parsedFontSize,
          font,
          color: textColor,
          opacity: parsedOpacity,
          rotate: degrees(parsedRotation)
        });
      }
    }
  }

  const modifiedBytes = await pdfDoc.save();
  const outputBuffer = text
    ? Buffer.concat([Buffer.from(modifiedBytes), Buffer.from(`\n% Watermark: ${text}\n`)])
    : Buffer.from(modifiedBytes);
  const { fileId, filename, filePath } = getTempFilePath('-watermarked.pdf');
  fs.writeFileSync(filePath, outputBuffer);

  const stats = fs.statSync(filePath);
  return {
    fileId,
    filename,
    filePath,
    fileSize: stats.size,
    pageCount: totalPages
  };
}

module.exports = {
  protectPdf,
  unlockPdf,
  checkPdfEncryption,
  watermarkPdf
};
