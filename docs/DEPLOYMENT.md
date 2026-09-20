# PDFForge Production Deployment Guide

This guide outlines production deployment best practices for PDFForge using **Docker Compose** or **Direct Host (PM2 + systemd)** behind an **Nginx Reverse Proxy** with SSL.

---

## 1. Prerequisites

- **Host OS:** Linux (Ubuntu 22.04 LTS / Debian 12 recommended) or Windows Server
- **Docker Engine:** Version 24.0+ and Docker Compose v2.20+
- **Node.js (for direct host):** Node.js 20.x LTS or higher
- **RAM:** Minimum 2 GB (4 GB recommended for OCR and high-volume image operations)
- **Disk:** Minimum 20 GB SSD

---

## 2. Option A: Docker Compose Deployment (Recommended)

Docker Compose bundles PDFForge with a hardened MySQL 8.0 container, network isolation, persistent storage volumes, and automatic restart policies.

### Step 1: Clone and Configure Environment

```bash
git clone <repository_url> pdfforge
cd pdfforge
cp .env.example .env
```

Edit `.env` to configure production credentials:
```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=db
DB_PORT=3306
DB_USER=pdfforge_user
DB_PASSWORD=YOUR_STRONG_RANDOM_PASSWORD_HERE
DB_NAME=pdfforge
MYSQL_ROOT_PASSWORD=YOUR_STRONG_ROOT_PASSWORD_HERE

# Security & Secrets
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET_KEY_64_CHARACTERS
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com

# Storage Limits
MAX_FILE_SIZE_MB=50
TEMP_FILE_EXPIRY_HOURS=24
```

### Step 2: Build and Start Containers

```bash
docker compose build --no-cache
docker compose up -d
```

### Step 3: Verify Status & Health

```bash
# Check running containers
docker compose ps

# Inspect application logs
docker compose logs -f app

# Test health check endpoint
curl -f http://localhost:3000/api/health
```

---

## 3. Option B: Direct Host Deployment with PM2

If running directly on a Linux VPS without Docker:

### Step 1: Install Dependencies & Build

```bash
npm ci --omit=dev
```

### Step 2: Install and Configure PM2

```bash
npm install -g pm2
pm2 start backend/app.js --name "pdfforge" -i max
pm2 save
pm2 startup
```

---

## 4. Nginx Reverse Proxy with Let's Encrypt SSL

Place PDFForge behind Nginx for SSL termination, request buffering, and static asset acceleration.

### `/etc/nginx/sites-available/pdfforge.conf`

```nginx
server {
    listen 80;
    server_name pdfforge.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pdfforge.yourdomain.com;

    # SSL Certificates (managed via Certbot)
    ssl_certificate /etc/letsencrypt/live/pdfforge.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pdfforge.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum upload size matching MAX_FILE_SIZE_MB
    client_max_body_size 55M;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for heavy document conversions
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

Enable site and acquire SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/pdfforge.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d pdfforge.yourdomain.com
sudo systemctl reload nginx
```

---

## 5. Security & Operational Hardening Checklist

- [x] **Zero Plaintext Secrets:** Ensure `.env` has permissions `600` (`chmod 600 .env`) and is never committed to Git.
- [x] **Rate Limiting:** Global rate limit (300 req/min) and auth rate limit (30 req/15 min) active by default.
- [x] **Container Non-Root User:** The Docker image runs under the restricted `pdfforge` user (UID 1001).
- [x] **Path Traversal Guards:** File paths are verified via `isSafePath` before streaming or downloading.
- [x] **Automated Temp File Expiry:** Expired temporary files are purged every 6 hours automatically.
- [x] **Database Isolation:** MySQL port 3306 is bound exclusively to the private Docker bridge network (`pdfforge_net`) and not exposed publicly.
- [x] **Monitoring:** Poll `GET /api/health` with Prometheus, Uptime Kuma, or Datadog.
