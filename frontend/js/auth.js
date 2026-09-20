/**
 * PDFForge - Authentication Management & Header Sync
 */
import { api, getToken, setToken, removeToken, getStoredUser, setStoredUser, showToast } from './api.js';

export async function login(email, password) {
  const res = await api.post('/api/auth/login', { email, password });
  if (res.success && res.token) {
    setToken(res.token);
    setStoredUser(res.user);
    showToast('Logged in successfully!', 'success');
    return res.user;
  }
  return null;
}

export async function register(email, password) {
  const res = await api.post('/api/auth/register', { email, password });
  if (res.success && res.token) {
    setToken(res.token);
    setStoredUser(res.user);
    showToast('Account created successfully!', 'success');
    return res.user;
  }
  return null;
}

export function logout() {
  removeToken();
  showToast('Signed out.', 'info');
  updateNavAuthUI();
  if (window.location.pathname.includes('auth')) {
    window.location.reload();
  }
}

/**
 * Updates the navigation bar based on auth state
 */
export function updateNavAuthUI() {
  const navContainer = document.getElementById('nav-auth-section');
  if (!navContainer) return;

  const user = getStoredUser();
  const token = getToken();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeIcon = currentTheme === 'light' ? '☀️' : '🌙';
  const themeBtnHtml = `
    <button type="button" class="btn btn-ghost btn-sm btn-theme-toggle-btn" id="btn-theme-toggle" title="Toggle Theme" style="padding: 0.35rem 0.55rem; font-size: 1rem; margin-right: 0.25rem;">
      ${themeIcon}
    </button>
  `;

  if (token && user) {
    const initial = (user.email || 'U').charAt(0).toUpperCase();
    const isAdmin = user.role === 'ADMIN';
    navContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        ${themeBtnHtml}
        <div class="user-pill">
          ${isAdmin ? `<a href="admin.html" style="font-size: 0.75rem; color: var(--danger); font-weight: 700; text-decoration: none; margin-right: 0.25rem;" title="Admin Control Center">👑 ADMIN</a>` : ''}
          <a href="dashboard.html" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit;" title="Go to Dashboard">
            <span class="user-avatar">${initial}</span>
            <span>${escapeHtml(user.email.split('@')[0])}</span>
          </a>
          <button id="nav-logout-btn" class="btn btn-ghost btn-sm" title="Sign Out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
      logout();
    });
  } else {
    navContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        ${themeBtnHtml}
        <a href="auth.html" class="btn btn-outline btn-sm">Sign In</a>
        <a href="auth.html?mode=register" class="btn btn-primary btn-sm">Get Started</a>
      </div>
    `;
  }

  bindThemeToggles();
}

/**
 * Universal Theme System
 */
export function initTheme() {
  const saved = localStorage.getItem('theme') || 'system';
  applyTheme(saved);
}

export function applyTheme(theme) {
  let effective = theme;
  if (theme === 'system') {
    effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', effective);
  localStorage.setItem('theme', theme);

  document.querySelectorAll('.btn-theme-toggle-btn, #btn-theme-toggle').forEach(btn => {
    btn.textContent = effective === 'light' ? '☀️' : '🌙';
    btn.title = `Switch to ${effective === 'light' ? 'dark' : 'light'} theme`;
  });
}

function bindThemeToggles() {
  document.querySelectorAll('.btn-theme-toggle-btn, #btn-theme-toggle').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'light' ? 'dark' : 'light';
      applyTheme(next);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Auto-run on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateNavAuthUI();
  bindThemeToggles();
});

