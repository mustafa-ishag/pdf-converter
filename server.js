const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// مسار أداة x2t من OnlyOffice
const X2T_PATH = '/opt/onlyoffice/documentbuilder/x2t';

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
      cb(new Error(`Unsupported file type: ${ext}`), false);
    }
  }
});

app.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, 'output.pdf');
  const configPath = path.join(tmpDir, 'convert.xml');

  console.log(`📄 Converting: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  try {
    // كتابة الملف
    fs.writeFileSync(inputPath, req.file.buffer);

    // إنشاء ملف التكوين لـ x2t
    // PDF format code = 513
    const configXml = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_nFormatTo>513</m_nFormatTo>
  <m_bDontSaveAdditional>true</m_bDontSaveAdditional>
  <m_sAllFontsPath>/opt/onlyoffice/documentbuilder/sdkjs/common/AllFonts.js</m_sAllFontsPath>
  <m_sFontDir>/usr/share/fonts</m_sFontDir>
  <m_sThemeDir>/opt/onlyoffice/documentbuilder/sdkjs/slide/themes</m_sThemeDir>
</TaskQueueDataConvert>`;

    fs.writeFileSync(configPath, configXml);

    // تنفيذ التحويل باستخدام x2t
    execSync(`${X2T_PATH} "${configPath}"`, {
      timeout: 120000,
      env: { ...process.env, HOME: tmpDir }
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF not generated');
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
    res.status(500).json({ error: 'Failed to convert', details: error.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
});

app.get('/health', (req, res) => {
  let x2tExists = fs.existsSync(X2T_PATH);
  res.json({
    status: 'ok',
    service: 'PDF Converter (OnlyOffice)',
    x2t: x2tExists ? 'available' : 'not found',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'PDF Converter API (OnlyOffice)',
    version: '3.0.0',
    engine: 'OnlyOffice x2t',
    endpoints: { 'POST /convert': 'Convert Office to PDF', 'GET /health': 'Health check' }
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (50MB max)' });
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 PDF Converter (OnlyOffice x2t) on port ${PORT}`);
});
