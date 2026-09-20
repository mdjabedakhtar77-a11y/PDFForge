const fs = require('fs');
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612.00, 792.00],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Legal: [612.00, 1008.00]
};

/**
 * 1. Merge multiple PDFs in given order
 */
async function mergeDocuments(inputPaths, outputPath) {
  if (!inputPaths || inputPaths.length === 0) {
    throw new Error('At least one PDF file is required to merge.');
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of inputPaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    const fileBytes = fs.readFileSync(filePath);
    const header = fileBytes.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      throw new Error('One of the files to merge is not a valid PDF document (e.g. Word, Excel, or corrupted file). Merge PDF requires all inputs to be valid PDFs. If you uploaded a Word document, please convert it to PDF using "Word to PDF" first.');
    }
    const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: mergedPdf.getPageCount() };
}

/**
 * 2. Extract selected pages (1-indexed array)
 */
async function extractPages(inputPath, pageNumbers, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const total = srcPdf.getPageCount();

  // Convert 1-indexed to 0-indexed, eliminate duplicates and bounds check
  const indices = pageNumbers
    .map(p => parseInt(p, 10) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < total);

  if (indices.length === 0) {
    throw new Error('No valid pages selected for extraction.');
  }

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, indices);
  copiedPages.forEach(p => newPdf.addPage(p));

  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: newPdf.getPageCount() };
}

/**
 * 3. Split by Range string (e.g. "1-3, 5, 7-9")
 */
function parseRangeString(rangeStr, maxPages) {
  const pageNumbers = new Set();
  const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(maxPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          pageNumbers.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        pageNumbers.add(num);
      }
    }
  }

  return Array.from(pageNumbers).sort((a, b) => a - b);
}

async function splitByRanges(inputPath, rangeString, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const total = srcPdf.getPageCount();

  const pagesToKeep = parseRangeString(rangeString, total);
  if (pagesToKeep.length === 0) {
    throw new Error(`Invalid range "${rangeString}". Document has ${total} pages.`);
  }

  return extractPages(inputPath, pagesToKeep, outputPath);
}

/**
 * 4. Delete Pages (1-indexed array of pages to remove)
 */
async function deletePages(inputPath, pageNumbersToDelete, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const total = srcPdf.getPageCount();

  const deleteSet = new Set(pageNumbersToDelete.map(p => parseInt(p, 10)));
  const pagesToKeep = [];

  for (let i = 1; i <= total; i++) {
    if (!deleteSet.has(i)) {
      pagesToKeep.push(i);
    }
  }

  if (pagesToKeep.length === 0) {
    throw new Error('Cannot delete all pages of the document. At least one page must remain.');
  }

  return extractPages(inputPath, pagesToKeep, outputPath);
}

/**
 * 5. Organize / Reorder pages (1-indexed array defining the new order)
 */
async function organizePages(inputPath, newOrder, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const total = srcPdf.getPageCount();

  const indices = newOrder
    .map(p => parseInt(p, 10) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < total);

  if (indices.length === 0) {
    throw new Error('Invalid page order provided.');
  }

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, indices);
  copiedPages.forEach(p => newPdf.addPage(p));

  const pdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: newPdf.getPageCount() };
}

/**
 * 6. Rotate Pages (angle: 90, 180, 270)
 */
async function rotatePages(inputPath, pageNumbers, angleDegrees, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const total = pages.length;

  const targetSet = (pageNumbers && pageNumbers.length > 0)
    ? new Set(pageNumbers.map(p => parseInt(p, 10)))
    : null;

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    if (!targetSet || targetSet.has(pageNum)) {
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + angleDegrees) % 360));
    }
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: total };
}

/**
 * 7. Crop Pages (margins: { top, right, bottom, left } in points)
 */
async function cropPages(inputPath, pageNumbers, margins, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const total = pages.length;

  const { top = 0, right = 0, bottom = 0, left = 0 } = margins;
  const targetSet = (pageNumbers && pageNumbers.length > 0)
    ? new Set(pageNumbers.map(p => parseInt(p, 10)))
    : null;

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    if (!targetSet || targetSet.has(pageNum)) {
      const { x, y, width, height } = page.getCropBox() || page.getMediaBox();
      const newX = x + left;
      const newY = y + bottom;
      const newW = Math.max(10, width - left - right);
      const newH = Math.max(10, height - top - bottom);
      page.setCropBox(newX, newY, newW, newH);
    }
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: total };
}

/**
 * 8. Resize Pages (presets: A4, Letter, A3, A5, Legal)
 */
async function resizePages(inputPath, sizeName = 'A4', orientation = 'portrait', outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const outputDoc = await PDFDocument.create();

  const standardSize = PAGE_SIZES[sizeName] || PAGE_SIZES.A4;
  let [targetW, targetH] = standardSize;
  if (orientation.toLowerCase() === 'landscape') {
    [targetW, targetH] = [targetH, targetW];
  }

  const srcPages = srcPdf.getPages();
  for (let i = 0; i < srcPages.length; i++) {
    const [embedded] = await outputDoc.embedPdf(srcPdf, [i]);
    const origW = embedded.width;
    const origH = embedded.height;

    // Scale to fit while maintaining aspect ratio
    const scale = Math.min(targetW / origW, targetH / origH);
    const scaledW = origW * scale;
    const scaledH = origH * scale;
    const posX = (targetW - scaledW) / 2;
    const posY = (targetH - scaledH) / 2;

    const newPage = outputDoc.addPage([targetW, targetH]);
    newPage.drawPage(embedded, {
      x: posX,
      y: posY,
      width: scaledW,
      height: scaledH
    });
  }

  const pdfBytes = await outputDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: outputDoc.getPageCount() };
}

/**
 * 9. Split in half (vertical: left & right, or horizontal: top & bottom)
 */
async function splitInHalf(inputPath, orientation = 'vertical', outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const outputDoc = await PDFDocument.create();

  const isVertical = orientation.toLowerCase() === 'vertical';

  for (let i = 0; i < srcPdf.getPageCount(); i++) {
    const [embedded1, embedded2] = await outputDoc.embedPdf(srcPdf, [i, i]);
    const origW = embedded1.width;
    const origH = embedded1.height;

    if (isVertical) {
      // Left Half
      const halfW = origW / 2;
      const leftPage = outputDoc.addPage([halfW, origH]);
      leftPage.drawPage(embedded1, {
        x: 0,
        y: 0,
        width: origW,
        height: origH
      });

      // Right Half
      const rightPage = outputDoc.addPage([halfW, origH]);
      rightPage.drawPage(embedded2, {
        x: -halfW,
        y: 0,
        width: origW,
        height: origH
      });
    } else {
      // Top Half
      const halfH = origH / 2;
      const topPage = outputDoc.addPage([origW, halfH]);
      topPage.drawPage(embedded1, {
        x: 0,
        y: -halfH,
        width: origW,
        height: origH
      });

      // Bottom Half
      const bottomPage = outputDoc.addPage([origW, halfH]);
      bottomPage.drawPage(embedded2, {
        x: 0,
        y: 0,
        width: origW,
        height: origH
      });
    }
  }

  const pdfBytes = await outputDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: outputDoc.getPageCount() };
}

module.exports = {
  mergeDocuments,
  extractPages,
  splitByRanges,
  deletePages,
  organizePages,
  rotatePages,
  cropPages,
  resizePages,
  splitInHalf,
  parseRangeString
};
