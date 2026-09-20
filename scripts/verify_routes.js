const http = require('http');

const routes = [
  // Static Frontend Pages
  { path: '/', expected: 200, name: 'Home Landing & Tools Hub' },
  { path: '/workspace.html', expected: 200, name: 'PDF Workspace' },
  { path: '/auth.html', expected: 200, name: 'Authentication Portal' },
  { path: '/dashboard.html', expected: 200, name: 'User Dashboard' },
  { path: '/admin.html', expected: 200, name: 'Admin Governance Panel' },

  // Static Assets (CSS & JS)
  { path: '/css/main.css', expected: 200, name: 'Global Design Tokens & CSS' },
  { path: '/css/workspace.css', expected: 200, name: 'Workspace 3-Column Stylesheet' },
  { path: '/js/api.js', expected: 200, name: 'API Client JS Module' },
  { path: '/js/auth.js', expected: 200, name: 'Auth Controller JS Module' },
  { path: '/js/upload.js', expected: 200, name: 'Upload Drag & Drop JS Module' },
  { path: '/js/pdfViewer.js', expected: 200, name: 'PDF.js Viewer Controller' },
  { path: '/js/main.js', expected: 200, name: 'App Router & UI Coordinator' },

  // API Endpoints
  { path: '/api/health', expected: 200, name: 'System Health & Telemetry' },
  { path: '/api/tools', expected: 200, name: 'Full Tool Registry' },
  { path: '/api/tools?category=Core', expected: 200, name: 'Core Category Tools Filter' },
  { path: '/api/tools/merge', expected: 200, name: 'Merge Tool Spec Retrieval' },
  { path: '/api/tools/watermark', expected: 200, name: 'Watermark Tool Spec Retrieval' },
  { path: '/api/dashboard/summary', expected: 401, name: 'Dashboard Protected Guard' },
  { path: '/api/admin/analytics', expected: 401, name: 'Admin RBAC Guard' },
  { path: '/api/files/nonexistent-id/view', expected: 404, name: 'Missing File 404 Guard' }
];

async function verifyRoutes() {
  console.log('===================================================================================');
  console.log('             🌐 PDFForge Frontend & API Routes Live Verification                  ');
  console.log('===================================================================================\n');
  console.log(
    'Route Path'.padEnd(32) +
    'Description'.padEnd(32) +
    'Expected'.padEnd(10) +
    'Actual'.padEnd(8) +
    'Status'
  );
  console.log('-'.repeat(87));

  let passed = 0;

  for (const r of routes) {
    await new Promise((resolve) => {
      const req = http.get('http://localhost:3000' + r.path, (res) => {
        let bodyLength = 0;
        res.on('data', chunk => (bodyLength += chunk.length));
        res.on('end', () => {
          const ok = res.statusCode === r.expected;
          if (ok) passed++;
          const statusText = ok ? '✓ PASS' : '✗ FAIL';
          console.log(
            r.path.padEnd(32) +
            r.name.substring(0, 30).padEnd(32) +
            String(r.expected).padEnd(10) +
            String(res.statusCode).padEnd(8) +
            statusText
          );
          resolve();
        });
      });
      req.on('error', (err) => {
        console.log(
          r.path.padEnd(32) +
          r.name.substring(0, 30).padEnd(32) +
          String(r.expected).padEnd(10) +
          'ERR'.padEnd(8) +
          '✗ FAIL (' + err.message + ')'
        );
        resolve();
      });
    });
  }

  console.log('-'.repeat(87));
  console.log(`Summary: ${passed}/${routes.length} routes verified successfully (${Math.round((passed / routes.length) * 100)}%)\n`);

  if (passed === routes.length) {
    console.log('🎉 All frontend pages, stylesheets, client modules, and API guards are fully functional!\n');
    process.exit(0);
  } else {
    console.error('❌ Some routes did not respond with expected status.\n');
    process.exit(1);
  }
}

verifyRoutes();
