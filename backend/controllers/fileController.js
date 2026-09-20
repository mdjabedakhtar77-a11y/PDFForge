const fs = require('fs');
const path = require('path');
const FileModel = require('../models/File');
const { getPdfPageCount, UPLOAD_ROOT } = require('../services/storageService');
const { isSafePath, sanitizeFilename, validateFileSignature } = require('../utils/pathSecurity');

/**
 * Access control validation: ensures users can only access their own documents unless ADMIN.
 */
function checkFileOwnership(fileRecord, req) {
  if (!fileRecord.user_id) {
    // Unauthenticated guest file - accessible via direct session ID
    return { allowed: true };
  }
  if (!req.user) {
    return {
      allowed: false,
      status: 401,
      message: 'Authentication required. Please sign in to access this document.'
    };
  }
  if (fileRecord.user_id !== req.user.id && req.user.role !== 'ADMIN') {
    return {
      allowed: false,
      status: 403,
      message: 'Access forbidden. You do not own this document.'
    };
  }
  return { allowed: true };
}

/**
 * Handle PDF file upload
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file format rejected. Please upload a valid PDF.'
      });
    }

    const fileId = req.generatedFileId;
    const originalName = sanitizeFilename(req.file.originalname);
    const storedName = req.file.filename;
    const storagePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype || 'application/pdf';
    const userId = req.user ? req.user.id : null;

    // Strict path verification
    if (!isSafePath(UPLOAD_ROOT, storagePath)) {
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      return res.status(400).json({
        success: false,
        message: 'Security error: Upload storage destination is invalid.'
      });
    }

    // Magic byte / file signature validation
    const headerBuffer = Buffer.alloc(64);
    const fd = fs.openSync(storagePath, 'r');
    fs.readSync(fd, headerBuffer, 0, 64, 0);
    fs.closeSync(fd);

    if (!validateFileSignature(headerBuffer, mimeType)) {
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      return res.status(400).json({
        success: false,
        message: 'File content signature verification failed: invalid or disguised file format.'
      });
    }

    // Calculate real PDF page count using pdf-lib
    const pageCount = await getPdfPageCount(storagePath);

    // Save record to DB
    const fileRecord = await FileModel.create({
      id: fileId,
      user_id: userId,
      original_name: originalName,
      stored_name: storedName,
      mime_type: mimeType,
      file_size: fileSize,
      page_count: pageCount,
      storage_path: storagePath,
      is_temporary: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const clientToken = (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))
      ? req.headers.authorization.split(' ')[1]
      : (req.query && req.query.token ? req.query.token : null);
    const tokenQuery = clientToken ? `?token=${encodeURIComponent(clientToken)}` : '';

    return res.status(201).json({
      success: true,
      message: 'PDF uploaded successfully.',
      file: {
        id: fileRecord.id,
        originalName: fileRecord.original_name,
        fileSize: fileRecord.file_size,
        pageCount: fileRecord.page_count,
        mimeType: fileRecord.mime_type,
        createdAt: fileRecord.created_at,
        viewUrl: `/api/files/${fileRecord.id}/view${tokenQuery}`,
        downloadUrl: `/api/files/${fileRecord.id}/download${tokenQuery}`
      }
    });
  } catch (error) {
    console.error('[FileController.uploadFile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process and store uploaded file.',
      error: error.message
    });
  }
}

/**
 * Get file metadata by ID
 */
async function getFileInfo(req, res) {
  try {
    const { id } = req.params;
    const fileRecord = await FileModel.findById(id);

    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        message: 'File not found or has expired.'
      });
    }

    // Strict ownership check
    const access = checkFileOwnership(fileRecord, req);
    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message
      });
    }

    const clientToken = (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))
      ? req.headers.authorization.split(' ')[1]
      : (req.query && req.query.token ? req.query.token : null);
    const tokenQuery = clientToken ? `?token=${encodeURIComponent(clientToken)}` : '';

    return res.json({
      success: true,
      file: {
        id: fileRecord.id,
        originalName: fileRecord.original_name,
        fileSize: fileRecord.file_size,
        pageCount: fileRecord.page_count,
        mimeType: fileRecord.mime_type,
        createdAt: fileRecord.created_at,
        viewUrl: `/api/files/${fileRecord.id}/view${tokenQuery}`,
        downloadUrl: `/api/files/${fileRecord.id}/download${tokenQuery}`
      }
    });
  } catch (error) {
    console.error('[FileController.getFileInfo] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve file info.',
      error: error.message
    });
  }
}

/**
 * Stream file for inline viewing (PDF.js viewer)
 */
async function streamFile(req, res) {
  try {
    const { id } = req.params;
    const fileRecord = await FileModel.findById(id);

    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found or expired.'
      });
    }

    // Path traversal containment check
    if (!isSafePath(UPLOAD_ROOT, fileRecord.storage_path)) {
      return res.status(403).json({
        success: false,
        message: 'Security error: File path traversal detected.'
      });
    }

    // Strict ownership check
    const access = checkFileOwnership(fileRecord, req);
    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message
      });
    }

    res.setHeader('Content-Type', fileRecord.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileRecord.original_name)}"`);
    res.setHeader('Content-Length', fileRecord.file_size);

    const stream = fs.createReadStream(fileRecord.storage_path);
    stream.pipe(res);
  } catch (error) {
    console.error('[FileController.streamFile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error streaming file.',
      error: error.message
    });
  }
}

/**
 * Download file as attachment
 */
async function downloadFile(req, res) {
  try {
    const { id } = req.params;
    const fileRecord = await FileModel.findById(id);

    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found or expired.'
      });
    }

    // Path traversal containment check
    if (!isSafePath(UPLOAD_ROOT, fileRecord.storage_path)) {
      return res.status(403).json({
        success: false,
        message: 'Security error: File path traversal detected.'
      });
    }

    // Strict ownership check
    const access = checkFileOwnership(fileRecord, req);
    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message
      });
    }

    res.download(fileRecord.storage_path, fileRecord.original_name);
  } catch (error) {
    console.error('[FileController.downloadFile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error downloading file.',
      error: error.message
    });
  }
}

/**
 * Delete a file
 */
async function deleteFile(req, res) {
  try {
    const { id } = req.params;
    const fileRecord = await FileModel.findById(id);

    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        message: 'File not found.'
      });
    }

    // Strict ownership check
    const access = checkFileOwnership(fileRecord, req);
    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message
      });
    }

    // Path traversal containment check
    if (isSafePath(UPLOAD_ROOT, fileRecord.storage_path) && fs.existsSync(fileRecord.storage_path)) {
      fs.unlinkSync(fileRecord.storage_path);
    }

    await FileModel.delete(id);

    return res.json({
      success: true,
      message: 'File deleted successfully.'
    });
  } catch (error) {
    console.error('[FileController.deleteFile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file.',
      error: error.message
    });
  }
}

module.exports = {
  uploadFile,
  getFileInfo,
  streamFile,
  downloadFile,
  deleteFile
};
