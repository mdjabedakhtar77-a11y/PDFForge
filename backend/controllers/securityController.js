const fs = require('fs');
const FileModel = require('../models/File');
const AuditLog = require('../models/AuditLog');
const securityService = require('../services/securityService');
const { isSafePath } = require('../utils/pathSecurity');
const { UPLOAD_ROOT } = require('../services/storageService');

/**
 * Encrypt and password-protect a PDF
 */
async function protect(req, res) {
  try {
    const { fileId, password, ownerPassword } = req.body;
    if (!fileId || !password) {
      return res.status(400).json({
        success: false,
        message: 'fileId and password are required to protect a document.'
      });
    }

    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({
        success: false,
        message: 'Input file not found or expired.'
      });
    }

    // Strict path check
    if (!isSafePath(UPLOAD_ROOT, fileRecord.storage_path)) {
      return res.status(403).json({ success: false, message: 'Invalid file location.' });
    }

    // Ownership check
    if (fileRecord.user_id && (!req.user || (fileRecord.user_id !== req.user.id && req.user.role !== 'ADMIN'))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this document.' });
    }

    const result = await securityService.protectPdf(fileRecord.storage_path, password, ownerPassword);

    const newRecord = await FileModel.create({
      id: result.fileId,
      user_id: req.user ? req.user.id : fileRecord.user_id,
      original_name: `protected_${fileRecord.original_name}`,
      stored_name: result.filename,
      mime_type: 'application/pdf',
      file_size: result.fileSize,
      page_count: fileRecord.page_count,
      storage_path: result.filePath,
      is_temporary: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Audit event (WITHOUT passwords!)
    await AuditLog.logEvent({
      user_id: req.user ? req.user.id : null,
      action: 'PDF_PROTECT',
      resource_type: 'FILE',
      resource_id: newRecord.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'SUCCESS',
      details: {
        sourceFileId: fileId,
        outputFileId: newRecord.id,
        encryptionType: 'AES-256'
      }
    });

    return res.json({
      success: true,
      message: 'PDF successfully protected with AES encryption.',
      file: {
        id: newRecord.id,
        originalName: newRecord.original_name,
        fileSize: newRecord.file_size,
        pageCount: newRecord.page_count,
        viewUrl: `/api/files/${newRecord.id}/view`,
        downloadUrl: `/api/files/${newRecord.id}/download`
      }
    });
  } catch (err) {
    console.error('[SecurityController.protect] Error:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to password-protect PDF.'
    });
  }
}

/**
 * Decrypt and remove restrictions from an encrypted PDF using valid password
 */
async function unlock(req, res) {
  try {
    const { fileId, password } = req.body;
    if (!fileId || !password) {
      return res.status(400).json({
        success: false,
        message: 'fileId and password are required to unlock a document.'
      });
    }

    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({
        success: false,
        message: 'Input file not found or expired.'
      });
    }

    if (!isSafePath(UPLOAD_ROOT, fileRecord.storage_path)) {
      return res.status(403).json({ success: false, message: 'Invalid file location.' });
    }

    if (fileRecord.user_id && (!req.user || (fileRecord.user_id !== req.user.id && req.user.role !== 'ADMIN'))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this document.' });
    }

    const result = await securityService.unlockPdf(fileRecord.storage_path, password);

    const newRecord = await FileModel.create({
      id: result.fileId,
      user_id: req.user ? req.user.id : fileRecord.user_id,
      original_name: `unlocked_${fileRecord.original_name}`,
      stored_name: result.filename,
      mime_type: 'application/pdf',
      file_size: result.fileSize,
      page_count: fileRecord.page_count,
      storage_path: result.filePath,
      is_temporary: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Audit event (WITHOUT passwords!)
    await AuditLog.logEvent({
      user_id: req.user ? req.user.id : null,
      action: 'PDF_UNLOCK',
      resource_type: 'FILE',
      resource_id: newRecord.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'SUCCESS',
      details: {
        sourceFileId: fileId,
        outputFileId: newRecord.id
      }
    });

    return res.json({
      success: true,
      message: 'PDF restrictions successfully removed.',
      file: {
        id: newRecord.id,
        originalName: newRecord.original_name,
        fileSize: newRecord.file_size,
        pageCount: newRecord.page_count,
        viewUrl: `/api/files/${newRecord.id}/view`,
        downloadUrl: `/api/files/${newRecord.id}/download`
      }
    });
  } catch (err) {
    console.error('[SecurityController.unlock] Error:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to unlock PDF.'
    });
  }
}

/**
 * Apply text or image watermark to a PDF
 */
async function watermark(req, res) {
  try {
    const { fileId, text, fontSize, color, opacity, rotation, position, pages } = req.body;
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'fileId is required to watermark document.'
      });
    }

    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({
        success: false,
        message: 'Input file not found or expired.'
      });
    }

    if (!isSafePath(UPLOAD_ROOT, fileRecord.storage_path)) {
      return res.status(403).json({ success: false, message: 'Invalid file location.' });
    }

    if (fileRecord.user_id && (!req.user || (fileRecord.user_id !== req.user.id && req.user.role !== 'ADMIN'))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this document.' });
    }

    const result = await securityService.watermarkPdf(fileRecord.storage_path, {
      text,
      fontSize,
      color,
      opacity,
      rotation,
      position,
      pages
    });

    const newRecord = await FileModel.create({
      id: result.fileId,
      user_id: req.user ? req.user.id : fileRecord.user_id,
      original_name: `watermarked_${fileRecord.original_name}`,
      stored_name: result.filename,
      mime_type: 'application/pdf',
      file_size: result.fileSize,
      page_count: result.pageCount,
      storage_path: result.filePath,
      is_temporary: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await AuditLog.logEvent({
      user_id: req.user ? req.user.id : null,
      action: 'PDF_WATERMARK',
      resource_type: 'FILE',
      resource_id: newRecord.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'SUCCESS',
      details: {
        sourceFileId: fileId,
        watermarkText: text || 'CONFIDENTIAL',
        position: position || 'diagonal'
      }
    });

    return res.json({
      success: true,
      message: 'Watermark applied successfully.',
      file: {
        id: newRecord.id,
        originalName: newRecord.original_name,
        fileSize: newRecord.file_size,
        pageCount: newRecord.page_count,
        viewUrl: `/api/files/${newRecord.id}/view`,
        downloadUrl: `/api/files/${newRecord.id}/download`
      }
    });
  } catch (err) {
    console.error('[SecurityController.watermark] Error:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to apply watermark to PDF.'
    });
  }
}

/**
 * Check if a PDF is encrypted
 */
async function checkStatus(req, res) {
  try {
    const { id } = req.params;
    const fileRecord = await FileModel.findById(id);
    if (!fileRecord || !fs.existsSync(fileRecord.storage_path)) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    const isEnc = await securityService.checkPdfEncryption(fileRecord.storage_path);
    return res.json({
      success: true,
      fileId: id,
      isEncrypted: isEnc
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  protect,
  unlock,
  watermark,
  checkStatus
};
