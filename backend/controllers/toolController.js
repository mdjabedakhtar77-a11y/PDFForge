/**
 * Tool Registry - Complete metadata for all planned tools across all phases
 */
const TOOLS = [
  // Phase 2: Core PDF Operations
  {
    id: 'merge',
    name: 'Merge PDF',
    category: 'Organize',
    phase: 2,
    description: 'Combine multiple PDFs and images into a single cohesive document.',
    icon: 'layers',
    badge: 'Popular',
    route: '/workspace.html?tool=merge',
    acceptsMultiple: true
  },
  {
    id: 'split',
    name: 'Split PDF',
    category: 'Organize',
    phase: 2,
    description: 'Separate one or more pages by range or split into separate documents.',
    icon: 'scissors',
    badge: 'Core',
    route: '/workspace.html?tool=split',
    acceptsMultiple: false
  },
  {
    id: 'extract',
    name: 'Extract Pages',
    category: 'Organize',
    phase: 2,
    description: 'Select specific pages to extract into an independent PDF.',
    icon: 'file-text',
    badge: 'Core',
    route: '/workspace.html?tool=extract',
    acceptsMultiple: false
  },
  {
    id: 'delete-pages',
    name: 'Delete Pages',
    category: 'Organize',
    phase: 2,
    description: 'Remove unwanted pages from your document seamlessly.',
    icon: 'trash-2',
    badge: null,
    route: '/workspace.html?tool=delete-pages',
    acceptsMultiple: false
  },
  {
    id: 'organize',
    name: 'Organize Pages',
    category: 'Organize',
    phase: 2,
    description: 'Sort, reorder, and organize pages via interactive drag-and-drop.',
    icon: 'grid',
    badge: 'Popular',
    route: '/workspace.html?tool=organize',
    acceptsMultiple: false
  },
  {
    id: 'rotate',
    name: 'Rotate PDF',
    category: 'Organize',
    phase: 2,
    description: 'Rotate all or specific pages 90, 180, or 270 degrees clockwise.',
    icon: 'rotate-cw',
    badge: 'Core',
    route: '/workspace.html?tool=rotate',
    acceptsMultiple: false
  },
  {
    id: 'crop',
    name: 'Crop PDF',
    category: 'Organize',
    phase: 2,
    description: 'Trim margins or custom rectangular regions across pages.',
    icon: 'crop',
    badge: null,
    route: '/workspace.html?tool=crop',
    acceptsMultiple: false
  },
  {
    id: 'resize',
    name: 'Resize Pages',
    category: 'Organize',
    phase: 2,
    description: 'Standardize page dimensions to A3, A4, A5, Letter, Legal or custom.',
    icon: 'maximize-2',
    badge: null,
    route: '/workspace.html?tool=resize',
    acceptsMultiple: false
  },
  {
    id: 'split-half',
    name: 'Split in Half',
    category: 'Organize',
    phase: 2,
    description: 'Slice two-up booklet scans into individual single pages (horizontal or vertical).',
    icon: 'scissors',
    badge: null,
    route: '/workspace.html?tool=split-half',
    acceptsMultiple: false
  },

  // Phase 3: PDF Editor, Forms & Fill/Sign
  {
    id: 'editor',
    name: 'PDF Editor',
    category: 'Edit & Sign',
    phase: 3,
    description: 'Add text, shapes, highlights, whiteouts, and images to any PDF.',
    icon: 'edit-3',
    badge: 'Interactive',
    route: '/workspace.html?tool=editor',
    acceptsMultiple: false
  },
  {
    id: 'fill-sign',
    name: 'Fill & Sign',
    category: 'Edit & Sign',
    phase: 3,
    description: 'Complete PDF forms and draw or place authenticated digital signatures.',
    icon: 'feather',
    badge: 'Popular',
    route: '/workspace.html?tool=fill-sign',
    acceptsMultiple: false
  },
  {
    id: 'forms',
    name: 'Create Forms',
    category: 'Edit & Sign',
    phase: 3,
    description: 'Build interactive form fields (inputs, radios, checkboxes, dropdowns).',
    icon: 'check-square',
    badge: null,
    route: '/workspace.html?tool=forms',
    acceptsMultiple: false
  },
  {
    id: 'remove-annotations',
    name: 'Clean Document',
    category: 'Edit & Sign',
    phase: 3,
    description: 'Strip all annotations, comments, and form fields while preserving base text.',
    icon: 'trash-2',
    badge: null,
    route: '/workspace.html?tool=remove-annotations',
    acceptsMultiple: false
  },

  // Phase 4: Compression, OCR, Deskew, Grayscale & Flatten
  {
    id: 'compress',
    name: 'Compress PDF',
    category: 'Optimize',
    phase: 4,
    description: 'Reduce file size while preserving high visual quality.',
    icon: 'minimize-2',
    badge: 'Popular',
    route: '/workspace.html?tool=compress',
    acceptsMultiple: false
  },
  {
    id: 'ocr',
    name: 'OCR to Searchable',
    category: 'Optimize',
    phase: 4,
    description: 'Extract and make scanned document text searchable with Tesseract.',
    icon: 'eye',
    badge: 'AI Powered',
    route: '/workspace.html?tool=ocr',
    acceptsMultiple: false
  },
  {
    id: 'deskew',
    name: 'Deskew Pages',
    category: 'Optimize',
    phase: 4,
    description: 'Automatically detect and straighten tilted or slanted scanned pages.',
    icon: 'compass',
    badge: null,
    route: '/workspace.html?tool=deskew',
    acceptsMultiple: false
  },
  {
    id: 'grayscale',
    name: 'Convert to Grayscale',
    category: 'Optimize',
    phase: 4,
    description: 'Convert full-color documents to clean black-and-white or grayscale.',
    icon: 'sun',
    badge: null,
    route: '/workspace.html?tool=grayscale',
    acceptsMultiple: false
  },
  {
    id: 'flatten',
    name: 'Flatten PDF',
    category: 'Optimize',
    phase: 4,
    description: 'Lock annotations and form fields directly into the document content.',
    icon: 'disc',
    badge: null,
    route: '/workspace.html?tool=flatten',
    acceptsMultiple: false
  },

  // Phase 5: Conversion Suite
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    category: 'Convert',
    phase: 5,
    description: 'Convert PDF documents into editable Microsoft Word DOCX files.',
    icon: 'file-text',
    badge: 'High Quality',
    route: '/workspace.html?tool=pdf-to-word',
    acceptsMultiple: false
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    category: 'Convert',
    phase: 5,
    description: 'Extract tables and structured data directly into XLSX / CSV.',
    icon: 'table',
    badge: null,
    route: '/workspace.html?tool=pdf-to-excel',
    acceptsMultiple: false
  },
  {
    id: 'pdf-to-images',
    name: 'PDF to JPG / PNG',
    category: 'Convert',
    phase: 5,
    description: 'Render every PDF page into high-resolution JPG or PNG images with ZIP support.',
    icon: 'image',
    badge: 'Popular',
    route: '/workspace.html?tool=pdf-to-images',
    acceptsMultiple: false
  },
  {
    id: 'pdf-to-pptx',
    name: 'PDF to PowerPoint',
    category: 'Convert',
    phase: 5,
    description: 'Convert PDF slides into presentation-ready Microsoft PowerPoint (.pptx) decks.',
    icon: 'monitor',
    badge: null,
    route: '/workspace.html?tool=pdf-to-pptx',
    acceptsMultiple: false
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    category: 'Convert',
    phase: 5,
    description: 'Extract clean, formatted plain text (.txt) from all or selected pages.',
    icon: 'align-left',
    badge: null,
    route: '/workspace.html?tool=pdf-to-text',
    acceptsMultiple: false
  },
  {
    id: 'docx-to-pdf',
    name: 'Word to PDF',
    category: 'Convert',
    phase: 5,
    description: 'Convert Microsoft Word documents (.docx) to standardized PDF format.',
    icon: 'file-plus',
    badge: 'Popular',
    route: '/workspace.html?tool=docx-to-pdf',
    acceptsMultiple: false
  },
  {
    id: 'images-to-pdf',
    name: 'Images to PDF',
    category: 'Convert',
    phase: 5,
    description: 'Convert JPG, PNG, and TIFF images into a single polished PDF.',
    icon: 'camera',
    badge: null,
    route: '/workspace.html?tool=images-to-pdf',
    acceptsMultiple: true
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    category: 'Convert',
    phase: 5,
    description: 'Render sanitized HTML content or code into formatted PDF documents.',
    icon: 'code',
    badge: null,
    route: '/workspace.html?tool=html-to-pdf',
    acceptsMultiple: false
  },

  // Phase 6: Security & Watermark
  {
    id: 'protect',
    name: 'Protect PDF',
    category: 'Security',
    phase: 6,
    description: 'Encrypt your PDF with strong AES passwords and restrict printing/copying.',
    icon: 'lock',
    badge: 'Security',
    route: '/workspace.html?tool=protect',
    acceptsMultiple: false
  },
  {
    id: 'unlock',
    name: 'Unlock PDF',
    category: 'Security',
    phase: 6,
    description: 'Provide your document password to remove restrictions cleanly.',
    icon: 'unlock',
    badge: 'Security',
    route: '/workspace.html?tool=unlock',
    acceptsMultiple: false
  },
  {
    id: 'watermark',
    name: 'Watermark PDF',
    category: 'Security',
    phase: 6,
    description: 'Apply custom text or logo image watermarks with precise positioning.',
    icon: 'shield',
    badge: 'Custom',
    route: '/workspace.html?tool=watermark',
    acceptsMultiple: false
  },

  // Phase 7: Advanced PDF Tools
  {
    id: 'alternate-mix',
    name: 'Alternate & Mix',
    category: 'Advanced',
    phase: 7,
    description: 'Interlace pages alternately from two or more documents with reverse-order support.',
    icon: 'layers',
    badge: 'Popular',
    route: '/workspace.html?tool=alternate-mix',
    acceptsMultiple: true
  },
  {
    id: 'split-bookmarks',
    name: 'Split By Bookmarks',
    category: 'Advanced',
    phase: 7,
    description: 'Divide documents into chapter chunks according to PDF outline sections.',
    icon: 'bookmark',
    badge: null,
    route: '/workspace.html?tool=split-bookmarks',
    acceptsMultiple: false
  },
  {
    id: 'split-by-size',
    name: 'Split By Size',
    category: 'Advanced',
    phase: 7,
    description: 'Split large documents into multiple target PDFs within a maximum file size limit.',
    icon: 'minimize-2',
    badge: null,
    route: '/workspace.html?tool=split-by-size',
    acceptsMultiple: false
  },
  {
    id: 'split-by-text',
    name: 'Split By Text',
    category: 'Advanced',
    phase: 7,
    description: 'Create new split files wherever specific keywords, headers, or triggers appear.',
    icon: 'scissors',
    badge: null,
    route: '/workspace.html?tool=split-by-text',
    acceptsMultiple: false
  },
  {
    id: 'bates',
    name: 'Bates Numbering',
    category: 'Advanced',
    phase: 7,
    description: 'Index legal, medical, and business records with sequential Bates numbers.',
    icon: 'hash',
    badge: 'Legal',
    route: '/workspace.html?tool=bates',
    acceptsMultiple: false
  },
  {
    id: 'bookmarks',
    name: 'Create Bookmarks',
    category: 'Advanced',
    phase: 7,
    description: 'Insert an interactive Table of Contents outline with navigation bookmarks.',
    icon: 'list',
    badge: null,
    route: '/workspace.html?tool=bookmarks',
    acceptsMultiple: false
  },
  {
    id: 'metadata',
    name: 'Edit Metadata',
    category: 'Advanced',
    phase: 7,
    description: 'Inspect and edit document Title, Author, Subject, and Keywords.',
    icon: 'info',
    badge: null,
    route: '/workspace.html?tool=metadata',
    acceptsMultiple: false
  },
  {
    id: 'extract-images',
    name: 'Extract Images',
    category: 'Advanced',
    phase: 7,
    description: 'Extract and download all embedded raster graphics and photos into a ZIP archive.',
    icon: 'image',
    badge: null,
    route: '/workspace.html?tool=extract-images',
    acceptsMultiple: false
  },
  {
    id: 'flip',
    name: 'Flip Pages',
    category: 'Advanced',
    phase: 7,
    description: 'Mirror PDF pages horizontally or vertically with true vector reflection.',
    icon: 'rotate-ccw',
    badge: null,
    route: '/workspace.html?tool=flip',
    acceptsMultiple: false
  },
  {
    id: 'header-footer',
    name: 'Header & Footer',
    category: 'Advanced',
    phase: 7,
    description: 'Stamp custom 3-position headers and footers with page count dynamic tokens.',
    icon: 'align-center',
    badge: null,
    route: '/workspace.html?tool=header-footer',
    acceptsMultiple: false
  },
  {
    id: 'n-up',
    name: 'N-Up Pages',
    category: 'Advanced',
    phase: 7,
    description: 'Impose 2, 4, 9, or 16 pages onto single sheets with margin and grid layout.',
    icon: 'grid',
    badge: 'Popular',
    route: '/workspace.html?tool=n-up',
    acceptsMultiple: false
  },
  {
    id: 'page-numbers',
    name: 'Page Numbers',
    category: 'Advanced',
    phase: 7,
    description: 'Insert customizable header or footer page numbers with format options.',
    icon: 'bookmark',
    badge: null,
    route: '/workspace.html?tool=page-numbers',
    acceptsMultiple: false
  },
  {
    id: 'rename',
    name: 'Rename PDF',
    category: 'Advanced',
    phase: 7,
    description: 'Intelligently derive standardized, clean filenames from detected document text.',
    icon: 'edit-2',
    badge: null,
    route: '/workspace.html?tool=rename',
    acceptsMultiple: false
  },
  {
    id: 'repair',
    name: 'Repair PDF',
    category: 'Advanced',
    phase: 7,
    description: 'Diagnose and reconstruct corrupted or broken PDF cross-reference tables.',
    icon: 'tool',
    badge: null,
    route: '/workspace.html?tool=repair',
    acceptsMultiple: false
  }
];

function getAllTools(req, res) {
  const { category } = req.query;
  let list = TOOLS;
  if (category) {
    list = TOOLS.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }
  return res.json({
    success: true,
    total: list.length,
    tools: list
  });
}

function getToolById(req, res) {
  const { id } = req.params;
  const tool = TOOLS.find(t => t.id.toLowerCase() === id.toLowerCase());
  if (!tool) {
    return res.status(404).json({
      success: false,
      message: `Tool '${id}' not found in registry.`
    });
  }
  return res.json({
    success: true,
    tool
  });
}

module.exports = {
  TOOLS,
  getAllTools,
  getToolById
};
