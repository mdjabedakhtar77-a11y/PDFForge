/**
 * PDFForge - Mozilla PDF.js Canvas Viewer & Thumbnail Manager
 */

export class PDFViewer {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('main-pdf-canvas');
    this.thumbnailListEl = options.thumbnailListEl || document.getElementById('thumbnail-list');
    this.pageIndicatorEl = options.pageIndicatorEl || document.getElementById('page-indicator');
    this.zoomIndicatorEl = options.zoomIndicatorEl || document.getElementById('zoom-indicator');
    
    this.pdfDoc = null;
    this.pageNum = 1;
    this.totalCount = 0;
    this.scale = 1.0;
    this.rotation = 0;
    this.isRendering = false;
    this.pageNumPending = null;
    this.selectedPages = new Set();
    this.pageOrder = [];
    this.onSelectionChange = options.onSelectionChange || null;
    this.onOrderChange = options.onOrderChange || null;

    this.ensurePdfJsReady();
  }

  ensurePdfJsReady() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  /**
   * Load PDF by URL or ArrayBuffer
   */
  async loadDocument(urlOrBuffer) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library not loaded.');
    }

    try {
      let docParam = urlOrBuffer;
      const token = localStorage.getItem('pdfforge_token');

      if (typeof urlOrBuffer === 'string') {
        let url = urlOrBuffer;
        if (token && !url.includes('token=')) {
          url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
        }
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Fetch binary directly with standard fetch for full cross-origin compatibility
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch document (HTTP ${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        docParam = { data: new Uint8Array(buffer) };
      }

      const loadingTask = window.pdfjsLib.getDocument(docParam);
      this.pdfDoc = await loadingTask.promise;
      this.totalCount = this.pdfDoc.numPages;
      this.pageNum = 1;
      this.rotation = 0;
      this.selectedPages.clear();
      this.pageOrder = Array.from({ length: this.totalCount }, (_, i) => i + 1);

      await this.renderPage(this.pageNum);
      await this.renderThumbnails();
      this.updateIndicators();

      return this.pdfDoc;
    } catch (err) {
      console.error('[PDFViewer] Failed to load PDF:', err);
      throw err;
    }
  }

  /**
   * Render single page on main viewport canvas
   */
  async renderPage(num) {
    if (!this.pdfDoc || !this.canvas) return;

    this.isRendering = true;
    const page = await this.pdfDoc.getPage(num);
    const ctx = this.canvas.getContext('2d');

    // Calculate viewport with scale and rotation
    const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
    
    // Support crisp display on HiDPI/Retina screens
    const outputScale = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(viewport.width * outputScale);
    this.canvas.height = Math.floor(viewport.height * outputScale);
    this.canvas.style.width = `${Math.floor(viewport.width)}px`;
    this.canvas.style.height = `${Math.floor(viewport.height)}px`;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      transform: transform,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);

    try {
      await renderTask.promise;
      this.isRendering = false;
      this.updateActiveThumbnail(num);
      this.updateIndicators();

      if (this.pageNumPending !== null) {
        this.renderPage(this.pageNumPending);
        this.pageNumPending = null;
      }
    } catch (error) {
      this.isRendering = false;
      console.warn('[PDFViewer] Render cancelled or failed:', error.message);
    }
  }

  queueRenderPage(num) {
    if (this.isRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPage(num);
    }
  }

  /**
   * Render all page thumbnails in sidebar with selection & drag reordering
   */
  async renderThumbnails() {
    if (!this.thumbnailListEl || !this.pdfDoc) return;
    this.thumbnailListEl.innerHTML = '';

    let draggedItem = null;

    for (const pageIndex of this.pageOrder) {
      const item = document.createElement('div');
      item.className = `thumbnail-item ${pageIndex === this.pageNum ? 'active' : ''} ${this.selectedPages.has(pageIndex) ? 'selected' : ''}`;
      item.dataset.page = pageIndex;
      item.draggable = true;

      // Selection Checkbox
      const selectBox = document.createElement('div');
      selectBox.className = `thumbnail-select-box ${this.selectedPages.has(pageIndex) ? 'checked' : ''}`;
      selectBox.title = `Select Page ${pageIndex}`;
      selectBox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePageSelection(pageIndex);
      });
      item.appendChild(selectBox);

      // Thumbnail Canvas
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.className = 'thumbnail-canvas';
      item.appendChild(thumbCanvas);

      // Page Label
      const label = document.createElement('span');
      label.className = 'thumbnail-page-num';
      label.textContent = `Page ${pageIndex}`;
      item.appendChild(label);

      item.addEventListener('click', () => {
        this.goToPage(pageIndex);
      });

      // Drag and Drop Reordering Handlers
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pageIndex);
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (draggedItem && draggedItem !== item) {
          const fromPage = parseInt(draggedItem.dataset.page, 10);
          const toPage = parseInt(item.dataset.page, 10);
          this.reorderPages(fromPage, toPage);
        }
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
      });

      this.thumbnailListEl.appendChild(item);

      // Render thumbnail asynchronously
      this.renderSingleThumbnail(pageIndex, thumbCanvas);
    }
  }

  reorderPages(fromPage, toPage) {
    const fromIdx = this.pageOrder.indexOf(fromPage);
    const toIdx = this.pageOrder.indexOf(toPage);
    if (fromIdx !== -1 && toIdx !== -1) {
      this.pageOrder.splice(fromIdx, 1);
      this.pageOrder.splice(toIdx, 0, fromPage);
      this.renderThumbnails();
      if (this.onOrderChange) {
        this.onOrderChange(this.pageOrder);
      }
    }
  }

  togglePageSelection(pageIndex) {
    if (this.selectedPages.has(pageIndex)) {
      this.selectedPages.delete(pageIndex);
    } else {
      this.selectedPages.add(pageIndex);
    }
    this.updateThumbnailSelectionUI();
    if (this.onSelectionChange) {
      this.onSelectionChange(Array.from(this.selectedPages).sort((a, b) => a - b));
    }
  }

  selectAll() {
    this.pageOrder.forEach(p => this.selectedPages.add(p));
    this.updateThumbnailSelectionUI();
    if (this.onSelectionChange) {
      this.onSelectionChange(Array.from(this.selectedPages).sort((a, b) => a - b));
    }
  }

  deselectAll() {
    this.selectedPages.clear();
    this.updateThumbnailSelectionUI();
    if (this.onSelectionChange) {
      this.onSelectionChange([]);
    }
  }

  getSelectedPages() {
    return Array.from(this.selectedPages).sort((a, b) => a - b);
  }

  getPageOrder() {
    return [...this.pageOrder];
  }

  updateThumbnailSelectionUI() {
    if (!this.thumbnailListEl) return;
    const items = this.thumbnailListEl.querySelectorAll('.thumbnail-item');
    items.forEach(el => {
      const p = parseInt(el.dataset.page, 10);
      const isSelected = this.selectedPages.has(p);
      el.classList.toggle('selected', isSelected);
      const box = el.querySelector('.thumbnail-select-box');
      if (box) box.classList.toggle('checked', isSelected);
    });
  }

  async renderSingleThumbnail(pageIndex, canvasEl) {
    try {
      const page = await this.pdfDoc.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 0.25 });
      const ctx = canvasEl.getContext('2d');

      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.warn(`[PDFViewer] Thumbnail ${pageIndex} render error:`, err);
    }
  }

  updateActiveThumbnail(num) {
    if (!this.thumbnailListEl) return;
    const items = this.thumbnailListEl.querySelectorAll('.thumbnail-item');
    items.forEach(el => {
      if (parseInt(el.dataset.page, 10) === num) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  updateIndicators() {
    if (this.pageIndicatorEl) {
      this.pageIndicatorEl.textContent = `${this.pageNum} / ${this.totalCount || 1}`;
    }
    if (this.zoomIndicatorEl) {
      this.zoomIndicatorEl.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  // Navigation methods
  prevPage() {
    if (this.pageNum <= 1) return;
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  nextPage() {
    if (!this.pdfDoc || this.pageNum >= this.totalCount) return;
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  goToPage(num) {
    const target = Math.max(1, Math.min(num, this.totalCount));
    if (target !== this.pageNum) {
      this.pageNum = target;
      this.queueRenderPage(this.pageNum);
    }
  }

  // Zoom methods
  zoomIn() {
    if (this.scale >= 3.0) return;
    this.scale = +(this.scale + 0.25).toFixed(2);
    this.queueRenderPage(this.pageNum);
  }

  zoomOut() {
    if (this.scale <= 0.5) return;
    this.scale = +(this.scale - 0.25).toFixed(2);
    this.queueRenderPage(this.pageNum);
  }

  resetZoom() {
    this.scale = 1.0;
    this.queueRenderPage(this.pageNum);
  }

  rotateCw() {
    this.rotation = (this.rotation + 90) % 360;
    this.queueRenderPage(this.pageNum);
  }
}
