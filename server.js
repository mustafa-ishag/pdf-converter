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
app.use(express.json({ limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ======================================
// تحويل بسيط: ملف Office → PDF
// ======================================
app.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
  const inputPath = path.join(tmpDir, `input${ext}`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);
    execSync(`libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${inputPath}"`, {
      timeout: 120000, env: { ...process.env, HOME: tmpDir, SAL_USE_VCLPLUGIN: 'svp' }
    });

    const pdfFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF not generated');

    const pdfBuffer = fs.readFileSync(path.join(tmpDir, pdfFile));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length });
    res.send(pdfBuffer);
    console.log(`✅ ${baseName}.pdf`);
  } catch (error) {
    console.error('❌', error.message);
    res.status(500).json({ error: 'Failed to convert', details: error.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

// ======================================
// تحويل متقدم: قالب + بيانات → PDF
// يستخدم Python openpyxl لتعبئة البيانات بدقة
// ======================================
app.post('/convert-template', upload.single('template'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No template file' });

  const baseName = path.parse(req.file.originalname).name;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
  const templatePath = path.join(tmpDir, 'template.xlsx');
  const filledPath = path.join(tmpDir, 'filled.xlsx');
  const dataJson = req.body.data || '{}';

  console.log(`📄 Template convert: ${req.file.originalname}`);

  try {
    // حفظ القالب
    fs.writeFileSync(templatePath, req.file.buffer);

    // تعبئة البيانات بـ Python openpyxl (يحافظ على كل التنسيقات)
    const pyScript = path.join(__dirname, 'fill_template.py');
    const escapedJson = dataJson.replace(/'/g, "'\\''");
    execSync(`python3 "${pyScript}" "${templatePath}" "${filledPath}" '${escapedJson}'`, {
      timeout: 30000, env: { ...process.env, HOME: tmpDir }
    });

    if (!fs.existsSync(filledPath)) throw new Error('Template fill failed');

    // تحويل إلى PDF بـ LibreOffice
    execSync(`libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${filledPath}"`, {
      timeout: 120000, env: { ...process.env, HOME: tmpDir, SAL_USE_VCLPLUGIN: 'svp' }
    });

    const pdfFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF not generated');

    const pdfBuffer = fs.readFileSync(path.join(tmpDir, pdfFile));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length });
    res.send(pdfBuffer);
    console.log(`✅ ${baseName}.pdf (template mode)`);
  } catch (error) {
    console.error('❌', error.message);
    res.status(500).json({ error: 'Failed to convert', details: error.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
});

app.get('/health', (req, res) => {
  let v = 'unknown';
  try { v = execSync('libreoffice --version', { timeout: 5000 }).toString().trim(); } catch(e) {}
  let py = 'unknown';
  try { py = execSync('python3 --version', { timeout: 5000 }).toString().trim(); } catch(e) {}
  res.json({ status: 'ok', libreoffice: v, python: py, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => res.json({ name: 'PDF Converter', version: '5.0.0' }));
app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
app.listen(PORT, () => console.log(`🚀 PDF Converter v5 on port ${PORT}`));
