const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts, PDFName } = require('pdf-lib');

/**
 * Helper to convert HEX color (#ffffff) to pdf-lib rgb(0..1)
 */
function parseColor(hex = '#000000') {
  if (!hex || typeof hex !== 'string') return rgb(0, 0, 0);
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

/**
 * 1. Apply visual elements (text, shapes, highlights, signatures)
 */
async function applyEditorElements(inputPath, elements = [], outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const el of elements) {
    const pageIdx = (el.page || 1) - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;

    const page = pages[pageIdx];
    const pageHeight = page.getHeight();
    const opacity = el.opacity !== undefined ? Math.max(0, Math.min(1, parseFloat(el.opacity))) : 1;
    const color = parseColor(el.color || '#000000');

    // Normalized / raw coordinates in points (DOM top-left to PDF bottom-left)
    const x = parseFloat(el.x) || 0;
    const y = parseFloat(el.y) || 0;
    const width = parseFloat(el.width) || 100;
    const height = parseFloat(el.height) || 20;

    switch (el.type) {
      case 'text': {
        const fontSize = parseFloat(el.fontSize) || 14;
        const text = el.text || '';
        // In PDF points, text y is baseline
        const pdfY = pageHeight - y - fontSize;
        page.drawText(text, {
          x,
          y: Math.max(0, pdfY),
          size: fontSize,
          font,
          color,
          opacity
        });
        break;
      }

      case 'rectangle': {
        const pdfY = pageHeight - y - height;
        const fillColor = el.fillColor ? parseColor(el.fillColor) : undefined;
        const borderWidth = parseFloat(el.borderWidth) || 1;
        page.drawRectangle({
          x,
          y: pdfY,
          width,
          height,
          color: fillColor,
          borderColor: color,
          borderWidth: fillColor ? borderWidth : 1,
          opacity
        });
        break;
      }

      case 'whiteout': {
        const pdfY = pageHeight - y - height;
        page.drawRectangle({
          x,
          y: pdfY,
          width,
          height,
          color: rgb(1, 1, 1),
          opacity: 1
        });
        break;
      }

      case 'highlight': {
        const pdfY = pageHeight - y - height;
        page.drawRectangle({
          x,
          y: pdfY,
          width,
          height,
          color: el.color ? parseColor(el.color) : rgb(1, 1, 0),
          opacity: el.opacity !== undefined ? opacity : 0.35
        });
        break;
      }

      case 'circle': {
        const pdfY = pageHeight - y - height / 2;
        const pdfX = x + width / 2;
        const fillColor = el.fillColor ? parseColor(el.fillColor) : undefined;
        page.drawEllipse({
          x: pdfX,
          y: pdfY,
          xScale: width / 2,
          yScale: height / 2,
          color: fillColor,
          borderColor: color,
          borderWidth: 1,
          opacity
        });
        break;
      }

      case 'line': {
        const x2 = parseFloat(el.x2 !== undefined ? el.x2 : x + width);
        const y2 = parseFloat(el.y2 !== undefined ? el.y2 : y + height);
        page.drawLine({
          start: { x, y: pageHeight - y },
          end: { x: x2, y: pageHeight - y2 },
          thickness: parseFloat(el.thickness) || 2,
          color,
          opacity
        });
        break;
      }

      case 'image':
      case 'signature':
      case 'drawing': {
        if (el.dataUrl && el.dataUrl.includes('base64,')) {
          const base64Data = el.dataUrl.split('base64,')[1];
          const imgBuffer = Buffer.from(base64Data, 'base64');
          let embeddedImg = null;

          try {
            if (el.dataUrl.includes('image/png') || !el.dataUrl.includes('image/jpeg')) {
              embeddedImg = await pdfDoc.embedPng(imgBuffer);
            } else {
              embeddedImg = await pdfDoc.embedJpg(imgBuffer);
            }
          } catch (e) {
            // Fallback attempt to load as PNG
            embeddedImg = await pdfDoc.embedPng(imgBuffer).catch(() => null);
          }

          if (embeddedImg) {
            const pdfY = pageHeight - y - height;
            page.drawImage(embeddedImg, {
              x,
              y: pdfY,
              width,
              height,
              opacity
            });
          }
        }
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: pages.length };
}

/**
 * 2. Create interactive AcroForm fields
 */
async function createAcroForm(inputPath, formFields = [], outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  for (let i = 0; i < formFields.length; i++) {
    const f = formFields[i];
    const pageIdx = (f.page || 1) - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;

    const page = pages[pageIdx];
    const pageHeight = page.getHeight();
    const fieldName = f.name || `field_${i + 1}_${Date.now()}`;
    const x = parseFloat(f.x) || 50;
    const y = parseFloat(f.y) || 50;
    const width = parseFloat(f.width) || 160;
    const height = parseFloat(f.height) || 24;
    const pdfY = pageHeight - y - height;

    switch (f.type) {
      case 'text': {
        const textField = form.createTextField(fieldName);
        if (f.defaultValue) textField.setText(f.defaultValue);
        textField.addToPage(page, { x, y: pdfY, width, height });
        break;
      }
      case 'checkbox': {
        const checkBox = form.createCheckBox(fieldName);
        if (f.checked) checkBox.check();
        checkBox.addToPage(page, { x, y: pdfY, width: Math.min(width, height, 20), height: Math.min(width, height, 20) });
        break;
      }
      case 'dropdown': {
        const dropdown = form.createDropdown(fieldName);
        const options = (f.options && Array.isArray(f.options) && f.options.length > 0)
          ? f.options
          : ['Option 1', 'Option 2', 'Option 3'];
        dropdown.setOptions(options);
        if (f.defaultValue && options.includes(f.defaultValue)) {
          dropdown.select(f.defaultValue);
        }
        dropdown.addToPage(page, { x, y: pdfY, width, height });
        break;
      }
      case 'radio': {
        const radioGroup = form.createRadioGroup(fieldName);
        const optVal = f.value || 'Option 1';
        radioGroup.addOptionToPage(optVal, page, { x, y: pdfY, width: Math.min(width, height, 18), height: Math.min(width, height, 18) });
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: pages.length, fieldsCount: formFields.length };
}

/**
 * 3. Remove all page annotations
 */
async function removeAnnotations(inputPath, outputPath) {
  const fileBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    if (page.node.has(PDFName.of('Annots'))) {
      page.node.delete(PDFName.of('Annots'));
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { pageCount: pages.length };
}

module.exports = {
  applyEditorElements,
  createAcroForm,
  removeAnnotations,
  parseColor
};
