const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const { RESULTS_DIR, ensureDirs } = require('../services/storageService');
const optimizeService = require('../services/optimizeService');
const JobQueueService = require('../services/jobQueueService');

ensureDirs();

async function registerResult({ originalName, storagePath, userId = null, pageCount = 1 }) {
  const resultId = uuidv4();
  const storedName = `${resultId}.pdf`;
  const finalPath = path.join(RESULTS_DIR, storedName);

  if (storagePath !== finalPath && fs.existsSync(storagePath)) {
    fs.renameSync(storagePath, finalPath);
  }

  const stats = fs.statSync(finalPath);
  const fileRecord = await FileModel.create({
    id: resultId,
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
 * 1. Compress PDF
 */
async function compress(req, res) {
  let job = null;
  try {
    const { fileId, level = 'medium' } = req.body;
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
      tool_name: 'compress',
      status: 'PROCESSING',
      input_file_id: fileId,
      metadata: { level }
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const stats = await optimizeService.compressPdf(fileRec.storage_path, level, tempOutputPath);

    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}_compressed_${level}.pdf`;

    const result = await registerResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: stats.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `PDF compressed successfully (${stats.savedPercentage}% reduction).`,
      stats,
      result,
      file: result
    });
  } catch (err) {
    console.error('[OptimizeController] Compress error:', err);
    if (job) {
      await ProcessingJob.updateStatus(job.id, {
        status: 'FAILED',
        error_message: err.message
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. Perform OCR (with async job queue support)
 */
async function ocr(req, res) {
  try {
    const { fileId, language = 'eng', sync = false } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required.' });
    }

    const fileRec = await FileModel.findById(fileId);
    if (!fileRec || !fs.existsSync(fileRec.storage_path)) {
      return res.status(404).json({ success: false, message: 'Source PDF not found.' });
    }

    const userId = req.user ? req.user.id : null;
    const queueJob = await JobQueueService.createJob({
      userId,
      toolName: 'ocr',
      inputFileId: fileId
    });

    const runOcrTask = async (onProgress) => {
      const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
      const ocrStats = await optimizeService.performOcr(
        fileRec.storage_path,
        language,
        tempOutputPath,
        onProgress
      );

      const baseName = path.parse(fileRec.original_name).name;
      const outputName = `${baseName}_ocr_${language}.pdf`;

      const result = await registerResult({
        originalName: outputName,
        storagePath: tempOutputPath,
        userId,
        pageCount: ocrStats.pageCount
      });

      return {
        ...result,
        stats: ocrStats
      };
    };

    if (sync === true || req.query.sync === 'true') {
      // Synchronous execution for tests or instant small docs
      JobQueueService.updateJobProgress(queueJob.id, 10, 'Processing OCR...');
      const result = await runOcrTask((p, msg) => JobQueueService.updateJobProgress(queueJob.id, p, msg));
      await JobQueueService.completeJob(queueJob.id, result);

      return res.json({
        success: true,
        message: 'OCR completed successfully.',
        result,
        file: result,
        stats: result.stats
      });
    }

    // Launch background task
    JobQueueService.runAsync(queueJob.id, runOcrTask);

    return res.json({
      success: true,
      async: true,
      jobId: queueJob.id,
      message: `OCR processing started for language ${language}.`
    });
  } catch (err) {
    console.error('[OptimizeController] OCR error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. Deskew Scanned Document
 */
async function deskew(req, res) {
  let job = null;
  try {
    const { fileId, angleDegrees = 0 } = req.body;
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
      tool_name: 'deskew',
      status: 'PROCESSING',
      input_file_id: fileId,
      metadata: { angleDegrees }
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const deskewStats = await optimizeService.deskewPdf(fileRec.storage_path, Number(angleDegrees) || 0, tempOutputPath);

    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}_deskewed.pdf`;

    const result = await registerResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: deskewStats.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `Document straightened by ${deskewStats.appliedCorrectionAngle} degrees.`,
      result,
      file: result,
      stats: deskewStats
    });
  } catch (err) {
    console.error('[OptimizeController] Deskew error:', err);
    if (job) {
      await ProcessingJob.updateStatus(job.id, {
        status: 'FAILED',
        error_message: err.message
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. Convert to Grayscale
 */
async function grayscale(req, res) {
  let job = null;
  try {
    const { fileId } = req.body;
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
      tool_name: 'grayscale',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const gsStats = await optimizeService.convertToGrayscale(fileRec.storage_path, tempOutputPath);

    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}_grayscale.pdf`;

    const result = await registerResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: gsStats.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'PDF converted to grayscale successfully.',
      result,
      file: result
    });
  } catch (err) {
    console.error('[OptimizeController] Grayscale error:', err);
    if (job) {
      await ProcessingJob.updateStatus(job.id, {
        status: 'FAILED',
        error_message: err.message
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. Flatten Form Fields and Annotations
 */
async function flatten(req, res) {
  let job = null;
  try {
    const { fileId } = req.body;
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
      tool_name: 'flatten',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const flatStats = await optimizeService.flattenPdf(fileRec.storage_path, tempOutputPath);

    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}_flattened.pdf`;

    const result = await registerResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: flatStats.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `PDF flattened successfully (${flatStats.flattenedFieldsCount} form fields consolidated).`,
      result,
      file: result,
      stats: flatStats
    });
  } catch (err) {
    console.error('[OptimizeController] Flatten error:', err);
    if (job) {
      await ProcessingJob.updateStatus(job.id, {
        status: 'FAILED',
        error_message: err.message
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 6. Get Status of Asynchronous Job
 */
async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID required.' });
    }

    // Check active memory queue first
    const activeState = JobQueueService.getJob(jobId);
    if (activeState) {
      return res.json({
        success: true,
        job: activeState
      });
    }

    // Fallback to database
    const dbJob = await ProcessingJob.findById(jobId);
    if (!dbJob) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    return res.json({
      success: true,
      job: {
        id: dbJob.id,
        toolName: dbJob.tool_name,
        status: dbJob.status,
        progress: dbJob.status === 'COMPLETED' ? 100 : 0,
        result: dbJob.output_file_id ? { id: dbJob.output_file_id } : null,
        error: dbJob.error_message
      }
    });
  } catch (err) {
    console.error('[OptimizeController] GetJobStatus error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  compress,
  ocr,
  deskew,
  grayscale,
  flatten,
  getJobStatus
};
