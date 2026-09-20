const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const { RESULTS_DIR, ensureDirs } = require('../services/storageService');
const pdfService = require('../services/pdfService');

ensureDirs();

/**
 * Helper to register a newly generated PDF into the database
 */
async function registerProcessedFile({
  originalName,
  storagePath,
  userId = null,
  pageCount = 1
}) {
  const resultFileId = uuidv4();
  const storedName = `${resultFileId}.pdf`;
  const finalPath = path.join(RESULTS_DIR, storedName);

  // If file was written elsewhere, copy or rename to finalPath
  if (storagePath !== finalPath && fs.existsSync(storagePath)) {
    fs.renameSync(storagePath, finalPath);
  }

  const stats = fs.statSync(finalPath);

  const fileRecord = await FileModel.create({
    id: resultFileId,
    user_id: userId,
    original_name: originalName,
    stored_name: storedName,
    mime_type: 'application/pdf',
    file_size: stats.size,
    page_count: pageCount,
    storage_path: finalPath,
    is_temporary: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return {
    id: fileRecord.id,
    originalName: fileRecord.original_name,
    fileSize: fileRecord.file_size,
    pageCount: fileRecord.page_count,
    viewUrl: `/api/files/${fileRecord.id}/view`,
    downloadUrl: `/api/files/${fileRecord.id}/download`
  };
}

/**
 * 1. Merge PDF files
 */
async function mergePdfs(req, res) {
  let job = null;
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of at least 1 file ID to merge.'
      });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'merge',
      status: 'PROCESSING',
      input_file_id: fileIds[0]
    });

    const filePaths = [];
    for (const fid of fileIds) {
      const rec = await FileModel.findById(fid);
      if (!rec || !fs.existsSync(rec.storage_path)) {
        throw new Error(`File ID "${fid}" could not be found or has expired.`);
      }
      filePaths.push(rec.storage_path);
    }

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.mergeDocuments(filePaths, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: 'merged_document.pdf',
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'PDFs merged successfully.',
      result
    });
  } catch (err) {
    console.error('[pdfOperations.mergePdfs] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. Extract selected pages
 */
async function extractPages(req, res) {
  let job = null;
  try {
    const { fileId, pages } = req.body;
    if (!fileId || !pages) {
      return res.status(400).json({
        success: false,
        message: 'fileId and pages (array or comma-separated string) are required.'
      });
    }

    const pageNumbers = Array.isArray(pages)
      ? pages
      : pages.toString().split(',').map(p => p.trim());

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'extract',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.extractPages(fileRec.storage_path, pageNumbers, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `extracted_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Pages extracted successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.extractPages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. Split by Ranges
 */
async function splitPdf(req, res) {
  let job = null;
  try {
    const { fileId, ranges } = req.body;
    if (!fileId || !ranges) {
      return res.status(400).json({
        success: false,
        message: 'fileId and ranges (e.g. "1-3, 5") are required.'
      });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'split',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.splitByRanges(fileRec.storage_path, ranges, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `split_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'PDF split by range successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.splitPdf] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. Delete Pages
 */
async function deletePages(req, res) {
  let job = null;
  try {
    const { fileId, pages } = req.body;
    if (!fileId || !pages) {
      return res.status(400).json({
        success: false,
        message: 'fileId and pages to delete are required.'
      });
    }

    const pagesToDelete = Array.isArray(pages)
      ? pages
      : pages.toString().split(',').map(p => p.trim());

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'delete-pages',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.deletePages(fileRec.storage_path, pagesToDelete, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `trimmed_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Pages removed successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.deletePages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. Organize / Reorder Pages
 */
async function organizePages(req, res) {
  let job = null;
  try {
    const { fileId, order } = req.body;
    if (!fileId || !order || !Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        message: 'fileId and order (array of page numbers) are required.'
      });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'organize',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.organizePages(fileRec.storage_path, order, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `organized_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Pages reordered successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.organizePages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 6. Rotate Pages
 */
async function rotatePages(req, res) {
  let job = null;
  try {
    const { fileId, pages, angle = 90 } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required.' });
    }

    const angleInt = parseInt(angle, 10);
    if (![90, 180, 270].includes(angleInt)) {
      return res.status(400).json({
        success: false,
        message: 'Angle must be 90, 180, or 270 degrees.'
      });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'rotate',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const pageNumbers = pages ? (Array.isArray(pages) ? pages : pages.toString().split(',')) : null;

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.rotatePages(fileRec.storage_path, pageNumbers, angleInt, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `rotated_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'PDF rotated successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.rotatePages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 7. Crop Pages
 */
async function cropPages(req, res) {
  let job = null;
  try {
    const { fileId, pages, margins = {} } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required.' });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'crop',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const pageNumbers = pages ? (Array.isArray(pages) ? pages : pages.toString().split(',')) : null;

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.cropPages(fileRec.storage_path, pageNumbers, margins, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `cropped_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'PDF cropped successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.cropPages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 8. Resize Pages
 */
async function resizePages(req, res) {
  let job = null;
  try {
    const { fileId, size = 'A4', orientation = 'portrait' } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required.' });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'resize',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.resizePages(fileRec.storage_path, size, orientation, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `resized_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: `PDF resized to ${size} (${orientation}) successfully.`, result });
  } catch (err) {
    console.error('[pdfOperations.resizePages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 9. Split in Half
 */
async function splitInHalf(req, res) {
  let job = null;
  try {
    const { fileId, orientation = 'vertical' } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required.' });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'split-half',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const { pageCount } = await pdfService.splitInHalf(fileRec.storage_path, orientation, tempOutputPath);

    const result = await registerProcessedFile({
      originalName: `half_split_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'PDF pages split in half successfully.', result });
  } catch (err) {
    console.error('[pdfOperations.splitInHalf] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  mergePdfs,
  extractPages,
  splitPdf,
  deletePages,
  organizePages,
  rotatePages,
  cropPages,
  resizePages,
  splitInHalf
};
