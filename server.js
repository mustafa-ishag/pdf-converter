const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// البحث عن مسار x2t
function findX2t() {
  const paths = [
    '/opt/onlyoffice/documentbuilder/x2t',
    '/opt/onlyoffice/documentbuilder/core/x2t',
    '/usr/bin/x2t'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  // بحث عام
  try {
    const result = execSync('find /opt -name "x2t" -type f 2>/dev/null', { timeout: 5000 }).toString().trim();
    if (result) return result.split('\n')[0];
  } catch(e) {}
  return null;
}

// البحث عن مسار AllFonts.js
function findAllFonts() {
  const paths = [
    '/opt/onlyoffice/documentbuilder/sdkjs/common/AllFonts.js',
    '/opt/onlyoffice/documentbuilder/core/AllFonts.js',
    '/var/lib/onlyoffice/documentserver/sdkjs/common/AllFonts.js'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const result = execSync('find /opt -name "AllFonts.js" -type f 2>/dev/null', { timeout: 5000 }).toString().trim();
    if (result) return result.split('\n')[0];
  } catch(e) {}
  return '';
}

const X2T_PATH = findX2t();
const ALL_FONTS_PATH = findAllFonts();

console.log(`x2t path: ${X2T_PATH}`);
console.log(`AllFonts path: ${ALL_FONTS_PATH}`);

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.includes('office') || file.mimetype.includes('excel') || file.mimetype.includes('word') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported: ${ext}`), false);
    }
  }
});

app.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (!X2T_PATH) return res.status(500).json({ error: 'x2t not found on server' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, 'output.pdf');
  const configPath = path.join(tmpDir, 'convert.xml');

  console.log(`📄 Converting: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    // إنشاء ملف xml config لـ x2t
    let configXml = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_nFormatTo>513</m_nFormatTo>
  <m_bDontSaveAdditional>true</m_bDontSaveAdditional>
  <m_sFontDir>/usr/share/fonts</m_sFontDir>`;

    if (ALL_FONTS_PATH) {
      configXml += `\n  <m_sAllFontsPath>${ALL_FONTS_PATH}</m_sAllFontsPath>`;
    }
    configXml += `\n</TaskQueueDataConvert>`;

    fs.writeFileSync(configPath, configXml);
    console.log('Config:', configXml);

    // تنفيذ x2t
    const result = execSync(`"${X2T_PATH}" "${configPath}" 2>&1`, {
      timeout: 120000,
      env: { ...process.env, HOME: tmpDir }
    });
    console.log('x2t output:', result.toString());

    if (!fs.existsSync(outputPath)) {
      // قائمة الملفات في المجلد المؤقت للتشخيص
      const files = fs.readdirSync(tmpDir);
      console.log('Files in tmpDir:', files);
      throw new Error(`PDF not generated. Files: ${files.join(', ')}`);
    }

    const pdfBuffer = fs.readFileSync(outputPath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
    console.log(`✅ Done: ${baseName}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('stderr:', error.stderr?.toString() || 'none');
    res.status(500).json({ error: 'Failed to convert', details: error.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PDF Converter (OnlyOffice)',
    x2t: X2T_PATH || 'not found',
    allFonts: ALL_FONTS_PATH || 'not found',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ name: 'PDF Converter (OnlyOffice)', version: '3.1.0' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 PDF Converter (OnlyOffice) on port ${PORT}`);
  console.log(`   x2t: ${X2T_PATH}`);
  console.log(`   AllFonts: ${ALL_FONTS_PATH}`);
});
