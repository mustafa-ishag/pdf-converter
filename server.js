const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// البحث عن x2t
function findFile(name) {
  try {
    const result = execSync(`find /opt -name "${name}" -type f 2>/dev/null | head -1`, { timeout: 10000 }).toString().trim();
    return result || null;
  } catch(e) { return null; }
}

const X2T_PATH = findFile('x2t') || '/opt/onlyoffice/documentbuilder/x2t';

// توليد AllFonts.js إذا لم يكن موجوداً
let ALL_FONTS_PATH = findFile('AllFonts.js');
if (!ALL_FONTS_PATH) {
  try {
    // البحث عن أداة توليد الخطوط
    const fontGen = findFile('allfontsgen') || findFile('AllFontsGen');
    if (fontGen) {
      console.log('Generating AllFonts.js...');
      execSync(`"${fontGen}" --input=/usr/share/fonts --allfonts=/tmp/AllFonts.js 2>&1 || true`, { timeout: 60000 });
    }
    // محاولة أخرى
    if (!fs.existsSync('/tmp/AllFonts.js')) {
      execSync(`"${X2T_PATH}" --AllFontsGen=/usr/share/fonts:/tmp/AllFonts.js 2>&1 || true`, { timeout: 30000 });
    }
    if (fs.existsSync('/tmp/AllFonts.js')) {
      ALL_FONTS_PATH = '/tmp/AllFonts.js';
    }
  } catch(e) {
    console.log('Could not generate AllFonts.js:', e.message);
  }
}

console.log(`x2t: ${X2T_PATH} (exists: ${fs.existsSync(X2T_PATH)})`);
console.log(`AllFonts: ${ALL_FONTS_PATH || 'not available'}`);

// عرض محتويات مجلد DocumentBuilder للتشخيص
try {
  const dbDir = '/opt/onlyoffice/documentbuilder';
  if (fs.existsSync(dbDir)) {
    console.log('DocumentBuilder contents:', execSync(`ls -la ${dbDir} 2>/dev/null`).toString());
  }
} catch(e) {}

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
  if (!fs.existsSync(X2T_PATH)) return res.status(500).json({ error: 'x2t not found' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, 'output.pdf');
  const configPath = path.join(tmpDir, 'convert.xml');

  console.log(`📄 Converting: ${req.file.originalname}`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    // config بدون AllFonts إذا غير متوفر
    let configXml = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_nFormatTo>513</m_nFormatTo>
  <m_bDontSaveAdditional>true</m_bDontSaveAdditional>
  <m_sFontDir>/usr/share/fonts</m_sFontDir>`;
    
    if (ALL_FONTS_PATH && fs.existsSync(ALL_FONTS_PATH)) {
      configXml += `\n  <m_sAllFontsPath>${ALL_FONTS_PATH}</m_sAllFontsPath>`;
    }
    configXml += `\n</TaskQueueDataConvert>`;

    fs.writeFileSync(configPath, configXml);

    const output = execSync(`"${X2T_PATH}" "${configPath}" 2>&1`, {
      timeout: 120000,
      env: { ...process.env, HOME: tmpDir }
    }).toString();
    console.log('x2t:', output);

    // البحث عن أي pdf في المجلد
    const files = fs.readdirSync(tmpDir);
    console.log('Files:', files);
    
    let pdfFile = outputPath;
    if (!fs.existsSync(pdfFile)) {
      const found = files.find(f => f.endsWith('.pdf'));
      if (found) pdfFile = path.join(tmpDir, found);
      else throw new Error(`No PDF generated. Files: ${files.join(', ')}`);
    }

    const pdfBuffer = fs.readFileSync(pdfFile);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
    console.log(`✅ ${baseName}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  } catch (error) {
    console.error('❌', error.message);
    res.status(500).json({ error: 'Failed to convert', details: error.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

app.get('/health', (req, res) => {
  let dbFiles = [];
  try { dbFiles = fs.readdirSync('/opt/onlyoffice/documentbuilder'); } catch(e) {}
  res.json({
    status: 'ok',
    x2t: X2T_PATH,
    x2tExists: fs.existsSync(X2T_PATH),
    allFonts: ALL_FONTS_PATH || 'not found',
    dbFiles: dbFiles.slice(0, 20),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => res.json({ name: 'PDF Converter (OnlyOffice x2t)', version: '3.2.0' }));

app.use((error, req, res, next) => res.status(500).json({ error: error.message }));

app.listen(PORT, () => console.log(`🚀 PDF Converter on port ${PORT}`));
