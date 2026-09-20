# PDFForge REST API Reference

PDFForge provides a comprehensive, production-grade REST API for document processing, conversion, optimization, security, workspace management, and administrative operations.

---

## Authentication & Headers

Most endpoints support both authenticated user sessions and guest sessions.
- When authenticated, include the JWT in the `Authorization` header:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- File streaming/download links also accept the token via query parameter:
  ```http
  GET /api/files/:id/download?token=<jwt_token>
  ```
- **Standard Rate Limit Headers**:
  - `X-RateLimit-Limit`: Maximum allowed requests per window.
  - `X-RateLimit-Remaining`: Remaining request allowance.
  - `X-RateLimit-Reset`: Seconds until window resets.

---

## 1. System & Health

### `GET /api/health`
Returns system diagnostics, uptime, memory utilization, and database connectivity.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "app": "PDFForge",
    "version": "1.0.0",
    "environment": "production",
    "uptimeSeconds": 1420,
    "timestamp": "2026-09-16T12:00:00.000Z",
    "database": {
      "status": "connected",
      "latencyMs": 2
    },
    "system": {
      "memory": {
        "rssMb": "64.20",
        "heapUsedMb": "32.10",
        "heapTotalMb": "48.50"
      },
      "nodeVersion": "v20.18.0",
      "platform": "linux"
    }
  }
  ```

---

## 2. Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Fetch active user profile | Yes (`Bearer`) |
| `PUT` | `/api/auth/password` | Change user password | Yes (`Bearer`) |

---

## 3. File Management (`/api/files`)

| Method | Endpoint | Description | Ownership Enforced |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/files/upload` | Upload PDF, DOCX, Image, or HTML (`multipart/form-data`) | No (Guest/User) |
| `GET` | `/api/files/:id` | Fetch file metadata & download URLs | Yes |
| `GET` | `/api/files/:id/view` | Stream PDF inline for browser viewing | Yes |
| `GET` | `/api/files/:id/download` | Download file as attachment | Yes |
| `DELETE` | `/api/files/:id` | Delete file from storage and database | Yes (Owner/Admin) |

---

## 4. Core PDF Operations (`/api/pdf`)

| Method | Endpoint | Payload Parameters | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/pdf/merge` | `fileIds: string[]` | Merge multiple PDFs sequentially |
| `POST` | `/api/pdf/extract` | `fileId, pages: string` (e.g. "1,3-5") | Extract page subset |
| `POST` | `/api/pdf/split` | `fileId, ranges: string[]` | Split into multiple documents |
| `POST` | `/api/pdf/delete` | `fileId, pages: string` | Remove specific pages |
| `POST` | `/api/pdf/organize` | `fileId, order: number[]` | Reorder pages |
| `POST` | `/api/pdf/rotate` | `fileId, angle: number, pages: string` | Rotate pages (90°, 180°, 270°) |
| `POST` | `/api/pdf/crop` | `fileId, x, y, width, height, pages` | Crop page bounding boxes |
| `POST` | `/api/pdf/resize` | `fileId, standardSize: "A4"\|"Letter"\|"Legal"` | Scale pages to standard dimensions |
| `POST` | `/api/pdf/split-half` | `fileId, direction: "horizontal"\|"vertical"` | Slice 2-up scans into separate pages |

---

## 5. PDF Editor, Forms & Annotations (`/api/editor`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/editor/save` | Apply text, shapes, highlight annotations, freehand signatures |
| `GET` | `/api/editor/forms/:id` | Detect and export AcroForm field definitions and values |
| `POST` | `/api/editor/forms/:id/fill` | Fill AcroForm interactive form fields programmatically |
| `POST` | `/api/editor/flatten` | Bake all annotations and forms into static vector content |
| `POST` | `/api/editor/remove-annotations` | Strip all annotations while retaining document text |

---

## 6. Compression, Grayscale & OCR (`/api/optimize`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/optimize/compress` | Compress PDF with selectable presets (`extreme`, `recommended`, `low`) |
| `POST` | `/api/optimize/grayscale` | Convert color PDF pages to monochrome/grayscale vectors |
| `POST` | `/api/optimize/deskew` | Auto-detect and correct document rotation skew |
| `POST` | `/api/optimize/ocr` | Asynchronous OCR text layer extraction via Tesseract engine |
| `GET` | `/api/jobs/:jobId` | Poll background job status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) |

---

## 7. Document Conversion Suite (`/api/convert`)

| Method | Endpoint | Input Format | Output Format |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/convert/pdf-to-docx` | PDF | Word Document (`.docx`) |
| `POST` | `/api/convert/pdf-to-xlsx` | PDF | Excel Spreadsheet (`.xlsx`) |
| `POST` | `/api/convert/pdf-to-pptx` | PDF | PowerPoint Presentation (`.pptx`) |
| `POST` | `/api/convert/pdf-to-txt` | PDF | Plain Text (`.txt`) |
| `POST` | `/api/convert/pdf-to-images` | PDF | High-res PNG/JPG images in ZIP archive |
| `POST` | `/api/convert/docx-to-pdf` | DOCX | PDF |
| `POST` | `/api/convert/images-to-pdf` | PNG/JPG/TIFF | PDF |
| `POST` | `/api/convert/html-to-pdf` | HTML content / file | PDF |

---

## 8. Security & Watermarking (`/api/security`)

| Method | Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/security/status/:id` | `id: fileId` | Check whether PDF is password-encrypted |
| `POST` | `/api/security/protect` | `fileId, password, ownerPassword` | Encrypt document using strong AES-256 |
| `POST` | `/api/security/unlock` | `fileId, password` | Legitimately decrypt PDF with valid password |
| `POST` | `/api/security/watermark` | `fileId, text, fontSize, color, opacity, rotation, position, pages` | Apply customizable text or image watermark |

---

## 9. Advanced PDF Tools (`/api/advanced`)

- `POST /api/advanced/alternate-mix`: Collate pages alternately from multiple PDFs.
- `POST /api/advanced/split-bookmarks`: Split PDF chapters based on document outline.
- `POST /api/advanced/split-size`: Divide PDF into target chunks matching max file size.
- `POST /api/advanced/split-text`: Split PDF where keyword patterns match.
- `POST /api/advanced/bates`: Apply legal Bates numbering (prefix, starting number, digits).
- `POST /api/advanced/bookmarks`: Insert interactive Table of Contents outline bookmarks.
- `POST /api/advanced/metadata`: Inspect and update Title, Author, Subject, Keywords.
- `POST /api/advanced/extract-images`: Extract all embedded raster graphics into ZIP archive.
- `POST /api/advanced/flip`: Mirror pages horizontally or vertically.
- `POST /api/advanced/header-footer`: Stamp headers and footers with page count dynamic tokens.
- `POST /api/advanced/n-up`: Impose 2, 4, 9, or 16 pages onto single sheets.
- `POST /api/advanced/page-numbers`: Insert customizable page numbers.
- `POST /api/advanced/rename`: Derives clean standardized filenames from detected text.
- `POST /api/advanced/repair`: Diagnoses and reconstructs corrupted PDF cross-reference tables.

---

## 10. User Dashboard & History (`/api/dashboard`)

- `GET /api/dashboard/summary`: Profile, storage quota meter, operations count.
- `GET /api/dashboard/history`: Paginated history of operations.
- `GET /api/dashboard/files`: List user's active stored files.
- `POST /api/dashboard/favorites/toggle`: Pin favorite tools for quick launch.
- `PATCH /api/dashboard/settings`: Update UI theme (`light`, `dark`, `system`).

---

## 11. Admin Panel & Governance (`/api/admin`)
*Strictly protected by `requireAdmin` role check.*

- `GET /api/admin/analytics`: Total users, files, processing volume, active jobs.
- `GET /api/admin/users`: User directory governance with pagination and search.
- `PATCH /api/admin/users/:id/status`: Enable or disable user account.
- `PATCH /api/admin/users/:id/role`: Promote or demote user (`USER` vs `ADMIN`).
- `GET /api/admin/jobs`: Background jobs explorer with filter by status.
- `GET /api/admin/audit-logs`: Sanitized security audit log explorer.
- `GET /api/admin/system`: Real-time system telemetry and process statistics.
