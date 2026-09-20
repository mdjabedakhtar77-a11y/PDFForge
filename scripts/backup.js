/**
 * PDFForge Automated Backup Script
 * Creates timestamped archive of document uploads and metadata manifest.
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');

async function createBackup() {
  console.log('=== PDFForge System Backup ===\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pdfforge_backup_${timestamp}.zip`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  console.log(`[1/3] Packaging storage directories from ${UPLOADS_DIR}...`);
  const zip = new AdmZip();

  let fileCount = 0;
  function addDirectory(dir, zipPrefix) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addDirectory(fullPath, `${zipPrefix}${entry}/`);
      } else {
        const fileContent = fs.readFileSync(fullPath);
        zip.addFile(`${zipPrefix}${entry}`, fileContent);
        fileCount++;
      }
    }
  }

  addDirectory(path.join(UPLOADS_DIR, 'temp'), 'uploads/temp/');
  addDirectory(path.join(UPLOADS_DIR, 'results'), 'uploads/results/');

  // Write manifest inside the zip
  const manifest = {
    app: 'PDFForge',
    version: '1.0.0',
    backupCreatedAt: new Date().toISOString(),
    fileCount,
    nodeVersion: process.version,
    platform: process.platform
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  console.log(`[2/3] Compressing ${fileCount} stored files into archive...`);
  zip.writeZip(backupFilePath);

  const stats = fs.statSync(backupFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`[3/3] Backup archive created successfully!`);
  console.log(`  Archive: ${backupFilePath}`);
  console.log(`  Size:    ${sizeMb} MB (${stats.size} bytes)`);
  console.log(`  Files:   ${fileCount}\n`);
}

if (require.main === module) {
  createBackup().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
}

module.exports = { createBackup };
