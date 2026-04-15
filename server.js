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
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ======================================
// تحويل بسيط: ملف → PDF
// ======================================
app.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  try {
    fs.writeFileSync(inputPath, req.file.buffer);
    execSync(`libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${inputPath}"`, {
      timeout: 120000, env: { ...process.env, HOME: tmpDir, SAL_USE_VCLPLUGIN: 'svp' }
    });
    const pdfFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF not generated');
    const buf = fs.readFileSync(path.join(tmpDir, pdfFile));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': buf.length });
    res.send(buf);
  } catch (e) {
    console.error('❌', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

// ======================================
// تحويل متقدم: قالب + بيانات → PDF
// ======================================
app.post('/convert-template', upload.single('template'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No template file' });

  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't-'));
  const templatePath = path.join(tmpDir, 'template.xlsx');
  const filledPath = path.join(tmpDir, 'filled.xlsx');
  const dataPath = path.join(tmpDir, 'data.json');

  console.log(`📄 Template: ${req.file.originalname}`);

  try {
    // حفظ القالب
    fs.writeFileSync(templatePath, req.file.buffer);

    // حفظ البيانات كملف JSON
    const dataStr = req.body && req.body.data ? req.body.data : '{}';
    fs.writeFileSync(dataPath, dataStr, 'utf8');
    console.log('Data:', dataStr.substring(0, 200));

    // تعبئة القالب بـ Python
    const pyScript = path.join(__dirname, 'fill_template.py');
    const pyOut = execSync(`python3 "${pyScript}" "${templatePath}" "${filledPath}" "${dataPath}" 2>&1`, {
      timeout: 30000, env: { ...process.env, HOME: tmpDir }
    }).toString();
    console.log('Python:', pyOut);

    if (!fs.existsSync(filledPath)) {
      throw new Error('Python fill failed');
    }

    // تحويل لـ PDF
    execSync(`libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${filledPath}"`, {
      timeout: 120000, env: { ...process.env, HOME: tmpDir, SAL_USE_VCLPLUGIN: 'svp' }
    });

    const pdfFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF not generated');

    const buf = fs.readFileSync(path.join(tmpDir, pdfFile));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': buf.length });
    res.send(buf);
    console.log(`✅ ${baseName}.pdf`);
  } catch (e) {
    console.error('❌', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

app.get('/health', (req, res) => {
  let lo = '', py = '';
  try { lo = execSync('libreoffice --version 2>&1', { timeout: 5000 }).toString().trim(); } catch(e) {}
  try { py = execSync('python3 -c "import openpyxl; print(openpyxl.__version__)" 2>&1', { timeout: 5000 }).toString().trim(); } catch(e) { py = 'error: ' + e.message; }
  res.json({ status: 'ok', libreoffice: lo, openpyxl: py, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => res.json({ name: 'PDF Converter', version: '5.1.0' }));
app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
app.listen(PORT, () => console.log(`🚀 v5.1 on port ${PORT}`));
