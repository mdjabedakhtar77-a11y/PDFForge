/**
 * PDFForge - API Client & Centralized Toast Manager
 */

export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.__API_BASE__) return window.__API_BASE__.replace(/\/$/, '');
    const stored = localStorage.getItem('pdfforge_api_base');
    if (stored) return stored.replace(/\/$/, '');
  }
  return '';
}

// Toast Notification System
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Token Storage
export function getToken() {
  return localStorage.getItem('pdfforge_token') || localStorage.getItem('token');
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem('pdfforge_token', token);
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('pdfforge_token');
  localStorage.removeItem('pdfforge_user');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser() {
  try {
    const userStr = localStorage.getItem('pdfforge_user') || localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  if (!user) return;
  const str = typeof user === 'string' ? user : JSON.stringify(user);
  localStorage.setItem('pdfforge_user', str);
  localStorage.setItem('user', str);
}

// Request Helper
async function request(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  options.headers = headers;

  try {
    const apiBase = getApiBase();
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/login')) {
        removeToken();
        // Optional redirect or UI update
      }
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    showToast(err.message || 'Network error occurred', 'error');
    throw err;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const apiBase = getApiBase();
      xhr.open('POST', `${apiBase}/api/files/upload`);

      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            showToast(data.message || 'Upload failed', 'error');
            reject(new Error(data.message || 'Upload failed'));
          }
        } catch (e) {
          reject(e);
        }
      };

      xhr.onerror = () => {
        showToast('Network error during file upload', 'error');
        reject(new Error('Network error'));
      };

      xhr.send(formData);
    });
  }
};
