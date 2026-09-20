/**
 * PDFForge - Interactive Editor, Forms & Signature Overlay Manager
 */

export class EditorOverlayManager {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('canvas-wrapper');
    this.viewer = options.viewer;
    this.activeMode = 'select'; // 'select' | 'text' | 'rectangle' | 'circle' | 'line' | 'draw' | 'highlight' | 'whiteout' | 'signature' | 'form-text'
    this.elements = []; // List of all placed elements across pages
    this.selectedElement = null;
    this.isDrawing = false;
    this.currentPath = [];
    this.activeColor = '#6366f1';
    this.activeFontSize = 16;
    this.activeThickness = 2;

    this.overlayLayer = null;
    this.freehandCanvas = null;
    this.init();
  }

  init() {
    this.ensureOverlayDOM();
    this.setupSignatureModal();
  }

  ensureOverlayDOM() {
    if (!this.container) return;

    // Check if overlay layer exists
    this.overlayLayer = this.container.querySelector('.editor-overlay-layer');
    if (!this.overlayLayer) {
      this.overlayLayer = document.createElement('div');
      this.overlayLayer.className = 'editor-overlay-layer';
      this.container.appendChild(this.overlayLayer);
    }

    // Check if freehand drawing canvas exists
    this.freehandCanvas = this.container.querySelector('.freehand-canvas');
    if (!this.freehandCanvas) {
      this.freehandCanvas = document.createElement('canvas');
      this.freehandCanvas.className = 'freehand-canvas';
      this.freehandCanvas.style.display = 'none';
      this.container.appendChild(this.freehandCanvas);
      this.setupFreehandListeners();
    }

    this.setupOverlayClick();
  }

  setMode(mode) {
    this.activeMode = mode;
    if (this.freehandCanvas) {
      this.freehandCanvas.style.display = mode === 'draw' ? 'block' : 'none';
      if (mode === 'draw') {
        this.resizeFreehandCanvas();
      }
    }
    if (mode === 'signature') {
      this.openSignatureModal();
    }
  }

  setupOverlayClick() {
    this.overlayLayer.addEventListener('mousedown', (e) => {
      if (e.target !== this.overlayLayer) return;

      const rect = this.overlayLayer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentPage = this.viewer ? this.viewer.pageNum : 1;

      if (this.activeMode === 'text') {
        this.addElement({
          page: currentPage,
          type: 'text',
          x,
          y,
          width: 140,
          height: 32,
          text: 'Type text here',
          color: this.activeColor,
          fontSize: this.activeFontSize
        });
        this.setMode('select');
      } else if (this.activeMode === 'rectangle') {
        this.addElement({
          page: currentPage,
          type: 'rectangle',
          x,
          y,
          width: 120,
          height: 60,
          color: this.activeColor,
          fillColor: 'transparent',
          borderWidth: 2
        });
        this.setMode('select');
      } else if (this.activeMode === 'circle') {
        this.addElement({
          page: currentPage,
          type: 'circle',
          x,
          y,
          width: 80,
          height: 80,
          color: this.activeColor,
          fillColor: 'transparent'
        });
        this.setMode('select');
      } else if (this.activeMode === 'highlight') {
        this.addElement({
          page: currentPage,
          type: 'highlight',
          x,
          y,
          width: 160,
          height: 24,
          color: '#facc15',
          opacity: 0.4
        });
        this.setMode('select');
      } else if (this.activeMode === 'whiteout') {
        this.addElement({
          page: currentPage,
          type: 'whiteout',
          x,
          y,
          width: 120,
          height: 28
        });
        this.setMode('select');
      } else if (this.activeMode === 'form-text') {
        this.addElement({
          page: currentPage,
          type: 'form-text',
          name: `text_field_${Date.now().toString().slice(-4)}`,
          x,
          y,
          width: 160,
          height: 26,
          defaultValue: ''
        });
        this.setMode('select');
      } else if (this.activeMode === 'form-checkbox') {
        this.addElement({
          page: currentPage,
          type: 'form-checkbox',
          name: `checkbox_${Date.now().toString().slice(-4)}`,
          x,
          y,
          width: 20,
          height: 20,
          checked: false
        });
        this.setMode('select');
      }
    });
  }

  addElement(elData) {
    this.elements.push(elData);
    this.renderPageElements();
    this.selectElement(elData);
  }

  renderPageElements() {
    if (!this.overlayLayer) return;
    this.overlayLayer.innerHTML = '';

    const currentPage = this.viewer ? this.viewer.pageNum : 1;
    const pageElements = this.elements.filter(el => el.page === currentPage);

    pageElements.forEach(el => {
      const elNode = document.createElement('div');
      elNode.className = `editor-element ${this.selectedElement === el ? 'selected' : ''}`;
      elNode.style.left = `${el.x}px`;
      elNode.style.top = `${el.y}px`;
      elNode.style.width = `${el.width}px`;
      elNode.style.height = `${el.height}px`;

      // Delete badge
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'editor-element-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Delete element';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeElement(el);
      });
      elNode.appendChild(deleteBtn);

      // Element content
      if (el.type === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'editor-text-content';
        textarea.value = el.text;
        textarea.style.color = el.color || '#ffffff';
        textarea.style.fontSize = `${el.fontSize || 16}px`;
        textarea.addEventListener('input', (e) => {
          el.text = e.target.value;
        });
        elNode.appendChild(textarea);
      } else if (el.type === 'rectangle' || el.type === 'whiteout') {
        elNode.style.border = el.type === 'whiteout' ? '1px solid #ccc' : `2px solid ${el.color || '#6366f1'}`;
        elNode.style.background = el.type === 'whiteout' ? '#ffffff' : (el.fillColor || 'transparent');
      } else if (el.type === 'highlight') {
        elNode.style.background = el.color || '#facc15';
        elNode.style.opacity = el.opacity || 0.4;
      } else if (el.type === 'circle') {
        elNode.style.border = `2px solid ${el.color || '#6366f1'}`;
        elNode.style.borderRadius = '50%';
        elNode.style.background = el.fillColor || 'transparent';
      } else if (el.type === 'signature' || el.type === 'image' || el.type === 'drawing') {
        const img = document.createElement('img');
        img.src = el.dataUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.draggable = false;
        elNode.appendChild(img);
      } else if (el.type === 'form-text') {
        elNode.className += ' editor-form-field-preview';
        elNode.textContent = `📝 [Text Field: ${el.name}]`;
      } else if (el.type === 'form-checkbox') {
        elNode.className += ' editor-form-field-preview';
        elNode.textContent = `☑`;
      }

      this.makeDraggable(elNode, el);

      elNode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectElement(el);
      });

      this.overlayLayer.appendChild(elNode);
    });
  }

  selectElement(el) {
    this.selectedElement = el;
    this.renderPageElements();
    this.updatePropertiesPanel(el);
  }

  removeElement(el) {
    const idx = this.elements.indexOf(el);
    if (idx !== -1) {
      this.elements.splice(idx, 1);
      if (this.selectedElement === el) {
        this.selectedElement = null;
      }
      this.renderPageElements();
    }
  }

  makeDraggable(node, el) {
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    node.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('editor-text-content')) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = el.x;
      initialTop = el.y;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        el.x = Math.max(0, initialLeft + dx);
        el.y = Math.max(0, initialTop + dy);
        node.style.left = `${el.x}px`;
        node.style.top = `${el.y}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  updatePropertiesPanel(el) {
    const container = document.getElementById('tool-options-container');
    if (!container || !el) return;

    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Element Properties (${el.type.toUpperCase()})</label>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Page: ${el.page} | X: ${Math.round(el.x)}px, Y: ${Math.round(el.y)}px</div>
      </div>
      ${el.type === 'text' ? `
        <div class="options-group">
          <label class="options-label">Font Size</label>
          <input type="number" class="form-input" id="prop-font-size" value="${el.fontSize || 16}" min="8" max="72">
        </div>
      ` : ''}
      <div class="options-group">
        <label class="options-label">Color</label>
        <input type="color" class="form-input" id="prop-color" value="${el.color || '#6366f1'}" style="height: 40px; padding: 2px;">
      </div>
      <button type="button" class="btn btn-outline btn-sm" id="prop-delete-btn" style="color: var(--danger); border-color: var(--danger);">
        Delete Element
      </button>
    `;

    document.getElementById('prop-font-size')?.addEventListener('input', (e) => {
      el.fontSize = parseInt(e.target.value, 10) || 16;
      this.renderPageElements();
    });

    document.getElementById('prop-color')?.addEventListener('input', (e) => {
      el.color = e.target.value;
      this.renderPageElements();
    });

    document.getElementById('prop-delete-btn')?.addEventListener('click', () => {
      this.removeElement(el);
      container.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted);">Element removed.</div>`;
    });
  }

  /* Freehand Drawing Setup */
  setupFreehandListeners() {
    const canvas = this.freehandCanvas;
    const ctx = canvas.getContext('2d');

    const startDraw = (e) => {
      if (this.activeMode !== 'draw') return;
      this.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = this.activeColor;
      ctx.lineWidth = this.activeThickness;
      ctx.lineCap = 'round';
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const endDraw = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      // Convert freehand drawing to an element and clear canvas
      const dataUrl = canvas.toDataURL('image/png');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const currentPage = this.viewer ? this.viewer.pageNum : 1;
      this.addElement({
        page: currentPage,
        type: 'drawing',
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        dataUrl
      });
      this.setMode('select');
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
  }

  resizeFreehandCanvas() {
    if (!this.freehandCanvas || !this.overlayLayer) return;
    this.freehandCanvas.width = this.overlayLayer.clientWidth;
    this.freehandCanvas.height = this.overlayLayer.clientHeight;
  }

  /* Signature Modal Setup */
  setupSignatureModal() {
    let modal = document.getElementById('signature-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'signature-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Create Signature</h3>
            <button type="button" class="btn btn-ghost btn-sm" id="sig-close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div class="signature-pad-container">
              <canvas id="signature-canvas"></canvas>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button type="button" class="btn btn-outline btn-sm" id="sig-clear-btn">Clear Canvas</button>
              <label class="btn btn-outline btn-sm" style="margin: 0; cursor: pointer;">
                Upload Signature Image
                <input type="file" accept="image/png,image/jpeg" id="sig-file-input" style="display: none;">
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline btn-sm" id="sig-cancel-btn">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" id="sig-adopt-btn">Adopt & Place</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const canvas = modal.querySelector('#signature-canvas');
      const ctx = canvas.getContext('2d');
      let isSigDrawing = false;

      const initSigCanvas = () => {
        canvas.width = 460;
        canvas.height = 180;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      };

      canvas.addEventListener('mousedown', (e) => {
        isSigDrawing = true;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      });

      canvas.addEventListener('mousemove', (e) => {
        if (!isSigDrawing) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      });

      canvas.addEventListener('mouseup', () => isSigDrawing = false);

      modal.querySelector('#sig-clear-btn').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });

      modal.querySelector('#sig-file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 20, 20, 420, 140);
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(e.target.files[0]);
        }
      });

      const closeModal = () => {
        modal.classList.remove('open');
        this.setMode('select');
      };

      modal.querySelector('#sig-close-btn').addEventListener('click', closeModal);
      modal.querySelector('#sig-cancel-btn').addEventListener('click', closeModal);

      modal.querySelector('#sig-adopt-btn').addEventListener('click', () => {
        const sigDataUrl = canvas.toDataURL('image/png');
        const currentPage = this.viewer ? this.viewer.pageNum : 1;
        this.addElement({
          page: currentPage,
          type: 'signature',
          x: 100,
          y: 200,
          width: 180,
          height: 70,
          dataUrl: sigDataUrl
        });
        closeModal();
      });

      this.initSigCanvas = initSigCanvas;
    }
  }

  openSignatureModal() {
    const modal = document.getElementById('signature-modal');
    if (modal) {
      modal.classList.add('open');
      if (this.initSigCanvas) this.initSigCanvas();
    }
  }

  /**
   * Export all visual elements normalized to PDF point coordinates (72 DPI)
   */
  exportElementsForServer() {
    if (!this.overlayLayer) return [];

    const overlayWidth = this.overlayLayer.clientWidth || 600;
    const overlayHeight = this.overlayLayer.clientHeight || 800;

    // Separate AcroForm fields vs visual elements
    const visualElements = [];
    const formFields = [];

    this.elements.forEach(el => {
      // Scale factor from current preview canvas to standard PDF points
      const scaleX = 1;
      const scaleY = 1;

      if (el.type.startsWith('form-')) {
        formFields.push({
          page: el.page || 1,
          type: el.type.replace('form-', ''),
          name: el.name,
          x: el.x * scaleX,
          y: el.y * scaleY,
          width: el.width * scaleX,
          height: el.height * scaleY,
          defaultValue: el.defaultValue,
          checked: el.checked
        });
      } else {
        visualElements.push({
          page: el.page || 1,
          type: el.type,
          x: el.x * scaleX,
          y: el.y * scaleY,
          width: el.width * scaleX,
          height: el.height * scaleY,
          text: el.text,
          fontSize: el.fontSize,
          color: el.color,
          fillColor: el.fillColor,
          opacity: el.opacity,
          dataUrl: el.dataUrl
        });
      }
    });

    return { visualElements, formFields };
  }

  clear() {
    this.elements = [];
    this.selectedElement = null;
    this.renderPageElements();
  }
}
