# PDFForge Backup & Disaster Recovery Guide

This document defines standard procedures for backing up and restoring PDFForge database state and document storage archives.

---

## 1. Storage Components

PDFForge stores two critical categories of state:
1. **Relational Database (`pdfforge`):** User accounts, hashed credentials, file metadata, operations history, audit logs, and background job records.
2. **Document Storage (`uploads/`):** Temporary input files and generated output files located in `uploads/temp/` and `uploads/results/`.

---

## 2. Automated File Storage Backup

PDFForge includes a native backup script that packages all active documents and a machine-readable JSON manifest into a timestamped `.zip` archive in the `backups/` directory.

### Running a Backup

```bash
npm run backup
```

Output:
```text
=== PDFForge System Backup ===

[1/3] Packaging storage directories from /app/uploads...
[2/3] Compressing 42 stored files into archive...
[3/3] Backup archive created successfully!
  Archive: /app/backups/pdfforge_backup_2026-09-16T12-00-00-000Z.zip
  Size:    14.25 MB
  Files:   42
```

---

## 3. Database Backup (`mysqldump`)

### On Docker Compose

Run a full database dump directly from the MySQL container:

```bash
docker compose exec db mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" pdfforge > backups/db_dump_$(date +%Y%m%d_%H%M%S).sql
```

### On Direct Host

```bash
mysqldump -u root -p pdfforge > backups/db_dump_$(date +%Y%m%d_%H%M%S).sql
```

---

## 4. Automated Daily Cron Schedule

Create `/etc/cron.daily/pdfforge-backup` on your production host:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/pdfforge"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# 1. Backup Document Storage
cd /path/to/pdfforge
npm run backup

# Move generated zip to permanent backup directory
mv backups/*.zip "$BACKUP_DIR/"

# 2. Backup MySQL Database
docker compose exec -T db mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" pdfforge | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"

# 3. Retention: Delete backups older than 30 days
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

Make the script executable:
```bash
chmod +x /etc/cron.daily/pdfforge-backup
```

---

## 5. Storage Restoration Procedure

### Restoring the Most Recent Backup

```bash
npm run restore
```

### Restoring a Specific Backup Archive

```bash
node scripts/restore.js backups/pdfforge_backup_2026-09-16T12-00-00-000Z.zip
```

Output:
```text
=== PDFForge System Restore ===

[1/3] Reading archive: backups/pdfforge_backup_2026-09-16T12-00-00-000Z.zip
  Backup created at: 2026-09-16T12:00:00.000Z
  Original files:    42
[2/3] Extracting storage files into /app...
[3/3] Storage files restored successfully!
```

---

## 6. Database Restoration Procedure

### On Docker Compose

```bash
# Restore uncompressed SQL dump
docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" pdfforge < backups/db_dump.sql

# Or restore gzipped SQL dump
gunzip < backups/db_20260916.sql.gz | docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" pdfforge
```

### On Direct Host

```bash
mysql -u root -p pdfforge < backups/db_dump.sql
```
