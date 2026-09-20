/**
 * PDFForge - Main Coordinator & Route Handlers
 */
import { api, showToast, getApiBase } from './api.js';
import { setupDropzone } from './upload.js';
import { PDFViewer } from './pdfViewer.js';
import { EditorOverlayManager } from './editorOverlay.js';

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;

  if (path.includes('workspace.html')) {
    initWorkspace();
  } else if (path.includes('auth.html')) {
    initAuthPage();
  } else {
    // Default to Landing / Tool Hub
    initLandingPage();
  }
});

/* ==========================================================================
   Landing Page: Tool Registry & Quick Dropzone
   ========================================================================== */
let allTools = [];

async function initLandingPage() {
  const dropzoneEl = document.getElementById('hero-dropzone');
  if (dropzoneEl) {
    setupDropzone(dropzoneEl);
  }

  const gridEl = document.getElementById('tools-grid');
  const searchInput = document.getElementById('tool-search');
  const filterTabs = document.querySelectorAll('.filter-tab');

  try {
    const res = await api.get('/api/tools');
    if (res.success && res.tools) {
      allTools = res.tools;
      renderTools(allTools, gridEl);
    }
  } catch (err) {
    console.error('Failed to load tool registry:', err);
  }

  // Filter tab interactions
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterTools(gridEl, searchInput?.value || '', tab.dataset.category);
    });
  });

  // Search input interaction
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const activeTab = document.querySelector('.filter-tab.active');
      filterTools(gridEl, e.target.value, activeTab?.dataset.category || 'all');
    });
  }
}

function filterTools(container, query, category) {
  const cleanQuery = query.toLowerCase().trim();
  const filtered = allTools.filter(t => {
    const matchesCategory = !category || category === 'all' || t.category.toLowerCase() === category.toLowerCase();
    const matchesQuery = !cleanQuery || 
      t.name.toLowerCase().includes(cleanQuery) || 
      t.description.toLowerCase().includes(cleanQuery);
    return matchesCategory && matchesQuery;
  });
  renderTools(filtered, container);
}

function renderTools(tools, container) {
  if (!container) return;
  container.innerHTML = '';

  if (tools.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
        No matching tools found. Try a different keyword or category.
      </div>
    `;
    return;
  }

  tools.forEach(tool => {
    const card = document.createElement('a');
    card.href = tool.route;
    card.className = 'tool-card';
    card.innerHTML = `
      <div>
        <div class="tool-card-header">
          <div class="tool-icon-wrapper">
            ${getToolIconSvg(tool.icon)}
          </div>
          ${tool.badge ? `<span class="badge">${tool.badge}</span>` : ''}
        </div>
        <h3 class="tool-title">${escapeHtml(tool.name)}</h3>
        <p class="tool-desc">${escapeHtml(tool.description)}</p>
      </div>
      <div class="tool-footer">
        <span class="tool-category-label">${escapeHtml(tool.category)}</span>
        <span class="tool-launch-arrow">
          Open
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

function getToolIconSvg(name) {
  const icons = {
    layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    scissors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
    'rotate-cw': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    'rotate-ccw': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    'edit-3': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    'edit-2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
    feather: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'minimize-2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/></svg>`,
    'maximize-2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'file-text': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    'trash-2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    crop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>`,
    'check-square': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    compass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    disc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
    table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    'align-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`,
    'align-center': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>`,
    'file-plus': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    hash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    tool: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
  };
  return icons[name] || icons['file-text'];
}

/* ==========================================================================
   Workspace Initialization & Result Download Handler
   ========================================================================== */
let viewer = null;
let currentFile = null;
let editorManager = null;
let mergeQueue = [];
let currentResultFile = null;

// Expose workspace coordinator helpers for browser tests & inspection
window.__pdfforge = {
  get mergeQueue() { return mergeQueue; },
  set mergeQueue(val) { mergeQueue = val; },
  get currentFile() { return currentFile; },
  get currentResultFile() { return currentResultFile; },
  renderMergeQueue: () => renderMergeQueue(),
  showDownloadButton: (file) => showDownloadButton(file),
  hideDownloadButton: () => hideDownloadButton(),
  downloadResultSecurely: (id, name) => downloadResultSecurely(id, name)
};

function hideDownloadButton() {
  currentResultFile = null;
  const downloadBtn = document.getElementById('btn-download-result');
  if (downloadBtn) {
    downloadBtn.style.display = 'none';
  }
}

function showDownloadButton(file) {
  if (!file) return;
  currentResultFile = file;
  const downloadBtn = document.getElementById('btn-download-result');
  const downloadLabel = document.getElementById('btn-download-label');
  if (downloadBtn) {
    downloadBtn.style.display = 'inline-flex';
    if (downloadLabel) {
      downloadLabel.textContent = file.originalName ? `Download ${file.originalName}` : 'Download Result';
    }
  }
}

async function downloadResultSecurely(fileId, filename) {
  const downloadBtn = document.getElementById('btn-download-result');
  const labelEl = document.getElementById('btn-download-label');
  const prevLabel = labelEl ? labelEl.textContent : 'Download Result';
  try {
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.style.opacity = '0.75';
      if (labelEl) labelEl.textContent = 'Downloading...';
    }
    showToast('Starting download...', 'info');

    const token = localStorage.getItem('pdfforge_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiBase = getApiBase();
    const downloadUrl = `${apiBase}/api/files/${fileId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      let errorMsg = `Download failed (HTTP ${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) {
          errorMsg = errJson.message;
        }
      } catch (_) {}
      throw new Error(errorMsg);
    }

    // Extract filename from Content-Disposition header if available
    let finalDownloadName = filename;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        finalDownloadName = decodeURIComponent(match[1]);
      }
    }
    if (!finalDownloadName) {
      finalDownloadName = 'downloaded_document.pdf';
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = finalDownloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    showToast(`Successfully downloaded ${finalDownloadName}`, 'success');
  } catch (err) {
    console.error('Download error:', err);
    showToast(err.message || 'Download error occurred.', 'error');
  } finally {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.style.opacity = '1';
      if (labelEl) labelEl.textContent = prevLabel;
    }
  }
}

async function initWorkspace() {
  mergeQueue = [];
  const urlParams = new URLSearchParams(window.location.search);
  const toolId = urlParams.get('tool') || 'merge';
  const fileId = urlParams.get('fileId');

  // Load Tool Metadata
  try {
    const res = await api.get(`/api/tools/${toolId}`);
    if (res.success && res.tool) {
      document.getElementById('workspace-tool-title').textContent = res.tool.name;
      document.getElementById('workspace-tool-desc').textContent = res.tool.description;
      renderToolOptions(res.tool);
    }
  } catch (e) {
    console.warn('Tool metadata not found:', toolId);
  }

  // Show Editor subtoolbar if tool is an editor / sign / form tool
  const isEditorTool = ['editor', 'fill-sign', 'forms'].includes(toolId);
  const subtoolbar = document.getElementById('editor-subtoolbar');
  if (subtoolbar) {
    subtoolbar.style.display = isEditorTool ? 'flex' : 'none';
    if (isEditorTool) {
      const toolBtns = subtoolbar.querySelectorAll('.editor-tool-btn');
      toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toolBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (editorManager) {
            editorManager.setMode(btn.dataset.mode);
          }
        });
      });
    }
  }

  // Setup PDF Viewer
  viewer = new PDFViewer({
    onSelectionChange: (selected) => {
      const selectionCounter = document.getElementById('opt-selected-count');
      if (selectionCounter) {
        selectionCounter.textContent = selected.length > 0 ? selected.join(', ') : 'None';
      }
      const rangeInput = document.getElementById('opt-ranges');
      if (rangeInput && selected.length > 0) {
        rangeInput.value = selected.join(', ');
      }
    },
    onOrderChange: (newOrder) => {
      const orderInput = document.getElementById('opt-organize-order');
      if (orderInput) {
        orderInput.value = newOrder.join(', ');
      }
    }
  });

  // Setup sidebar selection buttons
  document.getElementById('btn-select-all')?.addEventListener('click', () => viewer.selectAll());
  document.getElementById('btn-clear-selection')?.addEventListener('click', () => viewer.deselectAll());

  // Setup toolbar interactions
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    viewer.prevPage();
    if (editorManager) editorManager.renderPageElements();
  });
  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    viewer.nextPage();
    if (editorManager) editorManager.renderPageElements();
  });
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => viewer.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => viewer.zoomOut());
  document.getElementById('btn-reset-zoom')?.addEventListener('click', () => viewer.resetZoom());
  document.getElementById('btn-rotate')?.addEventListener('click', () => viewer.rotateCw());

  // Setup Workspace Dropzone
  const emptyStateEl = document.getElementById('workspace-dropzone');
  if (emptyStateEl) {
    let accept = '.pdf,application/pdf';
    let allowedExtensions = ['.pdf'];
    if (toolId === 'docx-to-pdf') {
      accept = '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
      allowedExtensions = ['.docx', '.doc'];
    } else if (toolId === 'images-to-pdf') {
      accept = '.png,.jpg,.jpeg,.tiff,.tif,image/*';
      allowedExtensions = ['.png', '.jpg', '.jpeg', '.tiff', '.tif'];
    } else if (toolId === 'html-to-pdf') {
      accept = '.html,.htm,text/html';
      allowedExtensions = ['.html', '.htm'];
    }
    setupDropzone(emptyStateEl, {
      accept,
      allowedExtensions,
      onFileReady: (file) => loadFileIntoWorkspace(file)
    });
  }

  // Load existing file if fileId is in URL
  if (fileId) {
    try {
      const fileRes = await api.get(`/api/files/${fileId}`);
      if (fileRes.success && fileRes.file) {
        loadFileIntoWorkspace(fileRes.file);
      }
    } catch (err) {
      showToast('Could not load specified PDF file.', 'error');
    }
  }

  // Hook Process Button
  document.getElementById('btn-process-pdf')?.addEventListener('click', () => {
    executeToolJob(toolId);
  });

  // Setup Download Result Button (initially hidden until tool success)
  hideDownloadButton();
  const downloadBtn = document.getElementById('btn-download-result');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentResultFile && currentResultFile.id) {
        downloadResultSecurely(currentResultFile.id, currentResultFile.originalName);
      } else {
        showToast('No processed result available for download.', 'warning');
      }
    });
  }
}

function getAuthorizedUrl(url) {
  if (!url) return url;
  const apiBase = getApiBase();
  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
  const token = localStorage.getItem('pdfforge_token');
  if (!token || fullUrl.includes('token=')) return fullUrl;
  return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function loadFileIntoWorkspace(file, { isResult = false } = {}) {
  currentFile = file;

  if (!isResult) {
    hideDownloadButton();
  } else {
    showDownloadButton(file);
  }

  document.getElementById('workspace-empty-state').style.display = 'none';
  
  const titleBadge = document.getElementById('active-file-title');
  if (titleBadge) {
    const sizeStr = file.fileSize ? ` (${(file.fileSize / (1024 * 1024)).toFixed(2)} MB)` : '';
    titleBadge.textContent = `${file.originalName || 'Document'}${sizeStr}`;
  }

  const isPdf = !file.originalName || file.originalName.toLowerCase().endsWith('.pdf');
  const existingResultCard = document.getElementById('non-pdf-result-card');

  if (isPdf) {
    if (existingResultCard) existingResultCard.style.display = 'none';
    document.getElementById('canvas-wrapper').style.display = 'flex';
    document.getElementById('floating-toolbar').style.display = 'flex';
    document.getElementById('sidebar-selection-actions').style.display = 'flex';

    const rawViewUrl = file.viewUrl || `/api/files/${file.id}/view`;
    const viewUrl = getAuthorizedUrl(rawViewUrl);

    viewer.loadDocument(viewUrl).then(() => {
      if (!editorManager) {
        editorManager = new EditorOverlayManager({ viewer });
      } else {
        editorManager.renderPageElements();
      }
    }).catch(err => {
      showToast('Failed to render PDF: ' + err.message, 'error');
    });
  } else {
    // Non-PDF result (e.g. DOCX, XLSX, PPTX, ZIP, TXT)
    document.getElementById('canvas-wrapper').style.display = 'none';
    document.getElementById('floating-toolbar').style.display = 'none';
    document.getElementById('sidebar-selection-actions').style.display = 'none';

    let resultCard = document.getElementById('non-pdf-result-card');
    if (!resultCard) {
      resultCard = document.createElement('div');
      resultCard.id = 'non-pdf-result-card';
      resultCard.className = 'non-pdf-result-card';
      const viewport = document.getElementById('workspace-viewport');
      if (viewport) viewport.appendChild(resultCard);
    }
    resultCard.style.display = 'flex';
    const ext = (file.originalName || '').split('.').pop().toUpperCase();
    resultCard.innerHTML = `
      <div class="result-card-inner">
        <div class="result-card-icon">${ext === 'ZIP' ? '📦' : (ext.includes('DOC') ? '📝' : (ext.includes('XLS') || ext.includes('CSV') ? '📊' : (ext.includes('PPT') ? '📽️' : '📄')))}</div>
        <h3 class="result-card-title">${escapeHtml(file.originalName || 'Processed File')}</h3>
        <p class="result-card-desc">Your ${ext} document has been processed and generated successfully.</p>
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-weight: 600; padding: 0.35rem 0.75rem; border-radius: 99px; margin-bottom: 1.25rem;">✓ Ready for Download</span>
        <div>
          <button type="button" class="btn btn-success" id="btn-quick-download-result" style="padding: 0.75rem 1.5rem; font-size: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download ${ext} Document
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-quick-download-result')?.addEventListener('click', () => {
      downloadResultSecurely(file.id, file.originalName);
    });
  }

  // Update Merge Queue if applicable
  if (!isResult && !mergeQueue.some(f => f.id === file.id)) {
    mergeQueue.push(file);
    renderMergeQueue();
  }
}

function renderMergeQueue() {
  const container = document.getElementById('merge-files-queue');
  if (!container) return;

  container.innerHTML = '';
  if (!mergeQueue || mergeQueue.length === 0) {
    container.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 0.5rem;">
        No extra files added yet. Click "+ Add Another PDF" or drop files.
      </div>
    `;
    return;
  }

  mergeQueue.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'merge-file-item';
    item.innerHTML = `
      <span class="merge-file-name" title="${escapeHtml(f.originalName || 'Document')}">${idx + 1}. ${escapeHtml(f.originalName || 'Document')}</span>
      <button type="button" class="btn btn-ghost btn-sm btn-remove-merge" style="color: var(--danger); padding: 0.1rem 0.4rem;" title="Remove">✕</button>
    `;
    item.querySelector('.btn-remove-merge').addEventListener('click', (e) => {
      e.stopPropagation();
      mergeQueue.splice(idx, 1);
      hideDownloadButton();
      renderMergeQueue();
    });
    container.appendChild(item);
  });
}

function setupAddMergeFileButton() {
  const btn = document.getElementById('btn-add-merge-file');
  if (!btn) return;

  btn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.multiple = true;
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        try {
          for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            showToast(`Uploading ${file.name}...`, 'info');
            const res = await api.uploadFile(file);
            if (res && res.success && res.file) {
              hideDownloadButton();
              if (!mergeQueue.some(f => f.id === res.file.id)) {
                mergeQueue.push(res.file);
              }
              renderMergeQueue();
              if (!currentFile) {
                loadFileIntoWorkspace(res.file);
              }
            }
          }
          showToast('Added to merge list!', 'success');
        } catch (e) {
          showToast(e.message || 'Upload failed', 'error');
        }
      }
    };
    input.click();
  };
}

function renderToolOptions(tool) {
  const container = document.getElementById('tool-options-container');
  if (!container) return;

  if (tool.id === 'merge') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Files in Merge Queue</label>
        <div id="merge-files-queue" class="merge-file-list">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 0.5rem;">
            No extra files added yet. Click "+ Add Another PDF" or drop files.
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-merge-file" style="margin-top: 0.5rem;">
          + Add Another PDF
        </button>
      </div>
    `;

    setupAddMergeFileButton();
    renderMergeQueue();

  } else if (tool.id === 'extract') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages to Extract</label>
        <input type="text" class="form-input" id="opt-ranges" placeholder="e.g. 1-3, 5, 8" value="1">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
          Selected in sidebar: <strong id="opt-selected-count" style="color: var(--accent-cyan);">None</strong>
        </div>
      </div>
    `;
  } else if (tool.id === 'split') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Page Ranges</label>
        <input type="text" class="form-input" id="opt-ranges" placeholder="e.g. 1-2, 3-5" value="1-2">
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          Enter comma-separated page numbers or ranges to split.
        </span>
      </div>
    `;
  } else if (tool.id === 'delete-pages') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages to Delete</label>
        <input type="text" class="form-input" id="opt-ranges" placeholder="e.g. 2, 4" value="2">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
          Select page thumbnails on the left or type page numbers above.
        </div>
      </div>
    `;
  } else if (tool.id === 'organize') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Page Order</label>
        <input type="text" class="form-input" id="opt-organize-order" placeholder="e.g. 3, 2, 1">
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          Drag and drop page thumbnails in the sidebar to reorder visually, or enter the desired order above.
        </span>
      </div>
    `;
  } else if (tool.id === 'rotate') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Rotation Angle</label>
        <div class="preset-buttons-grid">
          <button type="button" class="preset-btn active" data-angle="90">90° CW</button>
          <button type="button" class="preset-btn" data-angle="180">180° Half</button>
          <button type="button" class="preset-btn" data-angle="270">270° (90° CCW)</button>
        </div>
      </div>
      <div class="options-group" style="margin-top: 0.5rem;">
        <label class="options-label">Apply To</label>
        <select class="form-input" id="opt-rotate-scope">
          <option value="all">All Pages in Document</option>
          <option value="selected">Selected Pages in Sidebar</option>
        </select>
      </div>
    `;

    const btns = container.querySelectorAll('.preset-btn');
    btns.forEach(b => {
      b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

  } else if (tool.id === 'crop') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Crop Margins (Points / pt)</label>
        <div class="crop-margins-grid">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Top</span>
            <input type="number" class="form-input" id="opt-crop-top" value="36" min="0">
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Bottom</span>
            <input type="number" class="form-input" id="opt-crop-bottom" value="36" min="0">
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Left</span>
            <input type="number" class="form-input" id="opt-crop-left" value="36" min="0">
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Right</span>
            <input type="number" class="form-input" id="opt-crop-right" value="36" min="0">
          </div>
        </div>
      </div>
    `;
  } else if (tool.id === 'resize') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Standard Page Size</label>
        <select class="form-input" id="opt-page-size">
          <option value="A4">A4 (210 × 297 mm)</option>
          <option value="Letter">US Letter (8.5 × 11 in)</option>
          <option value="A3">A3 (297 × 420 mm)</option>
          <option value="A5">A5 (148 × 210 mm)</option>
          <option value="Legal">US Legal (8.5 × 14 in)</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Orientation</label>
        <select class="form-input" id="opt-orientation">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
    `;
  } else if (tool.id === 'split-half' || tool.id === 'split-in-half') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Split Direction</label>
        <select class="form-input" id="opt-half-orientation">
          <option value="vertical">Vertical (Left & Right halves)</option>
          <option value="horizontal">Horizontal (Top & Bottom halves)</option>
        </select>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
          Ideal for 2-page book scans or dual-page presentation spreads.
        </span>
      </div>
    `;
  } else if (tool.id === 'editor' || tool.id === 'fill-sign') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Interactive PDF Editor</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          • Select <strong>Text, Rectangle, Circle, Draw, or Highlight</strong> on the toolbar above.<br>
          • Click anywhere on the document page to place your element.<br>
          • Drag elements to reposition. Click any element to adjust its font size or color.<br>
          • Click <strong>Sign</strong> to draw or upload your digital signature!
        </div>
      </div>
    `;
  } else if (tool.id === 'forms') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">AcroForms Builder</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          • Click <strong>+ Text Field</strong> or <strong>+ Checkbox</strong> on the toolbar above.<br>
          • Click on the page where you want the interactive fillable form field positioned.<br>
          • Standard AcroForms will be generated directly into the PDF!
        </div>
      </div>
    `;
  } else if (tool.id === 'remove-annotations') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Remove Document Annotations</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Clicking <strong>Process Document</strong> will strip all interactive annotations, highlights, sticky notes, and form fields, leaving clean base vector pages.
        </div>
      </div>
    `;
  } else if (tool.id === 'compress') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Compression Level</label>
        <select class="form-input" id="opt-compress-level">
          <option value="medium">Balanced Compression (Recommended)</option>
          <option value="high">High Compression (Smallest file size)</option>
          <option value="low">Low Compression (Best visual fidelity)</option>
        </select>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Optimizes stream dictionaries, removes metadata bloat, and packs indirect objects into compressed object streams.
        </div>
      </div>
    `;
  } else if (tool.id === 'ocr') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">OCR Language Engine</label>
        <select class="form-input" id="opt-ocr-lang">
          <option value="eng">English (eng)</option>
          <option value="spa">Spanish (spa)</option>
          <option value="fra">French (fra)</option>
          <option value="deu">German (deu)</option>
        </select>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Runs real neural Tesseract OCR, detects text bounding boxes, and embeds an invisible searchable layer directly over page scans.
        </div>
      </div>
    `;
  } else if (tool.id === 'deskew') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Straighten Angle (° degrees)</label>
        <input type="number" class="form-input" id="opt-deskew-angle" placeholder="e.g. -2.5 or 0 for auto" value="0" step="0.5">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Leave 0 to automatically apply subtle scan tilt correction, or enter specific tilt degrees.
        </div>
      </div>
    `;
  } else if (tool.id === 'grayscale') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Convert to Grayscale</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Strips color channels and converts document pages to clean monochrome/grayscale vectors, perfect for archival printing and reducing ink usage.
        </div>
      </div>
    `;
  } else if (tool.id === 'flatten') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Flatten Document</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Consolidates interactive form text fields, checkboxes, and annotations permanently into the PDF page vectors, preventing any future tampering or alterations.
        </div>
      </div>
    `;
  } else if (tool.id === 'pdf-to-word') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages to Convert</label>
        <input type="text" class="form-input" id="opt-convert-pages" placeholder="e.g. 1-5 or all" value="all">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Converts text, headings, and formatting into an editable Microsoft Word (.docx) document.
        </div>
      </div>
    `;
  } else if (tool.id === 'pdf-to-excel') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Output Format</label>
        <select class="form-input" id="opt-excel-format">
          <option value="xlsx">Excel Workbook (.xlsx)</option>
          <option value="csv">Comma-Separated Values (.csv)</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Pages to Convert</label>
        <input type="text" class="form-input" id="opt-convert-pages" placeholder="e.g. 1-5 or all" value="all">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Extracts tabular numbers and cell structures into clean spreadsheet worksheets.
        </div>
      </div>
    `;
  } else if (tool.id === 'pdf-to-images') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Image Format</label>
        <select class="form-input" id="opt-image-format">
          <option value="png">PNG (Lossless & Sharp)</option>
          <option value="jpg">JPG (Compact File Size)</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Rendering Resolution (DPI)</label>
        <select class="form-input" id="opt-image-dpi">
          <option value="150" selected>150 DPI — Balanced Quality</option>
          <option value="72">72 DPI — Screen / Web Size</option>
          <option value="300">300 DPI — Print & Archival Quality</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Pages</label>
        <input type="text" class="form-input" id="opt-convert-pages" placeholder="e.g. 1-3 or all" value="all">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Renders high-resolution raster images. Multi-page conversions are bundled into a downloadable .zip archive.
        </div>
      </div>
    `;
  } else if (tool.id === 'pdf-to-pptx') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages to Convert</label>
        <input type="text" class="form-input" id="opt-convert-pages" placeholder="e.g. 1-10 or all" value="all">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Converts PDF pages into presentation-ready PowerPoint (.pptx) slides with visual fidelity and slide notes.
        </div>
      </div>
    `;
  } else if (tool.id === 'pdf-to-text') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages to Extract</label>
        <input type="text" class="form-input" id="opt-convert-pages" placeholder="e.g. 1-5 or all" value="all">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Extracts clean plain UTF-8 text with page headers and natural paragraph breaks.
        </div>
      </div>
    `;
  } else if (tool.id === 'docx-to-pdf') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Word to PDF Conversion</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Click <strong>Process Document</strong> to render your uploaded DOCX document into a standardized, vector-rendered PDF document.
        </div>
      </div>
    `;
  } else if (tool.id === 'images-to-pdf') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Page Orientation</label>
        <select class="form-input" id="opt-img-orientation">
          <option value="auto">Auto (Match Image Aspect Ratio)</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Margin (Points)</label>
        <select class="form-input" id="opt-img-margin">
          <option value="20">Standard Margin (20 pt)</option>
          <option value="0">No Margins (Edge-to-Edge)</option>
          <option value="36">Wide Margin (36 pt)</option>
        </select>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Converts single or multiple images into a cohesive, high-resolution PDF document.
        </div>
      </div>
    `;
  } else if (tool.id === 'html-to-pdf') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">HTML Content / Markup</label>
        <textarea class="form-input" id="opt-html-content" rows="6" placeholder="Paste HTML code here, e.g. <h1>Title</h1><p>Content...</p>"></textarea>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Renders HTML markup with SSRF-sanitization directly into a PDF document.
        </div>
      </div>
    `;
  } else if (tool.id === 'alternate-mix') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Alternate & Mix Settings</label>
        <div class="checkbox-group" style="margin-bottom: 0.75rem;">
          <input type="checkbox" id="opt-reverse-second">
          <label for="opt-reverse-second">Reverse pages of second document (Back-scan mode)</label>
        </div>
        <div id="merge-files-queue" class="merge-file-list"></div>
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-merge-file" style="margin-top: 0.5rem;">
          + Add Second Document
        </button>
      </div>
    `;
    setupAddMergeFileButton();
    renderMergeQueue();
  } else if (tool.id === 'split-bookmarks') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Split By Bookmarks</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Scans document outline bookmarks / chapter sections and divides pages into discrete sub-documents, downloaded as a ZIP bundle.
        </div>
      </div>
    `;
  } else if (tool.id === 'split-by-size') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Max File Size Per Chunk (MB)</label>
        <input type="number" class="form-input" id="opt-max-size-mb" value="2" min="0.5" step="0.5">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Groups consecutive pages so that each resulting PDF document remains strictly under the selected maximum size.
        </div>
      </div>
    `;
  } else if (tool.id === 'split-by-text') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Trigger Keyword / Pattern</label>
        <input type="text" class="form-input" id="opt-split-trigger" placeholder="e.g. Chapter or Invoice" value="Chapter">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Creates a new document slice every time a page containing this text query is encountered.
        </div>
      </div>
    `;
  } else if (tool.id === 'bates') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Bates Prefix</label>
        <input type="text" class="form-input" id="opt-bates-prefix" value="BATES-">
      </div>
      <div class="options-group">
        <label class="options-label">Starting Number & Digits</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <input type="number" class="form-input" id="opt-bates-start" value="1" min="1">
          <input type="number" class="form-input" id="opt-bates-digits" value="6" min="1" max="12">
        </div>
      </div>
      <div class="options-group">
        <label class="options-label">Position</label>
        <select class="form-input" id="opt-bates-pos">
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-center">Bottom Center</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-center">Top Center</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>
    `;
  } else if (tool.id === 'bookmarks') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Insert Table of Contents Outline</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Prepends an index page with formatted navigation bookmarks and destination page links.
        </div>
      </div>
    `;
  } else if (tool.id === 'metadata') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Document Title</label>
        <input type="text" class="form-input" id="opt-meta-title" placeholder="Document Title">
      </div>
      <div class="options-group">
        <label class="options-label">Author</label>
        <input type="text" class="form-input" id="opt-meta-author" placeholder="Author Name">
      </div>
      <div class="options-group">
        <label class="options-label">Subject & Keywords</label>
        <input type="text" class="form-input" id="opt-meta-subject" placeholder="Subject" style="margin-bottom: 0.5rem;">
        <input type="text" class="form-input" id="opt-meta-keywords" placeholder="Keywords (comma separated)">
      </div>
    `;
  } else if (tool.id === 'extract-images') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Extract Embedded Images</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Recovers all raster photos, graphics, and figures embedded in the PDF pages into high-resolution PNG files inside a ZIP archive.
        </div>
      </div>
    `;
  } else if (tool.id === 'flip') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Flip Reflection Direction</label>
        <select class="form-input" id="opt-flip-direction">
          <option value="horizontal">Horizontal (Mirror across vertical line)</option>
          <option value="vertical">Vertical (Mirror across horizontal line)</option>
        </select>
      </div>
    `;
  } else if (tool.id === 'header-footer') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Header (Left, Center, Right)</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.35rem;">
          <input type="text" class="form-input" id="opt-hdr-l" placeholder="Left">
          <input type="text" class="form-input" id="opt-hdr-c" placeholder="Center">
          <input type="text" class="form-input" id="opt-hdr-r" placeholder="Right">
        </div>
      </div>
      <div class="options-group">
        <label class="options-label">Footer (Left, Center, Right)</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.35rem;">
          <input type="text" class="form-input" id="opt-ftr-l" placeholder="Left">
          <input type="text" class="form-input" id="opt-ftr-c" placeholder="Page {page} of {total}">
          <input type="text" class="form-input" id="opt-ftr-r" placeholder="Right">
        </div>
      </div>
    `;
  } else if (tool.id === 'n-up') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Pages Per Sheet</label>
        <select class="form-input" id="opt-nup-count">
          <option value="2">2 Pages Per Sheet</option>
          <option value="4" selected>4 Pages Per Sheet (2 × 2 Grid)</option>
          <option value="9">9 Pages Per Sheet (3 × 3 Grid)</option>
          <option value="16">16 Pages Per Sheet (4 × 4 Grid)</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Sheet Margin (pt)</label>
        <input type="number" class="form-input" id="opt-nup-margin" value="15" min="0">
      </div>
    `;
  } else if (tool.id === 'page-numbers') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Page Number Format</label>
        <select class="form-input" id="opt-pgnum-format">
          <option value="Page {n} of {total}">Page {n} of {total}</option>
          <option value="{n}">{n}</option>
          <option value="Page {n}">Page {n}</option>
          <option value="- {n} -">- {n} -</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Position</label>
        <select class="form-input" id="opt-pgnum-pos">
          <option value="bottom-center">Bottom Center</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-center">Top Center</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>
    `;
  } else if (tool.id === 'rename') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">New Document Name</label>
        <input type="text" class="form-input" id="opt-rename-input" placeholder="e.g. Invoice_March_2026.pdf">
        <button type="button" class="btn btn-outline btn-sm" id="btn-suggest-name" style="margin-top: 0.5rem;">
          ✨ Auto-Detect From Document Text
        </button>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('btn-suggest-name')?.addEventListener('click', async () => {
        if (!currentFile) return;
        try {
          const res = await api.post('/api/advanced/suggest-name', { fileId: currentFile.id });
          if (res.success && res.suggestion) {
            document.getElementById('opt-rename-input').value = res.suggestion.suggestedName;
            showToast('Detected title from document text!', 'success');
          }
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    }, 50);
  } else if (tool.id === 'repair') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Repair Corrupted PDF</label>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
          Diagnoses damaged cross-reference tables, repairs broken xref streams, and recovers salvageable page objects into a compliant PDF.
        </div>
      </div>
    `;
  } else if (tool.id === 'protect') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">User Password (Required to Open)</label>
        <input type="password" class="form-input" id="opt-protect-password" placeholder="Enter password to encrypt" autocomplete="new-password">
      </div>
      <div class="options-group">
        <label class="options-label">Owner Password (Optional Permissions)</label>
        <input type="password" class="form-input" id="opt-protect-owner" placeholder="Optional owner password" autocomplete="new-password">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Applies bank-grade AES-256 encryption. The document will not open without entering the correct password.
        </div>
      </div>
    `;
  } else if (tool.id === 'unlock') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Document Password</label>
        <input type="password" class="form-input" id="opt-unlock-password" placeholder="Enter document password" autocomplete="current-password">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
          Enter the valid password to legitimately remove encryption and all restrictions permanently.
        </div>
      </div>
    `;
  } else if (tool.id === 'watermark') {
    container.innerHTML = `
      <div class="options-group">
        <label class="options-label">Watermark Text</label>
        <input type="text" class="form-input" id="opt-wm-text" value="CONFIDENTIAL" placeholder="e.g. CONFIDENTIAL, DRAFT">
      </div>
      <div class="options-group">
        <label class="options-label">Position & Placement</label>
        <select class="form-input" id="opt-wm-position">
          <option value="diagonal" selected>Diagonal (Center 45°)</option>
          <option value="center">Center</option>
          <option value="tile">Tiled (Repeat across full page)</option>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>
      <div class="options-group">
        <label class="options-label">Font Size & Opacity</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Size (pt)</span>
            <input type="number" class="form-input" id="opt-wm-size" value="48" min="10" max="120">
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Opacity (0.1 - 1.0)</span>
            <input type="number" class="form-input" id="opt-wm-opacity" value="0.3" min="0.1" max="1" step="0.05">
          </div>
        </div>
      </div>
      <div class="options-group">
        <label class="options-label">Color & Rotation Angle</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; align-items: center;">
          <input type="color" class="form-input" id="opt-wm-color" value="#888888" style="height: 38px; padding: 2px;">
          <div>
            <input type="number" class="form-input" id="opt-wm-rotation" value="45" placeholder="Angle °">
          </div>
        </div>
      </div>
      <div class="options-group">
        <label class="options-label">Apply to Pages</label>
        <input type="text" class="form-input" id="opt-wm-pages" value="all" placeholder="e.g. all or 1-3, 5">
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
        Configure options for <strong>${escapeHtml(tool.name)}</strong>. Ready to process your document.
      </div>
    `;
  }
}

/**
 * Execute Core PDF Operation via Server API
 */
async function executeToolJob(toolId) {
  if (!currentFile && toolId !== 'merge' && toolId !== 'html-to-pdf') {
    showToast('Please upload a file or enter content first.', 'warning');
    return;
  }

  const jobCard = document.getElementById('job-status-card');
  const statusBadge = document.getElementById('job-status-badge');
  const progressFill = document.getElementById('job-progress-fill');

  // Ensure download button is hidden while processing is in flight
  hideDownloadButton();

  jobCard.style.display = 'flex';
  statusBadge.className = 'status-badge processing';
  statusBadge.textContent = 'Processing';
  progressFill.style.width = '35%';

  showToast(`Running ${toolId}...`, 'info');

  try {
    let endpoint = '';
    let payload = {};

    switch (toolId) {
      case 'merge': {
        const fileIds = mergeQueue.map(f => f.id);
        if (fileIds.length < 2) {
          throw new Error('Please add at least 2 PDF files to merge.');
        }
        endpoint = '/api/pdf/merge';
        payload = { fileIds };
        break;
      }
      case 'extract': {
        const selected = viewer.getSelectedPages();
        const rangeVal = document.getElementById('opt-ranges')?.value;
        const pages = selected.length > 0 ? selected : rangeVal;
        if (!pages || (Array.isArray(pages) && pages.length === 0)) {
          throw new Error('Please select or specify at least one page to extract.');
        }
        endpoint = '/api/pdf/extract';
        payload = { fileId: currentFile.id, pages };
        break;
      }
      case 'split': {
        const ranges = document.getElementById('opt-ranges')?.value;
        if (!ranges) throw new Error('Please enter valid page ranges.');
        endpoint = '/api/pdf/split';
        payload = { fileId: currentFile.id, ranges };
        break;
      }
      case 'delete-pages': {
        const selected = viewer.getSelectedPages();
        const inputVal = document.getElementById('opt-ranges')?.value;
        const pages = selected.length > 0 ? selected : inputVal;
        if (!pages) throw new Error('Please select at least one page to delete.');
        endpoint = '/api/pdf/delete-pages';
        payload = { fileId: currentFile.id, pages };
        break;
      }
      case 'organize': {
        const orderVal = document.getElementById('opt-organize-order')?.value;
        const order = orderVal 
          ? orderVal.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean)
          : viewer.getPageOrder();
        endpoint = '/api/pdf/organize';
        payload = { fileId: currentFile.id, order };
        break;
      }
      case 'rotate': {
        const activeBtn = document.querySelector('.preset-btn.active');
        const angle = activeBtn ? parseInt(activeBtn.dataset.angle, 10) : 90;
        const scope = document.getElementById('opt-rotate-scope')?.value || 'all';
        const pages = scope === 'selected' ? viewer.getSelectedPages() : null;
        endpoint = '/api/pdf/rotate';
        payload = { fileId: currentFile.id, angle, pages };
        break;
      }
      case 'crop': {
        const top = parseFloat(document.getElementById('opt-crop-top')?.value) || 0;
        const bottom = parseFloat(document.getElementById('opt-crop-bottom')?.value) || 0;
        const left = parseFloat(document.getElementById('opt-crop-left')?.value) || 0;
        const right = parseFloat(document.getElementById('opt-crop-right')?.value) || 0;
        endpoint = '/api/pdf/crop';
        payload = { fileId: currentFile.id, margins: { top, bottom, left, right } };
        break;
      }
      case 'resize': {
        const size = document.getElementById('opt-page-size')?.value || 'A4';
        const orientation = document.getElementById('opt-orientation')?.value || 'portrait';
        endpoint = '/api/pdf/resize';
        payload = { fileId: currentFile.id, size, orientation };
        break;
      }
      case 'split-half':
      case 'split-in-half': {
        const orientation = document.getElementById('opt-half-orientation')?.value || 'vertical';
        endpoint = '/api/pdf/split-half';
        payload = { fileId: currentFile.id, orientation };
        break;
      }
      case 'editor':
      case 'fill-sign': {
        if (!editorManager) throw new Error('Editor overlay not initialized.');
        const { visualElements } = editorManager.exportElementsForServer();
        if (visualElements.length === 0) {
          throw new Error('Please add at least one element (text, shape, drawing, or signature) before saving.');
        }
        endpoint = '/api/editor/apply';
        payload = { fileId: currentFile.id, elements: visualElements };
        break;
      }
      case 'forms': {
        if (!editorManager) throw new Error('Editor overlay not initialized.');
        const { formFields } = editorManager.exportElementsForServer();
        if (formFields.length === 0) {
          throw new Error('Please place at least one form field (+ Text Field, + Checkbox) on the document.');
        }
        endpoint = '/api/editor/create-forms';
        payload = { fileId: currentFile.id, formFields };
        break;
      }
      case 'remove-annotations': {
        endpoint = '/api/editor/remove-annotations';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'compress': {
        const level = document.getElementById('opt-compress-level')?.value || 'medium';
        endpoint = '/api/optimize/compress';
        payload = { fileId: currentFile.id, level };
        break;
      }
      case 'ocr': {
        const language = document.getElementById('opt-ocr-lang')?.value || 'eng';
        endpoint = '/api/optimize/ocr';
        payload = { fileId: currentFile.id, language };
        break;
      }
      case 'deskew': {
        const angleDegrees = parseFloat(document.getElementById('opt-deskew-angle')?.value || 0);
        endpoint = '/api/optimize/deskew';
        payload = { fileId: currentFile.id, angleDegrees };
        break;
      }
      case 'grayscale': {
        endpoint = '/api/optimize/grayscale';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'flatten': {
        endpoint = '/api/optimize/flatten';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'pdf-to-word': {
        const pages = document.getElementById('opt-convert-pages')?.value || 'all';
        endpoint = '/api/convert/pdf-to-word';
        payload = { fileId: currentFile.id, pages };
        break;
      }
      case 'pdf-to-excel': {
        const format = document.getElementById('opt-excel-format')?.value || 'xlsx';
        const pages = document.getElementById('opt-convert-pages')?.value || 'all';
        endpoint = '/api/convert/pdf-to-excel';
        payload = { fileId: currentFile.id, pages, format };
        break;
      }
      case 'pdf-to-images': {
        const format = document.getElementById('opt-image-format')?.value || 'png';
        const dpi = parseInt(document.getElementById('opt-image-dpi')?.value, 10) || 150;
        const pages = document.getElementById('opt-convert-pages')?.value || 'all';
        endpoint = '/api/convert/pdf-to-images';
        payload = { fileId: currentFile.id, pages, format, dpi };
        break;
      }
      case 'pdf-to-pptx': {
        const pages = document.getElementById('opt-convert-pages')?.value || 'all';
        endpoint = '/api/convert/pdf-to-pptx';
        payload = { fileId: currentFile.id, pages };
        break;
      }
      case 'pdf-to-text': {
        const pages = document.getElementById('opt-convert-pages')?.value || 'all';
        endpoint = '/api/convert/pdf-to-text';
        payload = { fileId: currentFile.id, pages };
        break;
      }
      case 'docx-to-pdf': {
        endpoint = '/api/convert/docx-to-pdf';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'images-to-pdf': {
        const orientation = document.getElementById('opt-img-orientation')?.value || 'auto';
        const margin = parseInt(document.getElementById('opt-img-margin')?.value, 10) || 20;
        const fileIds = mergeQueue.length > 0 ? mergeQueue.map(f => f.id) : [currentFile.id];
        endpoint = '/api/convert/images-to-pdf';
        payload = { fileIds, orientation, margin };
        break;
      }
      case 'html-to-pdf': {
        const html = document.getElementById('opt-html-content')?.value;
        endpoint = '/api/convert/html-to-pdf';
        payload = { fileId: currentFile?.id, html };
        break;
      }
      case 'alternate-mix': {
        const fileIds = mergeQueue.length > 1 ? mergeQueue.map(f => f.id) : [currentFile.id];
        const reverseSecond = document.getElementById('opt-reverse-second')?.checked || false;
        endpoint = '/api/advanced/alternate-mix';
        payload = { fileIds, reverseSecond };
        break;
      }
      case 'split-bookmarks': {
        endpoint = '/api/advanced/split-bookmarks';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'split-by-size': {
        const maxSizeMB = parseFloat(document.getElementById('opt-max-size-mb')?.value || 2);
        endpoint = '/api/advanced/split-by-size';
        payload = { fileId: currentFile.id, maxSizeMB };
        break;
      }
      case 'split-by-text': {
        const triggerText = document.getElementById('opt-split-trigger')?.value || 'Chapter';
        endpoint = '/api/advanced/split-by-text';
        payload = { fileId: currentFile.id, triggerText };
        break;
      }
      case 'bates': {
        const prefix = document.getElementById('opt-bates-prefix')?.value || 'BATES-';
        const startNumber = parseInt(document.getElementById('opt-bates-start')?.value || 1, 10);
        const digits = parseInt(document.getElementById('opt-bates-digits')?.value || 6, 10);
        const position = document.getElementById('opt-bates-pos')?.value || 'bottom-right';
        endpoint = '/api/advanced/bates';
        payload = { fileId: currentFile.id, prefix, startNumber, digits, position };
        break;
      }
      case 'bookmarks': {
        endpoint = '/api/advanced/bookmarks';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'metadata': {
        const title = document.getElementById('opt-meta-title')?.value;
        const author = document.getElementById('opt-meta-author')?.value;
        const subject = document.getElementById('opt-meta-subject')?.value;
        const keywords = document.getElementById('opt-meta-keywords')?.value;
        endpoint = '/api/advanced/metadata';
        payload = { fileId: currentFile.id, title, author, subject, keywords };
        break;
      }
      case 'extract-images': {
        endpoint = '/api/advanced/extract-images';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'flip': {
        const direction = document.getElementById('opt-flip-direction')?.value || 'horizontal';
        endpoint = '/api/advanced/flip';
        payload = { fileId: currentFile.id, direction };
        break;
      }
      case 'header-footer': {
        const headerLeft = document.getElementById('opt-hdr-l')?.value || '';
        const headerCenter = document.getElementById('opt-hdr-c')?.value || '';
        const headerRight = document.getElementById('opt-hdr-r')?.value || '';
        const footerLeft = document.getElementById('opt-ftr-l')?.value || '';
        const footerCenter = document.getElementById('opt-ftr-c')?.value || '';
        const footerRight = document.getElementById('opt-ftr-r')?.value || '';
        endpoint = '/api/advanced/header-footer';
        payload = { fileId: currentFile.id, headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight };
        break;
      }
      case 'n-up': {
        const n = parseInt(document.getElementById('opt-nup-count')?.value || 4, 10);
        const margin = parseInt(document.getElementById('opt-nup-margin')?.value || 15, 10);
        endpoint = '/api/advanced/n-up';
        payload = { fileId: currentFile.id, n, margin };
        break;
      }
      case 'page-numbers': {
        const format = document.getElementById('opt-pgnum-format')?.value || 'Page {n} of {total}';
        const position = document.getElementById('opt-pgnum-pos')?.value || 'bottom-center';
        endpoint = '/api/advanced/page-numbers';
        payload = { fileId: currentFile.id, format, position };
        break;
      }
      case 'rename': {
        const newName = document.getElementById('opt-rename-input')?.value;
        endpoint = '/api/advanced/rename';
        payload = { fileId: currentFile.id, newName };
        break;
      }
      case 'repair': {
        endpoint = '/api/advanced/repair';
        payload = { fileId: currentFile.id };
        break;
      }
      case 'protect': {
        const password = document.getElementById('opt-protect-password')?.value;
        const ownerPassword = document.getElementById('opt-protect-owner')?.value || undefined;
        if (!password || !password.trim()) {
          throw new Error('Please enter a password to protect the document.');
        }
        endpoint = '/api/security/protect';
        payload = { fileId: currentFile.id, password: password.trim(), ownerPassword: ownerPassword ? ownerPassword.trim() : undefined };
        break;
      }
      case 'unlock': {
        const password = document.getElementById('opt-unlock-password')?.value;
        if (!password || !password.trim()) {
          throw new Error('Please enter the document password to unlock.');
        }
        endpoint = '/api/security/unlock';
        payload = { fileId: currentFile.id, password: password.trim() };
        break;
      }
      case 'watermark': {
        const text = document.getElementById('opt-wm-text')?.value || 'CONFIDENTIAL';
        const position = document.getElementById('opt-wm-position')?.value || 'diagonal';
        const fontSize = parseInt(document.getElementById('opt-wm-size')?.value || 48, 10);
        const opacity = parseFloat(document.getElementById('opt-wm-opacity')?.value || 0.3);
        const rotation = parseInt(document.getElementById('opt-wm-rotation')?.value || 45, 10);
        const color = document.getElementById('opt-wm-color')?.value || '#888888';
        const pages = document.getElementById('opt-wm-pages')?.value || 'all';
        endpoint = '/api/security/watermark';
        payload = { fileId: currentFile.id, text, position, fontSize, opacity, rotation, color, pages };
        break;
      }
      default: {
        throw new Error(`Tool "${toolId}" processing is not yet supported.`);
      }
    }

    progressFill.style.width = '60%';
    const res = await api.post(endpoint, payload);

    let finalResult = null;

    if ((res.async || res.jobId) && res.jobId) {
      // Asynchronous Job Polling (e.g. OCR or heavy conversions)
      statusBadge.textContent = 'Processing (15%)';
      progressFill.style.width = '25%';

      let completed = false;
      const pollStartTime = Date.now();
      const MAX_POLL_MS = 180000; // 3 minutes timeout

      while (!completed) {
        if (Date.now() - pollStartTime > MAX_POLL_MS) {
          throw new Error('Processing timed out. Please try with a smaller document.');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusRes = await api.get(`/api/jobs/${res.jobId}`);

        if (statusRes.success && statusRes.job) {
          const job = statusRes.job;
          const currentPct = job.progress || 30;
          progressFill.style.width = `${currentPct}%`;
          statusBadge.textContent = job.message ? `Processing (${currentPct}%)` : `Processing (${currentPct}%)`;

          if (job.status === 'COMPLETED') {
            completed = true;
            finalResult = job.result;
          } else if (job.status === 'FAILED') {
            throw new Error(job.error || 'Background task failed.');
          }
        }
      }
    } else if (res.success) {
      finalResult = res.result || res.file;
    }

    if (finalResult) {
      progressFill.style.width = '100%';
      statusBadge.className = 'status-badge completed';
      statusBadge.textContent = 'Completed';
      showToast(res.message || 'Operation completed successfully!', 'success');

      // Clear overlay elements and reload the new resulting document/PDF
      if (editorManager) editorManager.clear();
      if (toolId === 'merge') {
        mergeQueue = [finalResult];
        renderMergeQueue();
      }

      loadFileIntoWorkspace(finalResult, { isResult: true });
      showDownloadButton(finalResult);
    } else {
      throw new Error(res.message || 'Processing failed');
    }
  } catch (err) {
    hideDownloadButton();
    console.error('Job error:', err);
    statusBadge.className = 'status-badge failed';
    statusBadge.textContent = 'Failed';
    progressFill.style.width = '100%';
    showToast(err.message || 'Processing error occurred.', 'error');
  }
}

/* ==========================================================================
   Auth Page Logic
   ========================================================================== */
function initAuthPage() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'register') {
    switchTab('register');
  }

  tabLogin?.addEventListener('click', () => switchTab('login'));
  tabRegister?.addEventListener('click', () => switchTab('register'));

  function switchTab(mode) {
    if (mode === 'login') {
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    } else {
      tabRegister?.classList.add('active');
      tabLogin?.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    }
  }

  // Form Submissions
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const { login } = await import('./auth.js');
      const user = await login(email, password);
      if (user) {
        const redirect = urlParams.get('redirect');
        const targetUrl = (redirect && !redirect.startsWith('http') && !redirect.startsWith('//')) ? redirect : 'index.html';
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 600);
      }
    } catch (err) {
      console.error(err);
    }
  });

  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
      const { register } = await import('./auth.js');
      const user = await register(email, password);
      if (user) {
        const redirect = urlParams.get('redirect');
        const targetUrl = (redirect && !redirect.startsWith('http') && !redirect.startsWith('//')) ? redirect : 'index.html';
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 600);
      }
    } catch (err) {
      console.error(err);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
