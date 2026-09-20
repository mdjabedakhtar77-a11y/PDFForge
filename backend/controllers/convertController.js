const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const { RESULTS_DIR, TEMP_DIR, ensureDirs } = require('../services/storageService');
const convertService = require('../services/convertService');
const JobQueueService = require('../services/jobQueueService');

ensureDirs();

const MIME_TYPES = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

/**
 * Register converted output file in database & move to results directory
 */
async function registerConvertedResult({ originalName, storagePath, userId = null, pageCount = 1 }) {
  const ext = path.extname(originalName).toLowerCase() || path.extname(storagePath).toLowerCase() || '.bin';
  const resultId = uuidv4();
  const storedName = `${resultId}${ext}`;
  const finalPath = path.join(RESULTS_DIR, storedName);

  if (storagePath !== finalPath && fs.existsSync(storagePath)) {
    fs.renameSync(storagePath, finalPath);
  }

  const stats = fs.statSync(finalPath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  const fileRecord = await FileModel.create({
    id: resultId,
    user_id: userId,
    original_name: originalName,
    stored_name: storedName,
    mime_type: mimeType,
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
    mimeType: fileRecord.mime_type,
    viewUrl: `/api/files/${fileRecord.id}/view`,
    downloadUrl: `/api/files/${fileRecord.id}/download`
  };
}

/**
 * Helper to fetch and validate input file
 */
async function getValidSourceFile(fileId) {
  if (!fileId) {
    throw new Error('fileId is required.');
  }
  const file = await FileModel.findById(fileId);
  if (!file || !fs.existsSync(file.storage_path)) {
    throw new Error(`Source file [${fileId}] not found or has expired.`);
  }
  return file;
}

/**
 * 1. PDF to Word (DOCX)
 */
async function pdfToWord(req, res) {
  let job = null;
  try {
    const { fileId, pages, isAsync = false } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}.docx`;

    if (isAsync) {
      const asyncJob = await JobQueueService.createJob({
        userId,
        toolName: 'pdf-to-word',
        inputFileId: fileId
      });

      JobQueueService.runAsync(asyncJob.id, async (reportProgress) => {
        reportProgress(30, 'Extracting document text & layout...');
        const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.docx`);
        const result = await convertService.pdfToDocx(fileRec.storage_path, tempOutputPath, { pages });
        reportProgress(80, 'Packaging Word (.docx) OpenXML structure...');
        const registered = await registerConvertedResult({
          originalName: outputName,
          storagePath: tempOutputPath,
          userId,
          pageCount: result.pageCount
        });
        return registered;
      });

      return res.status(202).json({
        success: true,
        message: 'PDF to Word conversion initiated.',
        jobId: asyncJob.id
      });
    }

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'pdf-to-word',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.docx`);
    const conversion = await convertService.pdfToDocx(fileRec.storage_path, tempOutputPath, { pages });
    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'PDF successfully converted to Word (.docx).',
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.pdfToWord] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. PDF to Excel (XLSX / CSV)
 */
async function pdfToExcel(req, res) {
  let job = null;
  try {
    const { fileId, pages, format = 'xlsx', isAsync = false } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;
    const ext = format.toLowerCase() === 'csv' ? '.csv' : '.xlsx';
    const outputName = `${baseName}${ext}`;

    if (isAsync) {
      const asyncJob = await JobQueueService.createJob({
        userId,
        toolName: 'pdf-to-excel',
        inputFileId: fileId
      });

      JobQueueService.runAsync(asyncJob.id, async (reportProgress) => {
        reportProgress(30, 'Detecting tabular structures & cells...');
        const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}${ext}`);
        const result = await convertService.pdfToExcel(fileRec.storage_path, tempOutputPath, { pages, format });
        reportProgress(85, 'Formatting spreadsheet workbook...');
        const registered = await registerConvertedResult({
          originalName: outputName,
          storagePath: tempOutputPath,
          userId,
          pageCount: result.pageCount
        });
        return registered;
      });

      return res.status(202).json({
        success: true,
        message: 'PDF to Excel conversion initiated.',
        jobId: asyncJob.id
      });
    }

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'pdf-to-excel',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}${ext}`);
    const conversion = await convertService.pdfToExcel(fileRec.storage_path, tempOutputPath, { pages, format });
    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `PDF successfully converted to ${format.toUpperCase()}.`,
      stats: { rows: conversion.rowCount, format: conversion.format },
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.pdfToExcel] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. PDF to Images (JPG / PNG)
 */
async function pdfToImages(req, res) {
  let job = null;
  try {
    const { fileId, pages, format = 'png', dpi = 150, quality = 0.9, isAsync = false } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;

    if (isAsync) {
      const asyncJob = await JobQueueService.createJob({
        userId,
        toolName: 'pdf-to-images',
        inputFileId: fileId
      });

      JobQueueService.runAsync(asyncJob.id, async (reportProgress) => {
        reportProgress(20, 'Rendering high-resolution canvas pages...');
        const tempOutputDir = path.join(TEMP_DIR, `imgs_${uuidv4()}`);
        fs.mkdirSync(tempOutputDir, { recursive: true });

        const conversion = await convertService.pdfToImages(fileRec.storage_path, tempOutputDir, {
          pages,
          format,
          dpi,
          quality
        });

        reportProgress(85, 'Packaging image bundle...');
        const outputExt = conversion.isZip ? '.zip' : (format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg' ? '.jpg' : '.png');
        const outputName = `${baseName}_${dpi}dpi${outputExt}`;

        const registered = await registerConvertedResult({
          originalName: outputName,
          storagePath: conversion.outputPath,
          userId,
          pageCount: conversion.imageCount
        });
        return registered;
      });

      return res.status(202).json({
        success: true,
        message: 'PDF to Images rendering initiated.',
        jobId: asyncJob.id
      });
    }

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'pdf-to-images',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputDir = path.join(TEMP_DIR, `imgs_${uuidv4()}`);
    fs.mkdirSync(tempOutputDir, { recursive: true });

    const conversion = await convertService.pdfToImages(fileRec.storage_path, tempOutputDir, {
      pages,
      format,
      dpi,
      quality
    });

    const outputExt = conversion.isZip ? '.zip' : (format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg' ? '.jpg' : '.png');
    const outputName = `${baseName}_${dpi}dpi${outputExt}`;

    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: conversion.outputPath,
      userId,
      pageCount: conversion.imageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `Rendered ${conversion.imageCount} image(s) at ${dpi} DPI.`,
      stats: {
        imageCount: conversion.imageCount,
        dpi: conversion.dpi,
        format: conversion.format,
        isZip: conversion.isZip
      },
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.pdfToImages] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. PDF to PowerPoint (PPTX)
 */
async function pdfToPptx(req, res) {
  let job = null;
  try {
    const { fileId, pages, isAsync = false } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}.pptx`;

    if (isAsync) {
      const asyncJob = await JobQueueService.createJob({
        userId,
        toolName: 'pdf-to-pptx',
        inputFileId: fileId
      });

      JobQueueService.runAsync(asyncJob.id, async (reportProgress) => {
        reportProgress(25, 'Rendering slide layers & extracting presentation outlines...');
        const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pptx`);
        const result = await convertService.pdfToPptx(fileRec.storage_path, tempOutputPath, { pages });
        reportProgress(85, 'Finalizing PowerPoint presentation XML...');
        const registered = await registerConvertedResult({
          originalName: outputName,
          storagePath: tempOutputPath,
          userId,
          pageCount: result.slideCount
        });
        return registered;
      });

      return res.status(202).json({
        success: true,
        message: 'PDF to PowerPoint conversion initiated.',
        jobId: asyncJob.id
      });
    }

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'pdf-to-pptx',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pptx`);
    const conversion = await convertService.pdfToPptx(fileRec.storage_path, tempOutputPath, { pages });
    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.slideCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'PDF successfully converted to PowerPoint (.pptx).',
      stats: { slideCount: conversion.slideCount },
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.pdfToPptx] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. PDF to Text (TXT)
 */
async function pdfToText(req, res) {
  let job = null;
  try {
    const { fileId, pages } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}.txt`;

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'pdf-to-text',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.txt`);
    const conversion = await convertService.pdfToText(fileRec.storage_path, tempOutputPath, { pages });
    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'Text extracted successfully.',
      text: conversion.text || '',
      stats: { characters: conversion.characterCount, pages: conversion.pageCount },
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.pdfToText] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 6. Word (DOCX) to PDF
 */
async function docxToPdf(req, res) {
  let job = null;
  try {
    const { fileId } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const userId = req.user ? req.user.id : null;
    const baseName = path.parse(fileRec.original_name).name;
    const outputName = `${baseName}.pdf`;

    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'docx-to-pdf',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const conversion = await convertService.docxToPdf(fileRec.storage_path, tempOutputPath);
    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'DOCX document converted to PDF successfully.',
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.docxToPdf] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 7. Images (JPG / PNG) to PDF
 */
async function imagesToPdf(req, res) {
  let job = null;
  try {
    const { fileIds, orientation = 'auto', margin = 20 } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ success: false, message: 'fileIds array is required.' });
    }

    const imagePaths = [];
    for (const id of fileIds) {
      const fileRec = await getValidSourceFile(id);
      imagePaths.push(fileRec.storage_path);
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'images-to-pdf',
      status: 'PROCESSING',
      input_file_id: fileIds[0]
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const conversion = await convertService.imagesToPdf(imagePaths, tempOutputPath, { orientation, margin });
    const outputName = `images_converted_${Date.now()}.pdf`;

    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: `Combined ${imagePaths.length} image(s) into PDF.`,
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.imagesToPdf] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 8. HTML to PDF
 */
async function htmlToPdf(req, res) {
  let job = null;
  try {
    const { html, fileId } = req.body;
    let htmlContent = html;

    if (!htmlContent && fileId) {
      const fileRec = await getValidSourceFile(fileId);
      htmlContent = fs.readFileSync(fileRec.storage_path, 'utf8');
    }

    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim() === '') {
      return res.status(400).json({ success: false, message: 'html string or valid html fileId is required.' });
    }

    const userId = req.user ? req.user.id : null;
    job = await ProcessingJob.create({
      user_id: userId,
      tool_name: 'html-to-pdf',
      status: 'PROCESSING',
      input_file_id: fileId || null
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const conversion = await convertService.htmlToPdf(htmlContent, tempOutputPath);
    const outputName = `html_document_${Date.now()}.pdf`;

    const result = await registerConvertedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId,
      pageCount: conversion.pageCount
    });

    await ProcessingJob.updateStatus(job.id, {
      status: 'COMPLETED',
      output_file_id: result.id
    });

    return res.json({
      success: true,
      message: 'HTML content converted to PDF successfully.',
      result,
      file: result
    });
  } catch (err) {
    console.error('[ConvertController.htmlToPdf] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  pdfToWord,
  pdfToExcel,
  pdfToImages,
  pdfToPptx,
  pdfToText,
  docxToPdf,
  imagesToPdf,
  htmlToPdf
};
