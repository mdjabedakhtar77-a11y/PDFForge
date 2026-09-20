const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const { RESULTS_DIR, ensureDirs } = require('../services/storageService');
const editorService = require('../services/editorService');

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
 * 1. Apply visual elements (text, shapes, whiteouts, drawings, signatures)
 */
async function applyElements(req, res) {
  let job = null;
  try {
    const { fileId, elements = [] } = req.body;
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
      tool_name: 'editor',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_edit_${uuidv4()}.pdf`);
    const { pageCount } = await editorService.applyEditorElements(fileRec.storage_path, elements, tempOutputPath);

    const result = await registerResult({
      originalName: `edited_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Editor changes applied successfully.', result });
  } catch (err) {
    console.error('[editorController.applyElements] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. Create interactive fillable AcroForm
 */
async function createForms(req, res) {
  let job = null;
  try {
    const { fileId, formFields = [] } = req.body;
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
      tool_name: 'forms',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_form_${uuidv4()}.pdf`);
    const { pageCount } = await editorService.createAcroForm(fileRec.storage_path, formFields, tempOutputPath);

    const result = await registerResult({
      originalName: `form_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Fillable form fields generated successfully.', result });
  } catch (err) {
    console.error('[editorController.createForms] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. Remove Annotations
 */
async function removeAnnotations(req, res) {
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
      tool_name: 'remove-annotations',
      status: 'PROCESSING',
      input_file_id: fileId
    });

    const tempOutputPath = path.join(RESULTS_DIR, `temp_clean_${uuidv4()}.pdf`);
    const { pageCount } = await editorService.removeAnnotations(fileRec.storage_path, tempOutputPath);

    const result = await registerResult({
      originalName: `cleaned_${fileRec.original_name}`,
      storagePath: tempOutputPath,
      userId,
      pageCount
    });

    await ProcessingJob.updateStatus(job.id, { status: 'COMPLETED', output_file_id: result.id });
    return res.json({ success: true, message: 'Document annotations stripped cleanly.', result });
  } catch (err) {
    console.error('[editorController.removeAnnotations] Error:', err);
    if (job) await ProcessingJob.updateStatus(job.id, { status: 'FAILED', error_message: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  applyElements,
  createForms,
  removeAnnotations
};
