const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

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
  const outputPath = path.join(tmpDir, 'input.pdf');

  console.log(`📄 Converting: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    // تحويل بسيط - LibreOffice يقرأ إعدادات الطباعة من الملف نفسه
    const convertCmd = `libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${inputPath}"`;

    execSync(convertCmd, {
      timeout: 120000,
      env: {
        ...process.env,
        HOME: tmpDir,
        SAL_USE_VCLPLUGIN: 'svp'
      }
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
  let loVersion = 'unknown';
  try { loVersion = execSync('libreoffice --version', { timeout: 5000 }).toString().trim(); } catch(e) {}
  res.json({ status: 'ok', service: 'PDF Converter', libreoffice: loVersion, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ name: 'PDF Converter API', version: '3.0.0', endpoints: { 'POST /convert': 'Convert Office to PDF', 'GET /health': 'Health check' } });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (50MB max)' });
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 PDF Converter v3.0 on port ${PORT}`);
});
