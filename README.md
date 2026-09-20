# PDFForge — Production-Grade PDF Processing Suite

[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)]()

**PDFForge** is a modular, high-performance web application for viewing, managing, converting, and processing PDF documents. Built with pure modern vanilla JavaScript on the frontend and a resilient Node.js backend, it offers over 30 document operations with zero third-party UI framework bloat and zero external binary dependencies.

---

## 🌟 Key Features Across All 10 Phases

### 1. Foundation & Workspace (Phase 1)
- **Interactive PDF Workspace:** Multi-page thumbnail navigator, high-fidelity canvas viewport with zoom, rotation, and pagination powered by Mozilla's `PDF.js`.
- **Resilient Database Layer:** Seamless connection to MySQL with automatic in-memory fallback for local development.
- **Authentication & Sessions:** Secure JWT authentication with bcrypt password hashing and guest session support.

### 2. Core PDF Operations (Phase 2)
- **Merge & Combine:** Concatenate multiple PDFs into a single document.
- **Extract & Split:** Extract specific pages/ranges or split documents into multiple outputs.
- **Delete & Organize:** Remove pages or visually reorder them with drag-and-drop intuition.
- **Rotate, Crop & Resize:** Vector-level 90°/180°/270° rotation, bounding box cropping, and scaling to standard page sizes (A4, Letter, Legal).
- **Split in Half:** Slice two-up booklet scans into individual single pages.

### 3. PDF Editor, Forms & Signatures (Phase 3)
- **Interactive Annotations:** Insert custom text, rectangles, circles, lines, and highlight overlays.
- **Freehand Signatures:** Draw, preview, and embed digital vector signatures onto any page.
- **AcroForms Engine:** Detect interactive form fields, programmatically fill form data, and flatten forms into non-editable vector documents.
- **Clean Document:** Strip existing annotations while preserving original document content.

### 4. Optimization, Grayscale & OCR (Phase 4)
- **PDF Compression:** Reduce file sizes with customizable compression presets (`extreme`, `recommended`, `low`).
- **Grayscale Conversion:** Transform color pages into uniform monochrome/grayscale vectors.
- **Deskew Correction:** Automatically detect and correct tilted scan angles.
- **OCR Text Extraction:** Optical Character Recognition powered by Tesseract engine running asynchronously through an in-memory Job Queue.

### 5. Document Conversion Suite (Phase 5)
- **PDF to Office:** Convert PDFs to Microsoft Word (`.docx`), Excel spreadsheets (`.xlsx`), and PowerPoint presentations (`.pptx`).
- **PDF to Images & Text:** Export pages as high-resolution PNG/JPG images packaged in ZIP archives or extract raw text (`.txt`).
- **Office to PDF:** Convert Word documents (`.docx`), images (`.png`, `.jpg`, `.tiff`), and HTML documents directly into standardized PDFs.

### 6. Security, Encryption & Watermark (Phase 6)
- **AES-256 Protection:** Encrypt PDF documents with strong AES-256 user and owner passwords.
- **Legitimate Unlock:** Decrypt password-protected files safely without cracking or brute-force attempts.
- **Dynamic Watermarking:** Stamp custom text or image watermarks with precise controls for opacity, rotation, font size, colors, and positioning (diagonal, center, tiled, corners).

### 7. Advanced PDF Tools (Phase 7)
- **Alternate & Mix:** Interlace pages from multiple PDFs with reverse collation support.
- **Split Variations:** Split documents by outline bookmarks, target file sizes, or keyword text triggers.
- **Bates Numbering:** Legal and medical document indexing with customizable prefixes, starting numbers, and digit padding.
- **Bookmarks & Metadata:** Interactive Table of Contents management and document metadata editing (Title, Author, Subject, Keywords).
- **N-Up Imposition & Flip:** Impose 2, 4, 9, or 16 pages per sheet and mirror pages horizontally or vertically.
- **Page Numbers & Header/Footer:** Stamp dynamic headers, footers, and page numbers with token substitution (`{page}`, `{total}`).
- **Intelligent Rename & Repair:** Derive clean filenames from document text and rebuild corrupted PDF cross-reference tables.

### 8. User Dashboard & History (Phase 8)
- **User Summary:** Real-time metrics on total processed files, operations completed, and storage quota meter.
- **Paginated History:** Filterable operations history with direct re-download links.
- **Customization:** Theme switcher (Light, Dark, System) and pinned favorite tools.

### 9. Admin Panel, RBAC & Analytics (Phase 9)
- **RBAC Governance:** Role-Based Access Control protecting administrative functions (`USER` vs `ADMIN`).
- **System Telemetry:** Real-time process memory usage, Node runtime stats, and database latency.
- **User & Job Management:** Manage user statuses (enable/disable), roles, and inspect background OCR jobs with failure diagnostics.
- **Audit Logs:** Security event tracking with strict recursive redaction of sensitive credentials.

### 10. Security Hardening, Testing & Deployment (Phase 10)
- **Path Traversal Protection:** Canonical containment checks (`isSafePath`) on all file paths.
- **Rate Limiting:** Sliding-window rate limiters protecting authentication and API endpoints.
- **Secure HTTP Headers:** Helmet middleware configured with tailored Content Security Policies.
- **Containerization:** Production multi-stage `Dockerfile` and `docker-compose.yml` with isolated MySQL service.
- **Automated Backup & Restore:** Complete scripts for storage and database recovery.

---

## 🏗️ Architecture

- **Frontend:** Pure HTML5, modern vanilla JavaScript (ES6+ Modules), and responsive custom CSS3 (CSS Custom Properties, Glassmorphism). Zero frontend frameworks (no React, Vue, or Angular).
- **Backend:** Node.js with Express.js.
- **PDF Engine:** Pure JavaScript processing via `pdf-lib`, Mozilla `pdfjs-dist`, `@pdfsmaller/pdf-encrypt`, `@pdfsmaller/pdf-decrypt`, `docx`, `xlsx`, `pptxgenjs`, and `@napi-rs/canvas`. No LibreOffice or Poppler binaries required!
- **Database:** MySQL 8.0 connection pool via `mysql2/promise` with automatic table creation and in-memory fallback.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20.x LTS or higher
- npm 10.x or higher

### 2. Installation
```bash
git clone <repository_url> pdfforge
cd pdfforge
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Default settings work out of the box with automatic in-memory database fallback if MySQL is not running locally).*

### 4. Run Development Server
```bash
npm start
```
Open your browser:
- **Landing & Tool Hub:** [http://localhost:3000/](http://localhost:3000/)
- **PDF Workspace:** [http://localhost:3000/workspace.html](http://localhost:3000/workspace.html)
- **Authentication Portal:** [http://localhost:3000/auth.html](http://localhost:3000/auth.html)
- **User Dashboard:** [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
- **Admin Panel:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🐳 Docker Deployment

To launch the complete production stack (PDFForge App + MySQL 8.0):

```bash
# Build and start services in the background
docker compose up -d --build

# Inspect logs
docker compose logs -f

# Check health
curl http://localhost:3000/api/health
```

---

## 🧪 Testing Suite

PDFForge includes comprehensive automated regression suites covering every phase:

```bash
# Run the Master Test Suite (all phases 2 through 10)
npm test

# Run Phase 10 security & hardening tests only
npm run test:phase10
```

---

## 💾 Backup & Disaster Recovery

```bash
# Create timestamped storage archive with manifest
npm run backup

# Restore storage files from latest backup
npm run restore
```

For complete backup policies and database dump instructions, see [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md).

---

## 📖 Documentation Directory

- [REST API Reference](docs/API.md): Complete specifications for all API endpoints.
- [Production Deployment Guide](docs/DEPLOYMENT.md): Nginx reverse proxy, SSL setup, PM2, and Docker instructions.
- [Backup & Disaster Recovery](docs/BACKUP_RESTORE.md): Database dumps, uploads retention, and restoration steps.

---

## ⚖️ Honest Limitations

- **OCR Complexity:** OCR accuracy is dependent on source scan quality and resolution. Extremely skewed, low-contrast, or handwritten text may require preprocessing.
- **Conversion Fidelity:** Conversions from PDF to DOCX/PPTX use clean native vector and layout approximations; complex multi-column brochure formatting or non-standard CID fonts may experience minor font substitutions.
- **Password Decryption:** PDFForge does not crack or brute-force passwords; legitimate decryption requires the valid document password.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
