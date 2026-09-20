/**
 * PDFForge Automated Restore Script
 * Restores documents and storage files from a backup archive.
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');

async function restoreBackup(targetArchiveName = null) {
  console.log('=== PDFForge System Restore ===\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('No backups directory found. Nothing to restore.');
    return;
  }

  let archiveFile = targetArchiveName;
  if (!archiveFile) {
    // Find latest backup in backups directory
    const archives = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.zip'));
    if (archives.length === 0) {
      console.error('No zip backup archives found in backups directory.');
      return;
    }
    archives.sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs);
    archiveFile = archives[0];
  }

  const archivePath = path.isAbsolute(archiveFile) ? archiveFile : path.join(BACKUP_DIR, archiveFile);
  if (!fs.existsSync(archivePath)) {
    console.error(`Specified backup archive "${archivePath}" does not exist.`);
    return;
  }

  console.log(`[1/3] Reading archive: ${archivePath}`);
  const zip = new AdmZip(archivePath);

  // Check manifest
  const manifestEntry = zip.getEntry('manifest.json');
  if (manifestEntry) {
    try {
      const manifest = JSON.parse(zip.readAsText(manifestEntry));
      console.log(`  Backup created at: ${manifest.backupCreatedAt}`);
      console.log(`  Original files:    ${manifest.fileCount}`);
    } catch (e) {
      console.warn('  Warning: Could not parse manifest metadata.');
    }
  }

  console.log(`[2/3] Extracting storage files into ${ROOT_DIR}...`);
  // Ensure target upload directories exist
  if (!fs.existsSync(path.join(UPLOADS_DIR, 'temp'))) {
    fs.mkdirSync(path.join(UPLOADS_DIR, 'temp'), { recursive: true });
  }
  if (!fs.existsSync(path.join(UPLOADS_DIR, 'results'))) {
    fs.mkdirSync(path.join(UPLOADS_DIR, 'results'), { recursive: true });
  }

  zip.extractAllTo(ROOT_DIR, true);

  console.log(`[3/3] Storage files restored successfully!\n`);
}

if (require.main === module) {
  const target = process.argv[2] || null;
  restoreBackup(target).catch(err => {
    console.error('Restore failed:', err);
    process.exit(1);
  });
}

module.exports = { restoreBackup };
