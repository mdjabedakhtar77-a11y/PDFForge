/**
 * PDFForge - Reusable Drag & Drop Uploader Component
 */
import { api, showToast } from './api.js';

export function setupDropzone(dropzoneEl, options = {}) {
  if (!dropzoneEl) return;

  const accept = options.accept || '.pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.tif,.txt,.html,.htm,application/pdf';
  const fileInput = dropzoneEl.querySelector('input[type="file"]') || createHiddenFileInput(dropzoneEl, accept);
  if (options.accept) {
    fileInput.accept = options.accept;
  }

  const onFileReady = options.onFileReady || defaultFileHandler;
  const onProgress = options.onProgress || defaultProgressHandler;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove('drag-active');
    }, false);
  });

  dropzoneEl.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processSelectedFile(files[0], onFileReady, onProgress, options);
    }
  });

  dropzoneEl.addEventListener('click', (e) => {
    // Avoid re-triggering if the input itself was clicked
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      processSelectedFile(fileInput.files[0], onFileReady, onProgress, options);
    }
  });
}

function createHiddenFileInput(parent, accept = 'application/pdf') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  parent.appendChild(input);
  return input;
}

async function processSelectedFile(file, onFileReady, onProgress, options = {}) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const allowed = options.allowedExtensions || ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.txt', '.html', '.htm'];

  if (!allowed.includes(ext) && file.type !== 'application/pdf') {
    showToast(`Invalid file type "${ext}". Supported: ${allowed.join(', ')}`, 'error');
    return;
  }

  // 50MB check
  if (file.size > 50 * 1024 * 1024) {
    showToast('File size exceeds the 50MB limit.', 'error');
    return;
  }

  showToast(`Uploading ${file.name}...`, 'info');

  try {
    const res = await api.uploadFile(file, onProgress);
    if (res && res.success && res.file) {
      showToast('File uploaded successfully!', 'success');
      onFileReady(res.file);
    }
  } catch (err) {
    console.error('File upload failed:', err);
  }
}

function defaultProgressHandler(percent) {
  const progressFill = document.querySelector('.dropzone-progress-fill');
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }
}

function defaultFileHandler(file) {
  // If we are on landing page, redirect to workspace
  if (!window.location.pathname.includes('workspace')) {
    window.location.href = `workspace.html?fileId=${file.id}&filename=${encodeURIComponent(file.originalName)}`;
  }
}
