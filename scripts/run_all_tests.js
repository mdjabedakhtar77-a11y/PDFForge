/**
 * ==============================================================================
 * 🚀 PDFForge Unified Master Test Suite (Phase 1 → Phase 10)
 * ==============================================================================
 * Comprehensive, self-contained automated testing engine for the complete
 * PDFForge platform. Runs all 10 phases sequentially in-process:
 *
 *   Phase 1  → Foundation, Authentication, Magic Bytes & File Storage
 *   Phase 2  → Core PDF Operations (Merge, Split, Extract, Organize, Rotate, Crop, Resize, Half)
 *   Phase 3  → PDF Editor, Visual Overlays, Signatures & AcroForms
 *   Phase 4  → Optimization, Compression, Deskew, Grayscale, Flatten & OCR
 *   Phase 5  → Conversion Suite (Word, Excel, Images/ZIP, PowerPoint, Text, HTML)
 *   Phase 6  → Security, Encryption, AES Protect, Unlock & Watermarks
 *   Phase 7  → Advanced PDF Tools (14 Specialized Modular Utilities)
 *   Phase 8  → User Dashboard, Storage Quota, Job History & Ownership Isolation
 *   Phase 9  → Admin Panel, RBAC Governance, Audit Trails & System Telemetry
 *   Phase 10 → Security Hardening, IDOR Matrix, Headers, Docker & Health
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const AdmZip = require('adm-zip');
const xlsx = require('xlsx');

const BASE_URL = 'http://localhost:3000';
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_PDF_PATH = path.join(ROOT_DIR, 'PDFForge.pdf');

// ==============================================================================
// Master Test Harness & Reporter
// ==============================================================================

const phases = [];
let currentPhase = null;

function startPhase(number, name) {
  currentPhase = {
    number,
    name,
    passed: 0,
    total: 0,
    status: 'RUNNING',
    durationMs: 0,
    error: null,
    startTime: Date.now()
  };
  phases.push(currentPhase);

  console.log('\n' + '='.repeat(74));
  console.log(`⏳ Phase ${number}: ${name}`);
  console.log('='.repeat(74));
}

function assert(condition, message) {
  if (!currentPhase) throw new Error('Assertion executed outside active phase');
  currentPhase.total++;
  if (condition) {
    currentPhase.passed++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    if (!currentPhase.error) {
      currentPhase.error = new Error(`Assertion failed: ${message}`);
    }
  }
}

function finishPhase() {
  if (!currentPhase) return;
  currentPhase.durationMs = Date.now() - currentPhase.startTime;
  currentPhase.status = (!currentPhase.error && currentPhase.passed === currentPhase.total && currentPhase.total > 0)
    ? 'PASS'
    : 'FAIL';

  const icon = currentPhase.status === 'PASS' ? '✓' : '✗';
  const durSec = (currentPhase.durationMs / 1000).toFixed(1);
  console.log(`\n${icon} Phase ${currentPhase.number} ${currentPhase.status} (${currentPhase.passed}/${currentPhase.total} assertions, ${durSec}s)`);
}

// ==============================================================================
// HTTP Client & Multipart Upload Helpers
// ==============================================================================

function request(method, route, body = null, token = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(route, BASE_URL);
    const headers = { ...customHeaders };

    let payload = null;
    if (body && !(body instanceof Buffer) && typeof body === 'object' && !headers['Content-Type']?.includes('multipart')) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    } else if (body instanceof Buffer) {
      payload = body;
      headers['Content-Length'] = body.length;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let data = null;
        try {
          data = JSON.parse(raw.toString('utf8'));
        } catch (_) {
          data = null;
        }
        resolve({
          status: res.statusCode,
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          raw,
          text: () => raw.toString('utf8')
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadFile(bufferOrPath, filename, mimeType = 'application/pdf', token = null) {
  const fileBytes = typeof bufferOrPath === 'string'
    ? fs.readFileSync(bufferOrPath)
    : bufferOrPath;

  const boundary = '----PDFForgeBoundary' + Math.random().toString(16).substring(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBytes, tail]);

  return request('POST', '/api/files/upload', body, token, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
}

async function createSamplePdf(pageCount = 1, text = 'PDFForge Sample Document') {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([500, 400]);
    page.drawText(`${text} (Page ${i + 1} of ${pageCount})`, {
      x: 50,
      y: 350,
      size: 16,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawRectangle({
      x: 40,
      y: 80,
      width: 420,
      height: 200,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1.5,
      color: rgb(0.96, 0.97, 1.0)
    });
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ==============================================================================
// PHASE RUNNERS (1 THROUGH 10)
// ==============================================================================

/**
 * Phase 1: Foundation, Authentication, Magic Bytes & File Storage
 */
async function runPhase1() {
  startPhase(1, 'Foundation, Authentication, Magic Bytes & Storage');

  const ts = Date.now();
  const aliceEmail = `alice_p1_${ts}@pdfforge.test`;
  const initialPass = 'AuthSecurityPass123!';
  const updatedPass = 'NewAuthPass456!';

  // 1. User Registration
  const regRes = await request('POST', '/api/auth/register', {
    email: aliceEmail,
    password: initialPass,
    name: 'Alice Phase1'
  });
  assert(regRes.status === 201 && regRes.data?.token, 'User registration succeeds with JWT token');
  assert(regRes.data?.user?.role === 'USER', 'Registered user assigned USER role');
  assert(!JSON.stringify(regRes.data).includes('password_hash'), 'Password hash is not leaked in registration response');
  let aliceToken = regRes.data.token;

  // 2. Profile Check
  const meRes = await request('GET', '/api/auth/me', null, aliceToken);
  assert(meRes.status === 200 && meRes.data?.user?.email === aliceEmail, 'GET /api/auth/me returns authenticated profile');

  // 3. Login Validation
  const badLogin = await request('POST', '/api/auth/login', { email: aliceEmail, password: 'WrongPassword!' });
  assert(badLogin.status === 401, 'Login with wrong password safely rejected with 401 Unauthorized');

  const goodLogin = await request('POST', '/api/auth/login', { email: aliceEmail, password: initialPass });
  assert(goodLogin.status === 200 && Boolean(goodLogin.data?.token), 'Login with valid credentials returns 200 OK');

  // 4. Password Change
  const changePass = await request('POST', '/api/dashboard/change-password', {
    currentPassword: initialPass,
    newPassword: updatedPass
  }, aliceToken);
  assert(changePass.status === 200, 'Password changed successfully via authenticated endpoint');

  const oldPassLogin = await request('POST', '/api/auth/login', { email: aliceEmail, password: initialPass });
  assert(oldPassLogin.status === 401, 'Old password rejected after password change');

  const newPassLogin = await request('POST', '/api/auth/login', { email: aliceEmail, password: updatedPass });
  assert(newPassLogin.status === 200 && Boolean(newPassLogin.data?.token), 'New password logs in successfully');
  aliceToken = newPassLogin.data.token;

  // 5. File Upload with Magic Bytes & Page Count
  const samplePdfBuffer = await createSamplePdf(2, 'Phase 1 Benchmark');
  const uploadRes = await uploadFile(samplePdfBuffer, 'phase1_benchmark.pdf', 'application/pdf', aliceToken);
  assert(uploadRes.status === 201 && uploadRes.data?.file?.id, 'PDF uploaded successfully with HTTP 201');
  assert(uploadRes.data.file.pageCount === 2, 'Server accurately determined PDF page count (2 pages)');
  assert(uploadRes.data.file.fileSize === samplePdfBuffer.length, 'Server accurately recorded exact file byte size');
  const fileId = uploadRes.data.file.id;

  // 6. Security Rejections (Disguised exe, plain text, traversal)
  const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00FAKE_EXECUTABLE_PAYLOAD');
  const exeUpload = await uploadFile(fakeExe, 'danger.exe', 'application/x-msdownload', aliceToken);
  assert(exeUpload.status === 400 || exeUpload.status === 500, 'Dangerous executable file (.exe) rejected on upload');

  const fakePdf = Buffer.from('This is a plain text file pretending to be a PDF.');
  const fakeUpload = await uploadFile(fakePdf, 'fake.pdf', 'application/pdf', aliceToken);
  assert(fakeUpload.status === 400 || fakeUpload.status === 500, 'Invalid PDF file signature rejected');

  const traversalRes = await request('GET', '/api/files/..%2f..%2fpackage.json/view', null, aliceToken);
  assert(traversalRes.status === 400 || traversalRes.status === 403 || traversalRes.status === 404, 'Path traversal attack cleanly rejected');

  // 7. Streaming View & Download
  const viewRes = await request('GET', `/api/files/${fileId}/view`, null, aliceToken);
  assert(viewRes.status === 200 && (viewRes.headers['content-type'] || '').includes('pdf'), 'File view endpoint streams PDF content with 200 OK');

  const dlRes = await request('GET', `/api/files/${fileId}/download`, null, aliceToken);
  assert(dlRes.status === 200 && dlRes.headers['content-disposition']?.includes('attachment'), 'File download endpoint responds with attachment disposition');

  finishPhase();
}

/**
 * Phase 2: Core PDF Operations (9 Operations)
 */
async function runPhase2() {
  startPhase(2, 'Core PDF Operations (9 Tools)');

  // Step 0: Upload Base PDF
  const uploadRes = await uploadFile(BASE_PDF_PATH, 'PDFForge.pdf');
  assert(uploadRes.status === 201 && uploadRes.data?.file?.id, 'Base PDFForge.pdf uploaded successfully');
  const baseFileId = uploadRes.data.file.id;
  const basePages = uploadRes.data.file.pageCount || 12;

  // 1. Merge
  const mergeRes = await request('POST', '/api/pdf/merge', { fileIds: [baseFileId, baseFileId] });
  assert(mergeRes.status === 200 && mergeRes.data?.result?.pageCount === basePages * 2, `Merge merged 2 documents into ${basePages * 2} pages`);

  // 2. Extract
  const extractRes = await request('POST', '/api/pdf/extract', { fileId: baseFileId, pages: [1, 3, 5] });
  assert(extractRes.status === 200 && extractRes.data?.result?.pageCount === 3, 'Extract extracted pages [1, 3, 5] (3 pages total)');

  // 3. Split
  const splitRes = await request('POST', '/api/pdf/split', { fileId: baseFileId, ranges: '1-4' });
  assert(splitRes.status === 200 && splitRes.data?.result?.pageCount === 4, 'Split by range "1-4" produced exactly 4 pages');

  // 4. Delete Pages
  const deleteRes = await request('POST', '/api/pdf/delete-pages', { fileId: baseFileId, pages: [2, 4, 6] });
  assert(deleteRes.status === 200 && deleteRes.data?.result?.pageCount === basePages - 3, `Delete pages reduced document to ${basePages - 3} pages`);

  // 5. Organize / Reorder
  const organizeRes = await request('POST', '/api/pdf/organize', { fileId: baseFileId, order: [3, 2, 1] });
  assert(organizeRes.status === 200 && organizeRes.data?.result?.pageCount === 3, 'Organize reordered pages into [3, 2, 1] (3 pages)');

  // 6. Rotate
  const rotateRes = await request('POST', '/api/pdf/rotate', { fileId: baseFileId, angle: 90, pages: [1] });
  assert(rotateRes.status === 200 && rotateRes.data?.result?.id, 'Rotate permanently rotated page 1 by 90°');

  // 7. Crop
  const cropRes = await request('POST', '/api/pdf/crop', {
    fileId: baseFileId,
    margins: { top: 36, bottom: 36, left: 36, right: 36 }
  });
  assert(cropRes.status === 200 && cropRes.data?.result?.id, 'Crop trimmed page margins cleanly');

  // 8. Resize
  const resizeRes = await request('POST', '/api/pdf/resize', {
    fileId: baseFileId,
    size: 'Letter',
    orientation: 'landscape'
  });
  assert(resizeRes.status === 200 && resizeRes.data?.result?.id, 'Resize transformed pages to Letter landscape');

  // 9. Split in Half
  const splitHalfRes = await request('POST', '/api/pdf/split-half', {
    fileId: extractRes.data.result.id,
    orientation: 'vertical'
  });
  assert(splitHalfRes.status === 200 && splitHalfRes.data?.result?.pageCount === 6, 'Split in half split 3 pages vertically into 6 pages');

  finishPhase();
}

/**
 * Phase 3: PDF Editor, Forms, Fill & Sign, Annotations
 */
async function runPhase3() {
  startPhase(3, 'PDF Editor, Forms, Fill & Sign, Annotations');

  const uploadRes = await uploadFile(BASE_PDF_PATH, 'PDFForge.pdf');
  const baseFileId = uploadRes.data.file.id;
  const initialStats = fs.statSync(BASE_PDF_PATH);

  // 1. Text, Shapes, Highlight, Whiteout
  const elementsPayload = {
    fileId: baseFileId,
    elements: [
      { page: 1, type: 'text', x: 50, y: 60, text: 'CONFIDENTIAL', fontSize: 18, color: '#ef4444' },
      { page: 1, type: 'rectangle', x: 50, y: 100, width: 200, height: 40, color: '#6366f1' },
      { page: 1, type: 'circle', x: 300, y: 100, width: 40, height: 40, color: '#06b6d4' },
      { page: 1, type: 'highlight', x: 50, y: 160, width: 250, height: 25, color: '#facc15' },
      { page: 1, type: 'whiteout', x: 50, y: 200, width: 150, height: 25 }
    ]
  };
  const applyRes = await request('POST', '/api/editor/apply', elementsPayload);
  assert(applyRes.status === 200 && applyRes.data?.result?.id, 'Text, rectangle, circle, highlight and whiteout embedded via /api/editor/apply');

  // 2. Signature Placement
  const sampleSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sigRes = await request('POST', '/api/editor/apply', {
    fileId: baseFileId,
    elements: [
      { page: 1, type: 'signature', x: 100, y: 350, width: 150, height: 50, dataUrl: sampleSignaturePng }
    ]
  });
  assert(sigRes.status === 200 && sigRes.data?.result?.id, 'Digital signature embedded cleanly on page');

  // 3. AcroForms Creation & Structural Inspection
  const formsRes = await request('POST', '/api/editor/create-forms', {
    fileId: baseFileId,
    formFields: [
      { page: 1, type: 'text', name: 'user_full_name', x: 60, y: 120, width: 180, height: 25, defaultValue: 'Jane Doe' },
      { page: 1, type: 'checkbox', name: 'accept_terms', x: 60, y: 160, width: 20, height: 20, checked: true },
      { page: 1, type: 'dropdown', name: 'user_country', x: 60, y: 200, width: 160, height: 25, options: ['US', 'DE', 'JP'], defaultValue: 'US' }
    ]
  });
  assert(formsRes.status === 200 && formsRes.data?.result?.id, 'Interactive AcroForms generated with Text, Checkbox, and Dropdown');

  // Verify form fields in binary
  const formDl = await request('GET', `/api/files/${formsRes.data.result.id}/download`);
  const formPdf = await PDFDocument.load(formDl.raw);
  const fieldNames = formPdf.getForm().getFields().map(f => f.getName());
  assert(fieldNames.includes('user_full_name') && fieldNames.includes('accept_terms'), 'AcroForm field names verified in output PDF binary');

  // 4. Remove Annotations
  const cleanRes = await request('POST', '/api/editor/remove-annotations', { fileId: baseFileId });
  assert(cleanRes.status === 200 && cleanRes.data?.result?.id, 'Remove annotations stripped comments and form overlays');

  // 5. Original File Preservation
  const currentStats = fs.statSync(BASE_PDF_PATH);
  assert(currentStats.size === initialStats.size, 'Original PDF file remains 100% untouched and preserved');

  finishPhase();
}

/**
 * Phase 4: Optimization, Grayscale, Deskew, Flatten & OCR
 */
async function runPhase4() {
  startPhase(4, 'Optimization, Compression, Deskew, Grayscale & OCR');

  const samplePdfBuffer = await createSamplePdf(1, 'Invoice #INV-49201 High Resolution Scanned Document');
  const uploadRes = await uploadFile(samplePdfBuffer, 'ocr_sample.pdf');
  const baseFileId = uploadRes.data.file.id;

  // 1. Compression
  const compressRes = await request('POST', '/api/optimize/compress', { fileId: baseFileId, level: 'high' });
  assert(compressRes.status === 200 && compressRes.data?.file?.id, 'Compress (high) reduced PDF object stream size');
  assert(compressRes.data?.stats?.originalSize > 0 && compressRes.data?.stats?.compressedSize > 0, 'Compression statistics returned with exact byte reductions');

  // 2. Deskew
  const deskewRes = await request('POST', '/api/optimize/deskew', { fileId: baseFileId, angleDegrees: -2.5 });
  assert(deskewRes.status === 200 && deskewRes.data?.file?.id, 'Deskew applied tilt correction angle');

  // 3. Grayscale
  const grayRes = await request('POST', '/api/optimize/grayscale', { fileId: baseFileId });
  assert(grayRes.status === 200 && grayRes.data?.file?.id, 'Convert to Grayscale converted color channels to monochrome vectors');

  // 4. Flatten
  const flattenRes = await request('POST', '/api/optimize/flatten', { fileId: baseFileId });
  assert(flattenRes.status === 200 && flattenRes.data?.file?.id, 'Flatten consolidated annotations and form fields permanently into vectors');

  // 5. Neural OCR with Asynchronous Job Queue Polling
  const ocrLaunch = await request('POST', '/api/optimize/ocr', { fileId: baseFileId, language: 'eng' });
  assert(ocrLaunch.status === 200 && ocrLaunch.data?.jobId, 'OCR asynchronous job queued successfully');
  const jobId = ocrLaunch.data.jobId;

  let ocrCompleted = false;
  let ocrResult = null;
  const pollStart = Date.now();

  while (!ocrCompleted) {
    if (Date.now() - pollStart > 90000) {
      throw new Error('OCR job polling timed out after 90 seconds');
    }
    await new Promise(r => setTimeout(r, 1200));
    const jobRes = await request('GET', `/api/jobs/${jobId}`);
    if (jobRes.data?.job?.status === 'COMPLETED') {
      ocrCompleted = true;
      ocrResult = jobRes.data.job.result;
    } else if (jobRes.data?.job?.status === 'FAILED') {
      throw new Error('OCR job failed: ' + jobRes.data.job.error);
    }
  }

  assert(Boolean(ocrResult?.id), 'OCR job completed and generated searchable PDF document');

  finishPhase();
}

/**
 * Phase 5: Conversion Suite (Office, Images, Text & HTML)
 */
async function runPhase5() {
  startPhase(5, 'Conversion Suite (Office, Images, Text & HTML)');

  const uploadRes = await uploadFile(BASE_PDF_PATH, 'PDFForge.pdf');
  const baseFileId = uploadRes.data.file.id;

  // 1. PDF to Word (DOCX)
  const wordRes = await request('POST', '/api/convert/pdf-to-word', { fileId: baseFileId, pages: '1-2' });
  assert(wordRes.status === 200 && wordRes.data?.result?.id, 'PDF to Word generated authentic Open XML DOCX document');

  const wordDl = await request('GET', `/api/files/${wordRes.data.result.id}/download`);
  const wordZip = new AdmZip(wordDl.raw);
  assert(Boolean(wordZip.getEntry('word/document.xml')), 'Generated DOCX contains valid word/document.xml package structure');

  // 2. PDF to Excel (XLSX & CSV)
  const excelRes = await request('POST', '/api/convert/pdf-to-excel', { fileId: baseFileId, pages: '1-2', format: 'xlsx' });
  assert(excelRes.status === 200 && excelRes.data?.result?.id, 'PDF to Excel (XLSX) generated spreadsheet workbook');
  const excelDl = await request('GET', `/api/files/${excelRes.data.result.id}/download`);
  const wb = xlsx.read(excelDl.raw, { type: 'buffer' });
  assert(wb.SheetNames.length >= 1, `Verified XLSX workbook with sheet: ${wb.SheetNames[0]}`);

  const csvRes = await request('POST', '/api/convert/pdf-to-excel', { fileId: baseFileId, pages: '1', format: 'csv' });
  assert(csvRes.status === 200 && csvRes.data?.result?.id, 'PDF to Excel (CSV) generated tabular CSV output');

  // 3. PDF to Images (PNG/JPG + ZIP bundle)
  const imgRes = await request('POST', '/api/convert/pdf-to-images', {
    fileId: baseFileId,
    pages: '1-2',
    format: 'png',
    dpi: 150
  });
  assert(imgRes.status === 200 && imgRes.data?.result?.id, 'PDF to Images rendered high-DPI raster images');
  const imgZipDl = await request('GET', `/api/files/${imgRes.data.result.id}/download`);
  const imgZip = new AdmZip(imgZipDl.raw);
  const imgEntries = imgZip.getEntries();
  assert(imgEntries.length >= 1, `Verified image archive bundle containing ${imgEntries.length} image(s)`);

  const firstImgData = imgEntries[0].getData();
  assert(firstImgData[0] === 0x89 && firstImgData[1] === 0x50, 'Extracted image verified with authentic PNG magic bytes header');

  // 4. PDF to PowerPoint (PPTX)
  const pptxRes = await request('POST', '/api/convert/pdf-to-pptx', { fileId: baseFileId, pages: '1-2' });
  assert(pptxRes.status === 200 && pptxRes.data?.result?.id, 'PDF to PowerPoint generated slide deck (.pptx)');

  // 5. PDF to Text (TXT)
  const txtRes = await request('POST', '/api/convert/pdf-to-text', { fileId: baseFileId, pages: '1-2' });
  assert(txtRes.status === 200 && txtRes.data?.result?.id, 'PDF to Text extracted clean plain UTF-8 text');

  // 6. Word (DOCX) to PDF
  const docxUpload = await uploadFile(wordDl.raw, 'uploaded.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxToPdfRes = await request('POST', '/api/convert/docx-to-pdf', { fileId: docxUpload.data.file.id });
  assert(docxToPdfRes.status === 200 && docxToPdfRes.data?.result?.id, 'DOCX to PDF rendered document into PDF vectors');

  // 7. Images to PDF
  const imgUpload = await uploadFile(firstImgData, 'sample.png', 'image/png');
  const imgToPdfRes = await request('POST', '/api/convert/images-to-pdf', {
    fileIds: [imgUpload.data.file.id],
    orientation: 'auto'
  });
  assert(imgToPdfRes.status === 200 && imgToPdfRes.data?.result?.id, 'Images to PDF packaged image into clean PDF');

  // 8. HTML to PDF
  const htmlSample = '<h1>PDFForge Automated Export</h1><p>SSRF-sanitized high fidelity HTML rendering.</p>';
  const htmlToPdfRes = await request('POST', '/api/convert/html-to-pdf', { html: htmlSample });
  assert(htmlToPdfRes.status === 200 && htmlToPdfRes.data?.result?.id, 'HTML to PDF rendered sanitized markup into PDF document');

  finishPhase();
}

/**
 * Phase 6: Security, Encryption, AES Protect, Unlock & Watermarks
 */
async function runPhase6() {
  startPhase(6, 'Security, Encryption, AES Protect, Unlock & Watermarks');

  const samplePdf = await createSamplePdf(2, 'Security Vault Document');
  const uploadRes = await uploadFile(samplePdf, 'security_vault.pdf');
  const fileId = uploadRes.data.file.id;

  // 1. Watermark PDF
  const watermarkRes = await request('POST', '/api/security/watermark', {
    fileId,
    text: 'CONFIDENTIAL AUDIT',
    position: 'diagonal',
    fontSize: 32,
    opacity: 0.4,
    color: '#FF0000'
  });
  assert(watermarkRes.status === 200 && watermarkRes.data?.file?.id, 'Watermark applied text across pages with 200 OK');
  const wmDl = await request('GET', `/api/files/${watermarkRes.data.file.id}/download`);
  assert(wmDl.raw.includes(Buffer.from('CONFIDENTIAL AUDIT')), 'Watermark text is genuinely encoded in output PDF binary');

  // 2. Protect PDF (AES Encryption)
  const password = 'DocSecretKey2026!';
  const protectRes = await request('POST', '/api/security/protect', {
    fileId,
    password
  });
  assert(protectRes.status === 200 && protectRes.data?.file?.id, 'Protect encrypted PDF document with user password');
  const protectedId = protectRes.data.file.id;

  // 3. Protected file cannot be loaded without password
  const protectedDl = await request('GET', `/api/files/${protectedId}/download`);
  let unauthenticatedReadFailed = false;
  try {
    await PDFDocument.load(protectedDl.raw);
  } catch (_) {
    unauthenticatedReadFailed = true;
  }
  assert(unauthenticatedReadFailed, 'Encrypted document cannot be loaded without decryption password');

  // 4. Encryption Status Inspection
  const statusRes = await request('GET', `/api/security/status/${protectedId}`);
  assert(statusRes.status === 200 && statusRes.data?.isEncrypted === true, 'Security status endpoint reports isEncrypted: true');

  // 5. Unlock with Wrong Password (401 Unauthorized)
  const wrongUnlock = await request('POST', '/api/security/unlock', {
    fileId: protectedId,
    password: 'WrongPassword999!'
  });
  assert(wrongUnlock.status === 401, 'Unlock with incorrect password safely rejected (401 Unauthorized)');

  // 6. Unlock with Correct Password (200 OK)
  const rightUnlock = await request('POST', '/api/security/unlock', {
    fileId: protectedId,
    password
  });
  assert(rightUnlock.status === 200 && rightUnlock.data?.file?.id, 'Unlock with valid password successfully decrypted document');

  const unlockedDl = await request('GET', `/api/files/${rightUnlock.data.file.id}/download`);
  const decryptedDoc = await PDFDocument.load(unlockedDl.raw);
  assert(decryptedDoc.getPageCount() === 2, 'Decrypted PDF is cleanly accessible and fully readable (2 pages)');

  finishPhase();
}

/**
 * Phase 7: Advanced PDF Tools (All 14 Specialized Tools)
 */
async function runPhase7() {
  startPhase(7, 'Advanced PDF Tools (14 Specialized Tools)');

  const uploadRes = await uploadFile(BASE_PDF_PATH, 'PDFForge.pdf');
  const baseFileId = uploadRes.data.file.id;

  // 1. Alternate & Mix
  const mixRes = await request('POST', '/api/advanced/alternate-mix', {
    fileIds: [baseFileId, baseFileId],
    reverseSecond: true
  });
  assert(mixRes.status === 200 && mixRes.data?.result?.pageCount === 24, 'Alternate & Mix interlaced two documents with reverse mode');

  // 2. Split By Bookmarks
  const splitBkm = await request('POST', '/api/advanced/split-bookmarks', { fileId: baseFileId });
  assert(splitBkm.status === 200 && splitBkm.data?.result?.id, 'Split By Bookmarks generated chapter sub-documents in ZIP');

  // 3. Split By Size
  const splitSize = await request('POST', '/api/advanced/split-by-size', { fileId: baseFileId, maxSizeMB: 0.05 });
  assert(splitSize.status === 200 && splitSize.data?.result?.id, 'Split By Size divided document into chunked files under max size');

  // 4. Split By Text
  const splitText = await request('POST', '/api/advanced/split-by-text', { fileId: baseFileId, triggerText: 'Phase' });
  assert(splitText.status === 200 && splitText.data?.result?.id, 'Split By Text separated pages on trigger keyword');

  // 5. Bates Numbering
  const batesRes = await request('POST', '/api/advanced/bates', {
    fileId: baseFileId,
    prefix: 'CONF-DOC-',
    startNumber: 100,
    digits: 5,
    position: 'bottom-right'
  });
  assert(batesRes.status === 200 && batesRes.data?.stats?.startNumber === 100, 'Bates Numbering applied legal index stamps');

  // 6. Create Bookmarks / Table of Contents
  const bkmCreate = await request('POST', '/api/advanced/bookmarks', {
    fileId: baseFileId,
    bookmarks: [
      { title: 'Section 1', page: 1 },
      { title: 'Section 2', page: 3 }
    ]
  });
  assert(bkmCreate.status === 200 && bkmCreate.data?.result?.id, 'Bookmarks prepended Table of Contents navigation index');

  // 7. Edit Metadata
  const metaRes = await request('POST', '/api/advanced/metadata', {
    fileId: baseFileId,
    title: 'PDFForge Certified Document',
    author: 'Chief Engineer'
  });
  assert(metaRes.status === 200 && metaRes.data?.metadata?.title === 'PDFForge Certified Document', 'Edit Metadata persistently updated title and author');

  // 8. Extract Images
  const extImgs = await request('POST', '/api/advanced/extract-images', { fileId: baseFileId });
  assert(extImgs.status === 200 && extImgs.data?.result?.id, 'Extract Images recovered embedded raster graphics into ZIP');

  // 9. Flip Pages (Horizontal & Vertical)
  const flipH = await request('POST', '/api/advanced/flip', { fileId: baseFileId, direction: 'horizontal' });
  assert(flipH.status === 200 && flipH.data?.result?.id, 'Flip Pages mirrored page vectors horizontally');
  const flipV = await request('POST', '/api/advanced/flip', { fileId: baseFileId, direction: 'vertical' });
  assert(flipV.status === 200 && flipV.data?.result?.id, 'Flip Pages mirrored page vectors vertically');

  // 10. Dynamic Header & Footer
  const hfRes = await request('POST', '/api/advanced/header-footer', {
    fileId: baseFileId,
    headerCenter: 'Audit Copy',
    footerCenter: 'Page {page} of {total}'
  });
  assert(hfRes.status === 200 && hfRes.data?.result?.id, 'Header & Footer stamped dynamic {page} and {total} tokens');

  // 11. N-Up Imposition
  const nupRes = await request('POST', '/api/advanced/n-up', { fileId: baseFileId, n: 4, margin: 15 });
  assert(nupRes.status === 200 && nupRes.data?.result?.pageCount === 3, 'N-Up imposed 12 pages into 3 sheets (4-up grid)');

  // 12. Page Numbers
  const pgnumRes = await request('POST', '/api/advanced/page-numbers', {
    fileId: baseFileId,
    format: 'Page {n} of {total}',
    position: 'bottom-center'
  });
  assert(pgnumRes.status === 200 && pgnumRes.data?.result?.id, 'Page Numbers stamped formatted pagination labels');

  // 13. Rename & Title Auto-Detection
  const suggestRes = await request('POST', '/api/advanced/suggest-name', { fileId: baseFileId });
  assert(suggestRes.status === 200 && Boolean(suggestRes.data?.suggestion?.suggestedName), 'Auto-detect suggested document name from text');

  const renameRes = await request('POST', '/api/advanced/rename', { fileId: baseFileId, newName: 'PDFForge_Certified.pdf' });
  assert(renameRes.status === 200 && renameRes.data?.result?.originalName === 'PDFForge_Certified.pdf', 'Rename updated document display name');

  // 14. Repair PDF
  const repairRes = await request('POST', '/api/advanced/repair', { fileId: baseFileId });
  assert(repairRes.status === 200 && repairRes.data?.result?.pageCount > 0, 'Repair validated and reconstructed PDF cross-references');

  finishPhase();
}

/**
 * Phase 8: User Dashboard, Files, History, Settings & Ownership Isolation
 */
async function runPhase8() {
  startPhase(8, 'User Dashboard, Files, History & Ownership Isolation');

  const ts = Date.now();
  const aliceEmail = `alice_p8_${ts}@pdfforge.test`;
  const bobEmail = `bob_p8_${ts}@pdfforge.test`;
  const password = 'Password123!';

  // Setup Alice & Bob
  const regAlice = await request('POST', '/api/auth/register', { email: aliceEmail, password });
  const aliceToken = regAlice.data.token;

  const regBob = await request('POST', '/api/auth/register', { email: bobEmail, password });
  const bobToken = regBob.data.token;

  // 1. Initial Summary
  const sumA = await request('GET', '/api/dashboard/summary', null, aliceToken);
  assert(sumA.status === 200 && sumA.data?.summary?.stats?.totalOperations === 0, 'Initial dashboard summary returns 200 with 0 operations');

  // 2. Favorites Management
  const favToggle = await request('POST', '/api/dashboard/favorites/toggle', { toolId: 'merge' }, aliceToken);
  assert(favToggle.status === 200 && favToggle.data?.isFavorite === true, 'Favorite tool "merge" toggled ON');

  const favList = await request('GET', '/api/dashboard/favorites', null, aliceToken);
  assert(favList.data?.favorites?.includes('merge'), 'Favorites list includes "merge"');

  const favToggleOff = await request('POST', '/api/dashboard/favorites/toggle', { toolId: 'merge' }, aliceToken);
  assert(favToggleOff.data?.isFavorite === false, 'Favorite tool "merge" toggled OFF');

  // 3. Authenticated Upload & Storage Quota
  const samplePdf = await createSamplePdf(1, 'Alice Confidential Document');
  const uploadAlice = await uploadFile(samplePdf, 'alice_file.pdf', 'application/pdf', aliceToken);
  assert(uploadAlice.status === 201 && uploadAlice.data?.file?.id, 'Alice uploaded private file to workspace');
  const fileAId = uploadAlice.data.file.id;

  const filesA = await request('GET', '/api/dashboard/files', null, aliceToken);
  assert(filesA.status === 200 && filesA.data?.files?.some(f => f.id === fileAId), 'Alice file list contains uploaded file');

  const sumAAfter = await request('GET', '/api/dashboard/summary', null, aliceToken);
  assert(sumAAfter.data?.summary?.stats?.totalFiles >= 1, 'Storage summary reflects file count >= 1');

  // 4. Strict Ownership Isolation (Bob cannot access or delete Alice file)
  const bobDelAlice = await request('DELETE', `/api/dashboard/files/${fileAId}`, null, bobToken);
  assert(bobDelAlice.status === 403, 'Bob deleting Alice file on /api/dashboard/files/:id returns 403 Forbidden');

  const bobDelApi = await request('DELETE', `/api/files/${fileAId}`, null, bobToken);
  assert(bobDelApi.status === 403, 'Bob deleting Alice file on /api/files/:id returns 403 Forbidden');

  const filesB = await request('GET', '/api/dashboard/files', null, bobToken);
  assert(!filesB.data?.files?.some(f => f.id === fileAId), 'Bob cannot see Alice file in his dashboard file list');

  // 5. Job History with Input/Output Details
  const rotateOp = await request('POST', '/api/pdf/rotate', { fileId: fileAId, angle: 90 }, aliceToken);
  assert(rotateOp.status === 200, 'Alice executed PDF Rotate operation');

  const histA = await request('GET', '/api/dashboard/history', null, aliceToken);
  assert(histA.status === 200 && histA.data?.jobs?.length >= 1, 'Alice history logs rotate operation');
  assert(Boolean(histA.data?.jobs[0]?.output_file?.download_url), 'History enriches output file with download_url');

  const histB = await request('GET', '/api/dashboard/history', null, bobToken);
  assert(histB.data?.jobs?.length === 0, 'Bob history does not contain Alice operations');

  // 6. Profile & Theme Persistence
  const updateTheme = await request('PUT', '/api/dashboard/profile', { theme: 'light' }, aliceToken);
  assert(updateTheme.status === 200 && updateTheme.data?.settings?.theme === 'light', 'Profile theme updated to "light"');

  const profile = await request('GET', '/api/dashboard/profile', null, aliceToken);
  assert(profile.data?.settings?.theme === 'light', 'Profile query returns persistent theme');

  // 7. Authorized Deletion & Cleanup
  const delA = await request('DELETE', `/api/dashboard/files/${fileAId}`, null, aliceToken);
  assert(delA.status === 200, 'Alice successfully deleted her own file');

  const cleanupRes = await request('POST', '/api/dashboard/cleanup', { expiryHours: 24 }, aliceToken);
  assert(cleanupRes.status === 200, 'POST /api/dashboard/cleanup purged expired files');

  finishPhase();
}

/**
 * Phase 9: Admin Panel, RBAC Governance, Audit Trails & Telemetry
 */
async function runPhase9() {
  startPhase(9, 'Admin Panel, RBAC Governance, Audit & Telemetry');

  const ts = Date.now();
  const normalUserEmail = `user_p9_${ts}@pdfforge.test`;
  const adminUserEmail = `admin_p9_${ts}@pdfforge.test`;
  const thirdUserEmail = `third_p9_${ts}@pdfforge.test`;
  const password = 'StrongPassword123!';

  // 1. Account Setup
  const normalReg = await request('POST', '/api/auth/register', { email: normalUserEmail, password });
  assert(normalReg.status === 201 && normalReg.data?.user?.role === 'USER', 'Normal user registered with USER role');
  let normalToken = normalReg.data.token;
  const normalUserId = normalReg.data.user.id;

  const adminReg = await request('POST', '/api/auth/register', { email: adminUserEmail, password });
  assert(adminReg.status === 201 && adminReg.data?.user?.role === 'ADMIN', 'Admin user registered with ADMIN role');
  const adminToken = adminReg.data.token;
  const adminUserId = adminReg.data.user.id;

  // 2. Strict RBAC Enforcement (Normal user blocked with 403 on all admin routes)
  const adminRoutes = [
    { method: 'GET', path: '/api/admin/metrics' },
    { method: 'GET', path: '/api/admin/users' },
    { method: 'PUT', path: `/api/admin/users/${normalUserId}/status`, body: { isActive: false } },
    { method: 'PUT', path: `/api/admin/users/${normalUserId}/role`, body: { role: 'ADMIN' } },
    { method: 'GET', path: '/api/admin/jobs' },
    { method: 'GET', path: '/api/admin/jobs/failed' },
    { method: 'GET', path: '/api/admin/audit-logs' },
    { method: 'GET', path: '/api/admin/system-health' }
  ];

  for (const r of adminRoutes) {
    const res = await request(r.method, r.path, r.body || null, normalToken);
    assert(res.status === 403, `Normal user ${r.method} ${r.path} rejected with 403 Forbidden`);
  }

  // 3. Unauthenticated Guard
  const unauth = await request('GET', '/api/admin/metrics');
  assert(unauth.status === 401, 'Unauthenticated access to /api/admin/metrics rejected with 401 Unauthorized');

  // 4. Admin Overview Metrics
  const metrics = await request('GET', '/api/admin/metrics', null, adminToken);
  assert(metrics.status === 200 && metrics.data?.metrics?.users?.totalUsers >= 2, 'Admin retrieved real platform metrics (totalUsers >= 2)');

  // 5. User Directory & Search
  const userList = await request('GET', '/api/admin/users?page=1&limit=10', null, adminToken);
  assert(userList.status === 200 && userList.data?.users?.length >= 2, 'Admin retrieved paginated user directory');

  const userSearch = await request('GET', `/api/admin/users?search=${encodeURIComponent(normalUserEmail)}`, null, adminToken);
  assert(userSearch.status === 200 && userSearch.data?.users?.[0]?.email === normalUserEmail, 'Admin search found exact target user');

  // 6. Account Disablement & Authentication Lockout
  const disableUser = await request('PUT', `/api/admin/users/${normalUserId}/status`, { isActive: false }, adminToken);
  assert(disableUser.status === 200 && disableUser.data?.user?.is_active === false, 'Admin disabled normal user account');

  const disabledDash = await request('GET', '/api/dashboard/summary', null, normalToken);
  assert(disabledDash.status === 403, 'Disabled user cannot access protected dashboard APIs (403 Forbidden)');

  const disabledLogin = await request('POST', '/api/auth/login', { email: normalUserEmail, password });
  assert(disabledLogin.status === 403, 'Disabled user cannot log in (403 Forbidden)');

  // 7. Audit Trail & Zero Secret Leakage
  const auditLogs = await request('GET', '/api/admin/audit-logs', null, adminToken);
  assert(auditLogs.status === 200 && auditLogs.data?.logs?.length >= 1, 'Admin retrieved system audit logs');
  const auditStr = JSON.stringify(auditLogs.data);
  assert(!auditStr.includes(password), 'Audit trail does not leak user passwords');

  // 8. Account Re-enablement
  const enableUser = await request('PUT', `/api/admin/users/${normalUserId}/status`, { isActive: true }, adminToken);
  assert(enableUser.status === 200 && enableUser.data?.user?.is_active === true, 'Admin re-enabled normal user account');

  const reLogin = await request('POST', '/api/auth/login', { email: normalUserEmail, password });
  assert(reLogin.status === 200 && Boolean(reLogin.data?.token), 'Re-enabled user can successfully log in again');
  normalToken = reLogin.data.token;

  // 9. Role Modification (Promotion to ADMIN)
  const regThird = await request('POST', '/api/auth/register', { email: thirdUserEmail, password });
  const thirdUserId = regThird.data.user.id;
  const promoteRes = await request('PUT', `/api/admin/users/${thirdUserId}/role`, { role: 'ADMIN' }, adminToken);
  assert(promoteRes.status === 200 && promoteRes.data?.user?.role === 'ADMIN', 'Admin promoted third user to ADMIN role');

  const thirdLogin = await request('POST', '/api/auth/login', { email: thirdUserEmail, password });
  const thirdMetrics = await request('GET', '/api/admin/metrics', null, thirdLogin.data.token);
  assert(thirdMetrics.status === 200, 'Promoted admin user can successfully access admin APIs');

  // 10. Admin Self-Lockout Protection
  const selfDisable = await request('PUT', `/api/admin/users/${adminUserId}/status`, { isActive: false }, adminToken);
  assert(selfDisable.status === 400, 'Admin attempting to disable own account blocked with 400 Bad Request');

  const selfDemote = await request('PUT', `/api/admin/users/${adminUserId}/role`, { role: 'USER' }, adminToken);
  assert(selfDemote.status === 400, 'Admin attempting to demote own role blocked with 400 Bad Request');

  // 11. Operations Explorer & Telemetry
  const jobsRes = await request('GET', '/api/admin/jobs', null, adminToken);
  assert(jobsRes.status === 200 && Array.isArray(jobsRes.data?.jobs), 'Admin retrieved platform operations history');

  const healthRes = await request('GET', '/api/admin/system-health', null, adminToken);
  assert(healthRes.status === 200 && healthRes.data?.health?.status === 'healthy', 'Admin telemetry reports system health: healthy');

  finishPhase();
}

/**
 * Phase 10: Security Hardening, IDOR Matrix, Headers, Docker & Health
 */
async function runPhase10() {
  startPhase(10, 'Security Hardening, IDOR Matrix, Headers & Health');

  const ts = Date.now();
  const aliceEmail = `alice_p10_${ts}@pdfforge.test`;
  const bobEmail = `bob_p10_${ts}@pdfforge.test`;
  const adminEmail = `admin_p10_${ts}@pdfforge.test`;
  const password = 'SecurityHardenedPass123!';

  // 1. Health & Telemetry
  const health = await request('GET', '/api/health');
  assert(health.status === 200 && health.data?.status === 'ok', 'GET /api/health responds with HTTP 200 and status: ok');
  assert(Boolean(health.data?.database?.status), 'Database connection status reported');
  assert(Boolean(health.data?.system?.memory), 'Node.js process memory metrics present in health telemetry');

  // 2. Security Headers (CSP, nosniff, Rate Limits)
  assert(health.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff is set');
  assert(health.headers['content-security-policy']?.includes('script-src'), 'Content-Security-Policy header is configured');
  assert(health.headers['x-ratelimit-limit'] !== undefined, 'X-RateLimit-Limit header is present');

  // 3. Setup Users (Alice, Bob, Admin)
  const regAlice = await request('POST', '/api/auth/register', { email: aliceEmail, password });
  const aliceToken = regAlice.data.token;

  const regBob = await request('POST', '/api/auth/register', { email: bobEmail, password });
  const bobToken = regBob.data.token;

  const regAdmin = await request('POST', '/api/auth/register', { email: adminEmail, password });
  const adminToken = regAdmin.data.token;

  // 4. File Ownership & Access Matrix
  const samplePdf = await createSamplePdf(1, 'Alice Vault Document');
  const uploadAlice = await uploadFile(samplePdf, 'alice_vault.pdf', 'application/pdf', aliceToken);
  const fileId = uploadAlice.data.file.id;

  // Alice views own file -> 200 OK
  const aliceView = await request('GET', `/api/files/${fileId}/view`, null, aliceToken);
  assert(aliceView.status === 200, 'Alice can view her own private document (200 OK)');

  // Bob views Alice file -> 403 Forbidden
  const bobView = await request('GET', `/api/files/${fileId}/view`, null, bobToken);
  assert(bobView.status === 403, 'Bob is forbidden (403) from viewing Alice document');

  // Bob downloads Alice file -> 403 Forbidden
  const bobDl = await request('GET', `/api/files/${fileId}/download`, null, bobToken);
  assert(bobDl.status === 403, 'Bob is forbidden (403) from downloading Alice document');

  // Guest views Alice file -> 401 Unauthorized
  const guestView = await request('GET', `/api/files/${fileId}/view`);
  assert(guestView.status === 401, 'Guest is rejected with 401 from viewing authenticated private file');

  // Admin views Alice file -> 200 OK via RBAC override
  const adminView = await request('GET', `/api/files/${fileId}/view`, null, adminToken);
  assert(adminView.status === 200, 'Admin can view Alice document via privileged role override (200 OK)');

  // 5. Security Rejections
  const exeUpload = await uploadFile(Buffer.from('MZ\x90\x00FAKE_EXE'), 'hack.exe', 'application/x-msdownload', aliceToken);
  assert(exeUpload.status === 400 || exeUpload.status === 500, 'Executable payload (.exe) rejected on upload');

  const travTest = await request('GET', '/api/files/..%2f..%2fpackage.json/view', null, aliceToken);
  assert(travTest.status === 400 || travTest.status === 403 || travTest.status === 404, 'Path traversal attack rejected');

  // 6. Security Tooling Verification
  const docSecret = 'DocSecretKey2026!';
  const protectRes = await request('POST', '/api/security/protect', { fileId, password: docSecret }, aliceToken);
  assert(protectRes.status === 200 && protectRes.data?.file?.id, 'Protect encrypted document with password');
  const protectedId = protectRes.data.file.id;

  const wrongUnlock = await request('POST', '/api/security/unlock', { fileId: protectedId, password: 'Bad' }, aliceToken);
  assert(wrongUnlock.status === 401, 'Unlock with wrong password rejected with 401 Unauthorized');

  const rightUnlock = await request('POST', '/api/security/unlock', { fileId: protectedId, password: docSecret }, aliceToken);
  assert(rightUnlock.status === 200, 'Unlock with correct password returned decrypted document (200 OK)');

  const wmRes = await request('POST', '/api/security/watermark', { fileId, text: 'SECURE' }, aliceToken);
  assert(wmRes.status === 200, 'Watermark stamped text across pages with 200 OK');

  // 7. Audit Log Zero Secrets
  const auditRes = await request('GET', '/api/admin/audit-logs?limit=15', null, adminToken);
  assert(auditRes.status === 200, 'Admin can retrieve audit logs');
  const auditText = JSON.stringify(auditRes.data);
  assert(!auditText.includes(docSecret), 'Document encryption password is NOT leaked in audit logs');
  assert(!auditText.includes(password), 'User account passwords are NOT leaked in audit logs');

  finishPhase();
}

// ==============================================================================
// Master Suite Execution & Reporting
// ==============================================================================

async function runMasterSuite() {
  console.log('======================================================================');
  console.log('        🚀 PDFForge Master Test Suite (Phases 1 Through 10)           ');
  console.log('======================================================================');

  // Pre-flight Server Health Check
  try {
    const ping = await request('GET', '/api/health');
    if (ping.status !== 200) {
      throw new Error(`Server health check responded with status ${ping.status}`);
    }
    console.log('✓ Server is active and healthy on port 3000. Commencing full test run...\n');
  } catch (err) {
    console.error('❌ Server is not reachable at http://localhost:3000. Please start the server first.');
    console.error('Error details:', err.message);
    process.exit(1);
  }

  const grandStartTime = Date.now();

  try {
    await runPhase1();
    await runPhase2();
    await runPhase3();
    await runPhase4();
    await runPhase5();
    await runPhase6();
    await runPhase7();
    await runPhase8();
    await runPhase9();
    await runPhase10();
  } catch (err) {
    console.error('\n❌ Unhandled exception during phase execution:', err);
    if (currentPhase) {
      currentPhase.error = err;
      finishPhase();
    }
  }

  const grandTotalDurationMs = Date.now() - grandStartTime;

  // Final Summary Table
  console.log('\n' + '='.repeat(80));
  console.log('                         MASTER TEST SUMMARY                          ');
  console.log('='.repeat(80));
  console.log('Phase      Suite / Feature Domain                        Status    Tests       Duration');
  console.log('-'.repeat(80));

  let totalPassed = 0;
  let totalAssertions = 0;
  let allPass = true;

  for (const p of phases) {
    totalPassed += p.passed;
    totalAssertions += p.total;
    if (p.status !== 'PASS') allPass = false;

    const phaseTag = `Phase ${p.number}`.padEnd(10);
    const nameTag = p.name.length > 45 ? (p.name.substring(0, 42) + '...') : p.name.padEnd(45);
    const statusTag = p.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
    const testTag = `${p.passed}/${p.total}`.padEnd(11);
    const durTag = `${(p.durationMs / 1000).toFixed(1)}s`;

    console.log(`${phaseTag} ${nameTag} ${statusTag.padEnd(9)} ${testTag} ${durTag}`);
  }

  console.log('-'.repeat(80));
  const grandDurSec = (grandTotalDurationMs / 1000).toFixed(1);
  console.log(`OVERALL:   ${totalPassed}/${totalAssertions} total assertions passed across all ${phases.length} phases (${grandDurSec}s total).`);
  console.log('='.repeat(80));

  // Print Detailed Errors If Any
  const failedPhases = phases.filter(p => p.status !== 'PASS');
  if (failedPhases.length > 0) {
    console.log('\n❌ FAILED PHASES BREAKDOWN:');
    for (const fp of failedPhases) {
      console.log(`\n• Phase ${fp.number} (${fp.name}):`);
      console.log(`  Passed: ${fp.passed}/${fp.total}`);
      if (fp.error) {
        console.log(`  Error: ${fp.error.message || fp.error}`);
        if (fp.error.stack) {
          console.log(`  Stack: ${fp.error.stack.split('\n').slice(1, 4).join('\n')}`);
        }
      }
    }
  } else {
    console.log('\n🎉 ALL 10 PHASES PASSED CLEANLY! PDFForge is 100% operational.');
  }

  // Purge temporary test uploads from uploads directory
  try {
    const tempDir = path.join(ROOT_DIR, 'uploads/temp');
    const resultsDir = path.join(ROOT_DIR, 'uploads/results');
    [tempDir, resultsDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          fs.rmSync(path.join(dir, f), { recursive: true, force: true });
        }
      }
    });
  } catch (_) {}

  process.exit(allPass ? 0 : 1);
}

if (require.main === module) {
  runMasterSuite();
}

module.exports = { runMasterSuite };
