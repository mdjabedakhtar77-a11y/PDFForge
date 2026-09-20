const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { createCanvas, Image } = require('@napi-rs/canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const docx = require('docx');
const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const mammoth = require('mammoth');
const PptxGenJS = require('pptxgenjs');
const { TEMP_DIR, RESULTS_DIR, ensureDirs } = require('./storageService');

ensureDirs();

// Setup standard font path for pdfjs
const standardFontDataUrl = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts/'
).replace(/\\/g, '/') + '/';

/**
 * Helper: Parse page ranges string like "1-3, 5, 7-9" into an array of 1-based page numbers
 */
function parsePageRanges(rangeStr, maxPages) {
  if (!rangeStr || typeof rangeStr !== 'string' || rangeStr.trim() === '' || rangeStr.toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  const pages = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(maxPages, parseInt(endStr, 10) || maxPages);
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (num >= 1 && num <= maxPages) {
        pages.add(num);
      }
    }
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : Array.from({ length: maxPages }, (_, i) => i + 1);
}

/**
 * Helper: Transliterate / sanitize characters for standard PDF WinAnsi font encoding
 */
function sanitizeForWinAnsi(text) {
  if (!text) return '';
  return text
    .replace(/[☐□]/g, '[ ]')
    .replace(/[☑✓✔]/g, '[x]')
    .replace(/[•●·]/g, '*')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ');
}

/**
 * 1. PDF to Text (TXT)
 */
async function pdfToText(pdfPath, outputPath, options = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl }).promise;
  const targetPages = parsePageRanges(options.pages, doc.numPages);

  const textBlocks = [];
  for (const pageNum of targetPages) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = [];
    let lastY = null;

    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        strings.push('\n');
      } else if (strings.length > 0 && !strings[strings.length - 1].endsWith('\n') && !strings[strings.length - 1].endsWith(' ')) {
        strings.push(' ');
      }
      strings.push(item.str);
      lastY = item.transform[5];
    }

    const pageText = strings.join('').trim();
    textBlocks.push(`--- Page ${pageNum} of ${doc.numPages} ---\n\n${pageText}`);
  }

  const fullText = textBlocks.join('\n\n\n');
  fs.writeFileSync(outputPath, fullText, 'utf8');

  return {
    pageCount: targetPages.length,
    characterCount: fullText.length,
    outputPath,
    text: fullText
  };
}

/**
 * 2. PDF to Word (DOCX)
 */
async function pdfToDocx(pdfPath, outputPath, options = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl }).promise;
  const targetPages = parsePageRanges(options.pages, doc.numPages);

  const sections = [];

  for (let idx = 0; idx < targetPages.length; idx++) {
    const pageNum = targetPages[idx];
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by line based on Y coordinate
    const lineMap = new Map();
    for (const item of content.items) {
      const yKey = Math.round(item.transform[5] / 4) * 4; // group within ~4px
      if (!lineMap.has(yKey)) {
        lineMap.set(yKey, []);
      }
      lineMap.get(yKey).push(item);
    }

    // Sort lines descending by Y (top to bottom)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const docxParagraphs = [];

    // Add page header
    docxParagraphs.push(
      new docx.Paragraph({
        text: `PDFForge Document Export — Page ${pageNum}`,
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 120 }
      })
    );

    for (const y of sortedY) {
      const items = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]); // sort left to right
      const lineText = items.map(it => it.str).join(' ').trim();
      if (!lineText) continue;

      // Check if line looks like a major heading
      const maxFontSize = Math.max(...items.map(it => it.transform[0] || 12));
      const isHeading = maxFontSize >= 16;

      docxParagraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: lineText,
              bold: isHeading,
              size: isHeading ? 28 : 22
            })
          ],
          heading: isHeading ? docx.HeadingLevel.HEADING_3 : undefined,
          spacing: { after: 100 }
        })
      );
    }

    // Add page break between pages except the last one
    if (idx < targetPages.length - 1) {
      docxParagraphs.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
    }

    sections.push(...docxParagraphs);
  }

  const wordDoc = new docx.Document({
    sections: [
      {
        properties: {},
        children: sections.length > 0 ? sections : [
          new docx.Paragraph({ text: 'PDFForge Export — Empty Document' })
        ]
      }
    ]
  });

  const buffer = await docx.Packer.toBuffer(wordDoc);
  fs.writeFileSync(outputPath, buffer);

  return {
    pageCount: targetPages.length,
    outputPath
  };
}

/**
 * 3. PDF to Excel (XLSX / CSV)
 */
async function pdfToExcel(pdfPath, outputPath, options = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl }).promise;
  const targetPages = parsePageRanges(options.pages, doc.numPages);
  const format = (options.format || 'xlsx').toLowerCase();

  const workbook = xlsx.utils.book_new();
  const allRows = [];

  for (const pageNum of targetPages) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items into rows by Y coordinate
    const rowMap = new Map();
    for (const item of content.items) {
      const yKey = Math.round(item.transform[5] / 8) * 8; // group within 8px
      if (!rowMap.has(yKey)) {
        rowMap.set(yKey, []);
      }
      rowMap.get(yKey).push(item);
    }

    const sortedY = Array.from(rowMap.keys()).sort((a, b) => b - a);
    const pageRows = [];

    // Header row for page
    pageRows.push([`=== Page ${pageNum} ===`]);

    for (const y of sortedY) {
      const items = rowMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      // Column separation: if distance between items > 25px, put in separate column
      const rowCols = [];
      let currentCell = '';
      let prevXEnd = null;

      for (const it of items) {
        const x = it.transform[4];
        const width = it.width || (it.str.length * 6);
        if (prevXEnd !== null && (x - prevXEnd) > 25) {
          rowCols.push(currentCell.trim());
          currentCell = it.str;
        } else {
          currentCell += (currentCell ? ' ' : '') + it.str;
        }
        prevXEnd = x + width;
      }
      if (currentCell.trim()) {
        rowCols.push(currentCell.trim());
      }

      if (rowCols.length > 0) {
        pageRows.push(rowCols);
        allRows.push(rowCols);
      }
    }

    const worksheet = xlsx.utils.aoa_to_sheet(pageRows);
    xlsx.utils.book_append_sheet(workbook, worksheet, `Page ${pageNum}`);
  }

  if (format === 'csv') {
    // Generate CSV string
    const csvLines = allRows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    );
    fs.writeFileSync(outputPath, csvLines.join('\r\n'), 'utf8');
  } else {
    xlsx.writeFile(workbook, outputPath);
  }

  return {
    format,
    pageCount: targetPages.length,
    rowCount: allRows.length,
    outputPath
  };
}

/**
 * 4. PDF to Images (JPG / PNG) with Multi-Page ZIP Support
 */
async function pdfToImages(pdfPath, outputDir, options = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl }).promise;
  const targetPages = parsePageRanges(options.pages, doc.numPages);

  const imgFormat = (options.format || 'png').toLowerCase() === 'jpg' ? 'jpeg' : (options.format || 'png').toLowerCase();
  const ext = imgFormat === 'jpeg' ? 'jpg' : imgFormat;
  const dpi = parseInt(options.dpi, 10) || 150;
  const scale = dpi / 72.0;
  const baseName = path.parse(pdfPath).name;

  const generatedImageFiles = [];

  for (const pageNum of targetPages) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');

    // Solid white background for clean images
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const imgFileName = `${baseName}_page_${pageNum}.${ext}`;
    const imgFilePath = path.join(outputDir, imgFileName);

    let imageBuffer;
    if (imgFormat === 'jpeg') {
      const quality = Math.min(1.0, Math.max(0.1, parseFloat(options.quality) || 0.9));
      imageBuffer = canvas.toBuffer('image/jpeg', { quality });
    } else {
      imageBuffer = canvas.toBuffer('image/png');
    }

    fs.writeFileSync(imgFilePath, imageBuffer);
    generatedImageFiles.push({
      page: pageNum,
      filename: imgFileName,
      path: imgFilePath,
      size: imageBuffer.length,
      width: canvas.width,
      height: canvas.height
    });
  }

  // If more than 1 image, bundle into ZIP archive
  let zipPath = null;
  let finalOutputPath = generatedImageFiles[0].path;

  if (generatedImageFiles.length > 1 || options.alwaysZip) {
    const zip = new AdmZip();
    for (const img of generatedImageFiles) {
      zip.addLocalFile(img.path);
    }
    zipPath = path.join(outputDir, `${baseName}_images_${dpi}dpi.zip`);
    zip.writeZip(zipPath);
    finalOutputPath = zipPath;
  }

  return {
    isZip: generatedImageFiles.length > 1 || !!options.alwaysZip,
    imageCount: generatedImageFiles.length,
    format: ext,
    dpi,
    images: generatedImageFiles,
    zipPath,
    outputPath: finalOutputPath
  };
}

/**
 * 5. PDF to PowerPoint (PPTX)
 */
async function pdfToPptx(pdfPath, outputPath, options = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl }).promise;
  const targetPages = parsePageRanges(options.pages, doc.numPages);

  const pptx = new PptxGenJS();
  pptx.author = 'PDFForge';
  pptx.company = 'PDFForge Platform';
  pptx.title = path.parse(pdfPath).name;

  for (const pageNum of targetPages) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 }); // 108 DPI render for slide fidelity

    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const base64Data = canvas.toDataURL('image/png');

    // Also extract text content
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ').trim();

    const slide = pptx.addSlide();
    // Add page rendered screenshot as background image covering slide
    slide.addImage({
      data: base64Data,
      x: 0.5,
      y: 0.5,
      w: '90%',
      h: '85%'
    });

    // Add speaker notes with extracted text
    if (pageText) {
      slide.addNotes(pageText);
    }
  }

  await pptx.writeFile({ fileName: outputPath });

  return {
    slideCount: targetPages.length,
    outputPath
  };
}

/**
 * 6. Word (DOCX) to PDF
 */
async function docxToPdf(docxPath, outputPath, options = {}) {
  const fileBuffer = fs.readFileSync(docxPath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const rawText = sanitizeForWinAnsi(result.value || 'Document converted from DOCX');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lines = rawText.split('\n');
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const maxLineWidth = pageWidth - (margin * 2);
  const fontSize = 11;
  const lineHeight = 16;
  const maxY = pageHeight - margin;
  const minY = margin;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = maxY - 30;

  // Header
  currentPage.drawText('Converted from Microsoft Word (.docx)', {
    x: margin,
    y: maxY,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      currentY -= lineHeight * 0.8;
      if (currentY < minY) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = maxY - 30;
      }
      continue;
    }

    // Word wrap long lines
    const words = trimmed.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxLineWidth) {
        if (currentY < minY) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = maxY - 30;
        }
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1)
        });
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (currentY < minY) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = maxY - 30;
      }
      currentPage.drawText(currentLine, {
        x: margin,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      currentY -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return {
    pageCount: pdfDoc.getPageCount(),
    outputPath
  };
}

/**
 * 7. Images (JPG / PNG) to PDF
 */
async function imagesToPdf(imagePaths, outputPath, options = {}) {
  const pdfDoc = await PDFDocument.create();
  const orientation = (options.orientation || 'auto').toLowerCase();
  const margin = options.margin !== undefined ? Math.max(0, parseInt(options.margin, 10)) : 20;

  for (const imgPath of imagePaths) {
    const imgBytes = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();

    let embeddedImage;
    if (ext === '.png') {
      embeddedImage = await pdfDoc.embedPng(imgBytes);
    } else {
      // JPEG / JPG
      embeddedImage = await pdfDoc.embedJpg(imgBytes);
    }

    let imgW = embeddedImage.width;
    let imgH = embeddedImage.height;

    let pageW = imgW + (margin * 2);
    let pageH = imgH + (margin * 2);

    if (orientation === 'landscape' && pageH > pageW) {
      const temp = pageW;
      pageW = pageH;
      pageH = temp;
    } else if (orientation === 'portrait' && pageW > pageH) {
      const temp = pageW;
      pageW = pageH;
      pageH = temp;
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    // Center image on page
    const drawX = (pageW - imgW) / 2;
    const drawY = (pageH - imgH) / 2;

    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: imgW,
      height: imgH
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return {
    pageCount: pdfDoc.getPageCount(),
    outputPath
  };
}

/**
 * 8. HTML to PDF (Sanitized & SSRF-Protected)
 */
async function htmlToPdf(htmlInput, outputPath, options = {}) {
  // Strip malicious tags, external URLs, file: URIs and scripts
  let sanitizedHtml = String(htmlInput || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\b(?:javascript|file|data):/gi, 'safe:');

  // Strip remaining HTML tags into structured text paragraphs with basic formatting
  // Convert breaks and paragraph tags into newlines
  let plain = sanitizeForWinAnsi(sanitizedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"'));

  const lines = plain.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const maxLineWidth = pageWidth - (margin * 2);
  const fontSize = 11;
  const lineHeight = 16;
  const maxY = pageHeight - margin;
  const minY = margin;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = maxY - 30;

  currentPage.drawText('HTML to PDF Export — PDFForge', {
    x: margin,
    y: maxY,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.4, 0.8)
  });

  for (const line of lines) {
    const words = line.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxLineWidth) {
        if (currentY < minY) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = maxY - 30;
        }
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1)
        });
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (currentY < minY) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = maxY - 30;
      }
      currentPage.drawText(currentLine, {
        x: margin,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      currentY -= lineHeight * 1.4;
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return {
    pageCount: pdfDoc.getPageCount(),
    outputPath
  };
}

module.exports = {
  parsePageRanges,
  pdfToText,
  pdfToDocx,
  pdfToExcel,
  pdfToImages,
  pdfToPptx,
  docxToPdf,
  imagesToPdf,
  htmlToPdf
};
