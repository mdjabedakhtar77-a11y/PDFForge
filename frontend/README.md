# PDFForge Frontend

Clean, modern, vanilla JavaScript web client for PDFForge.

## Features
- Complete UI for all 43 PDF tools
- Interactive PDF canvas viewer with real-time multi-page preview
- Visual annotation & signature overlay editor
- Document management dashboard, quota gauge & activity history
- Admin governance portal with user management & system telemetry
- Responsive glassmorphic dark-mode design

---

## Standalone Deployment

The frontend consists of vanilla HTML, CSS, and modern ES modules. It can be served from any static file host or CDN.

### 1. Connecting to a Remote Backend
If your backend is hosted on a separate URL (e.g. `https://api.pdfforge.example.com`), configure it in either of two ways:

#### Option A: In JavaScript / Global Variable (Recommended for CDN)
Add this before loading other scripts in your HTML, or in `index.html`:
```html
<script>
  window.__API_BASE__ = 'https://api.pdfforge.example.com';
</script>
```

#### Option B: In the Browser Console / LocalStorage
```javascript
localStorage.setItem('pdfforge_api_base', 'https://api.pdfforge.example.com');
```

---

### 2. Deploying to Hosting Providers

- **Vercel**:
  - Root directory: `frontend`
  - Output directory: `.`
  - No build command required.
- **Netlify**:
  - Base directory: `frontend`
  - Publish directory: `frontend`
- **Cloudflare Pages**:
  - Framework: `None`
  - Output directory: `frontend`
- **Nginx**:
  - Copy `frontend/*` to `/var/www/html/`
  - Ensure CORS headers are enabled on the backend if hosted on another domain.
