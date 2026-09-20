const express = require('express');
const router = express.Router();
const convertController = require('../controllers/convertController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 1. PDF to Word (DOCX)
router.post('/pdf-to-word', optionalAuth, convertController.pdfToWord);
router.post('/pdf-to-docx', optionalAuth, convertController.pdfToWord);

// 2. PDF to Excel (XLSX / CSV)
router.post('/pdf-to-excel', optionalAuth, convertController.pdfToExcel);
router.post('/pdf-to-xlsx', optionalAuth, convertController.pdfToExcel);

// 3. PDF to Images (JPG / PNG + Multi-Image ZIP)
router.post('/pdf-to-images', optionalAuth, convertController.pdfToImages);

// 4. PDF to PowerPoint (PPTX)
router.post('/pdf-to-pptx', optionalAuth, convertController.pdfToPptx);

// 5. PDF to Text (TXT)
router.post('/pdf-to-text', optionalAuth, convertController.pdfToText);

// 6. Word (DOCX) to PDF
router.post('/docx-to-pdf', optionalAuth, convertController.docxToPdf);

// 7. Images (JPG / PNG) to PDF
router.post('/images-to-pdf', optionalAuth, convertController.imagesToPdf);

// 8. HTML to PDF
router.post('/html-to-pdf', optionalAuth, convertController.htmlToPdf);

module.exports = router;
