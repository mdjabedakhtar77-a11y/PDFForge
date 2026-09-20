# PDFForge Backend

High-performance Express.js REST API and PDF processing backend for PDFForge.

## Features
- **43 PDF Processing Tools**: Merge, Split, Extract, Organize, Rotate, Crop, Resize, AcroForms, OCR, Conversions (Office, Images, HTML), AES Encryption, Bates Numbering, Repair, and more.
- **Robust Storage**: Streaming uploads with magic bytes verification, secure temp storage, automated cleanup.
- **Role-Based Access Control**: Dual MySQL / In-Memory database with user isolation and administrative governance.
- **Production Ready**: Configurable CORS, Helmet CSP headers, rate-limiting, and health telemetry.

---

## Standalone Deployment

### 1. Local / VPS (PM2 or Node)
```bash
cd backend
npm install
cp .env.example .env
npm start
```

### 2. Docker Deployment
```bash
# Build image from project root or backend folder
docker build -t pdfforge-backend .
docker run -p 3000:3000 pdfforge-backend
```

### 3. Cloud Platforms (Render / Railway / Fly.io)
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Port**: `3000` (or dynamic `$PORT`)
- Set environment variables as documented in `.env.example`.
