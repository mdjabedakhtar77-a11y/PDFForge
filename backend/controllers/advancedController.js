const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const { RESULTS_DIR, TEMP_DIR, ensureDirs } = require('../services/storageService');
const advancedService = require('../services/advancedService');

ensureDirs();

async function registerAdvancedResult({ originalName, storagePath, userId = null, pageCount = 1, isZip = false }) {
  const ext = isZip ? '.zip' : (path.extname(originalName).toLowerCase() || '.pdf');
  const resultId = uuidv4();
  const storedName = `${resultId}${ext}`;
  const finalPath = path.join(RESULTS_DIR, storedName);

  if (storagePath !== finalPath && fs.existsSync(storagePath)) {
    fs.renameSync(storagePath, finalPath);
  }

  const stats = fs.statSync(finalPath);
  const mimeType = isZip ? 'application/zip' : 'application/pdf';

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

async function getValidSourceFile(fileId) {
  if (!fileId) throw new Error('fileId is required.');
  const file = await FileModel.findById(fileId);
  if (!file || !fs.existsSync(file.storage_path)) {
    throw new Error(`Source file [${fileId}] not found or has expired.`);
  }
  return file;
}

// 1. Alternate & Mix
async function alternateAndMix(req, res) {
  try {
    const { fileIds, reverseSecond = false } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 fileIds are required for alternate & mix.' });
    }

    const filePaths = [];
    for (const id of fileIds) {
      const rec = await getValidSourceFile(id);
      filePaths.push(rec.storage_path);
    }

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.alternateAndMix(filePaths, tempOutputPath, { reverseSecond });
    const outputName = `mixed_document_${Date.now()}.pdf`;

    const file = await registerAdvancedResult({
      originalName: outputName,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `Mixed ${filePaths.length} documents (${result.pageCount} pages).`, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.alternateAndMix]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Split By Bookmarks
async function splitByBookmarks(req, res) {
  try {
    const { fileId } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const tempDir = path.join(TEMP_DIR, `bkm_${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const result = await advancedService.splitByBookmarks(fileRec.storage_path, tempDir);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_by_bookmarks.zip`,
      storagePath: result.outputPath,
      userId: req.user?.id,
      pageCount: result.chunkCount,
      isZip: true
    });

    return res.json({ success: true, message: `Split into ${result.chunkCount} section(s).`, stats: { chunkCount: result.chunkCount }, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.splitByBookmarks]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Split By Size
async function splitBySize(req, res) {
  try {
    const { fileId, maxSizeMB = 2 } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const maxSizeBytes = (parseFloat(maxSizeMB) || 2) * 1024 * 1024;

    const tempDir = path.join(TEMP_DIR, `size_${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const result = await advancedService.splitBySize(fileRec.storage_path, tempDir, maxSizeBytes);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_split_by_size.zip`,
      storagePath: result.outputPath,
      userId: req.user?.id,
      pageCount: result.chunkCount,
      isZip: true
    });

    return res.json({ success: true, message: `Document divided into ${result.chunkCount} files under ${maxSizeMB} MB.`, stats: { chunkCount: result.chunkCount }, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.splitBySize]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Split By Text
async function splitByText(req, res) {
  try {
    const { fileId, triggerText = 'chapter' } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempDir = path.join(TEMP_DIR, `txt_${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const result = await advancedService.splitByText(fileRec.storage_path, tempDir, triggerText);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_split_by_text.zip`,
      storagePath: result.outputPath,
      userId: req.user?.id,
      pageCount: result.chunkCount,
      isZip: true
    });

    return res.json({ success: true, message: `Split on "${triggerText}" into ${result.chunkCount} document(s).`, stats: { chunkCount: result.chunkCount, trigger: triggerText }, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.splitByText]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Bates Numbering
async function bates(req, res) {
  try {
    const { fileId, prefix, suffix, startNumber, digits, position, fontSize, color, pages } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.applyBatesNumbering(fileRec.storage_path, tempOutputPath, {
      prefix, suffix, startNumber, digits, position, fontSize, color, pages
    });

    const baseName = path.parse(fileRec.original_name).name;
    const file = await registerAdvancedResult({
      originalName: `${baseName}_bates_${result.startNumber}-${result.endNumber}.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `Applied Bates numbering to ${result.pageCount} page(s).`, stats: result, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.bates]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Create Bookmarks
async function bookmarks(req, res) {
  try {
    const { fileId, bookmarks } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.createBookmarks(fileRec.storage_path, tempOutputPath, bookmarks);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_with_bookmarks.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `Created Table of Contents with ${result.bookmarkCount} bookmark(s).`, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.bookmarks]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Edit Metadata
async function metadata(req, res) {
  try {
    const { fileId, title, author, subject, keywords, creator, producer } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.editMetadata(fileRec.storage_path, tempOutputPath, {
      title, author, subject, keywords, creator, producer
    });

    const baseName = path.parse(fileRec.original_name).name;
    const file = await registerAdvancedResult({
      originalName: `${baseName}_meta_updated.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: fileRec.page_count
    });

    return res.json({ success: true, message: 'Document metadata updated successfully.', metadata: result.metadata, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.metadata]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Extract Images
async function extractImages(req, res) {
  try {
    const { fileId } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempDir = path.join(TEMP_DIR, `ext_imgs_${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const result = await advancedService.extractImages(fileRec.storage_path, tempDir);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_extracted_images.zip`,
      storagePath: result.outputPath,
      userId: req.user?.id,
      pageCount: result.imageCount,
      isZip: true
    });

    return res.json({ success: true, message: `Extracted ${result.imageCount} image(s) from document.`, stats: { imageCount: result.imageCount }, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.extractImages]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 9. Flip
async function flip(req, res) {
  try {
    const { fileId, direction = 'horizontal' } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.flipPages(fileRec.storage_path, tempOutputPath, direction);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_flipped_${direction}.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `Document flipped ${direction}ly.`, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.flip]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 10. Header & Footer
async function headerFooter(req, res) {
  try {
    const { fileId, headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight, fontSize, color, pages } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.applyHeaderFooter(fileRec.storage_path, tempOutputPath, {
      headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight, fontSize, color, pages
    });

    const baseName = path.parse(fileRec.original_name).name;
    const file = await registerAdvancedResult({
      originalName: `${baseName}_header_footer.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: 'Header & Footer applied successfully.', result: file, file });
  } catch (err) {
    console.error('[AdvancedController.headerFooter]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 11. N-Up
async function nUp(req, res) {
  try {
    const { fileId, n = 2, margin = 15 } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.nUp(fileRec.storage_path, tempOutputPath, { n, margin });
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_${n}up.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.outputPages
    });

    return res.json({ success: true, message: `Imposed ${result.inputPages} pages into ${result.outputPages} ${n}-up sheet(s).`, stats: result, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.nUp]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 12. Page Numbers
async function pageNumbers(req, res) {
  try {
    const { fileId, format = 'Page {n} of {total}', position = 'bottom-center', startNumber = 1, fontSize = 10, color = '#333333', pages } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.applyPageNumbers(fileRec.storage_path, tempOutputPath, {
      format, position, startNumber, fontSize, color, pages
    });

    const baseName = path.parse(fileRec.original_name).name;
    const file = await registerAdvancedResult({
      originalName: `${baseName}_numbered.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `Numbered ${result.pageCount} page(s).`, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.pageNumbers]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 13. Rename (Suggest & Apply)
async function suggestName(req, res) {
  try {
    const { fileId } = req.body;
    const fileRec = await getValidSourceFile(fileId);
    const suggestion = await advancedService.detectRename(fileRec.storage_path);
    return res.json({ success: true, suggestion });
  } catch (err) {
    console.error('[AdvancedController.suggestName]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function rename(req, res) {
  try {
    const { fileId, newName } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    let finalName = (newName || '').trim();
    if (!finalName) {
      const suggestion = await advancedService.detectRename(fileRec.storage_path);
      finalName = suggestion.suggestedName;
    }
    if (!finalName.toLowerCase().endsWith('.pdf')) {
      finalName += '.pdf';
    }

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    fs.copyFileSync(fileRec.storage_path, tempOutputPath);

    const file = await registerAdvancedResult({
      originalName: finalName,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: fileRec.page_count
    });

    return res.json({ success: true, message: `Document renamed to "${finalName}".`, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.rename]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 14. Repair PDF
async function repair(req, res) {
  try {
    const { fileId } = req.body;
    const fileRec = await getValidSourceFile(fileId);

    const tempOutputPath = path.join(RESULTS_DIR, `temp_${uuidv4()}.pdf`);
    const result = await advancedService.repairPdf(fileRec.storage_path, tempOutputPath);
    const baseName = path.parse(fileRec.original_name).name;

    const file = await registerAdvancedResult({
      originalName: `${baseName}_repaired.pdf`,
      storagePath: tempOutputPath,
      userId: req.user?.id,
      pageCount: result.pageCount
    });

    return res.json({ success: true, message: `PDF document repaired and validated (${result.pageCount} pages).`, stats: result, result: file, file });
  } catch (err) {
    console.error('[AdvancedController.repair]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  alternateAndMix,
  splitByBookmarks,
  splitBySize,
  splitByText,
  bates,
  bookmarks,
  metadata,
  extractImages,
  flip,
  headerFooter,
  nUp,
  pageNumbers,
  suggestName,
  rename,
  repair
};
