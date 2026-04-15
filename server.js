const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// السماح بالطلبات من أي مصدر (CORS)
app.use(cors());

// إعداد multer لاستقبال الملفات (حد أقصى 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.includes('office') || file.mimetype.includes('excel') || file.mimetype.includes('word') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`نوع الملف غير مدعوم: ${ext}`), false);
    }
  }
});

// ======================================
// نقطة النهاية الرئيسية: تحويل ملف إلى PDF
// POST /convert
// ======================================
app.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'يرجى إرسال ملف للتحويل' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase() || '.xlsx';
  const baseName = path.parse(req.file.originalname).name;

  console.log(`📄 تحويل: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  // إنشاء مجلد مؤقت فريد
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, `input.pdf`);

  try {
    // كتابة الملف المُدخل
    fs.writeFileSync(inputPath, req.file.buffer);

    // تحديد الفلتر المناسب حسب نوع الملف
    let convertCmd;
    if (['.xlsx', '.xls'].includes(ext)) {
      // تحويل Excel مع إعدادات محسّنة للحفاظ على التنسيق
      convertCmd = `libreoffice --headless --norestore --calc --convert-to pdf:"calc_pdf_Export:{"Printing":{"SelectionOnly":false}}" --outdir "${tmpDir}" "${inputPath}"`;
    } else if (['.docx', '.doc'].includes(ext)) {
      convertCmd = `libreoffice --headless --norestore --writer --convert-to pdf:"writer_pdf_Export" --outdir "${tmpDir}" "${inputPath}"`;
    } else {
      convertCmd = `libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${inputPath}"`;
    }

    // تنفيذ التحويل مع timeout 120 ثانية
    execSync(convertCmd, { 
      timeout: 120000,
      env: {
        ...process.env,
        HOME: tmpDir, // تجنب مشاكل القفل
        SAL_USE_VCLPLUGIN: 'svp' // وضع headless محسن
      }
    });

    // التحقق من وجود ملف PDF الناتج
    if (!fs.existsSync(outputPath)) {
      throw new Error('لم يتم إنشاء ملف PDF');
    }

    const pdfBuffer = fs.readFileSync(outputPath);

    // إرسال ملف PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
    console.log(`✅ تم التحويل بنجاح: ${baseName}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  } catch (error) {
    console.error('❌ خطأ في التحويل:', error.message);
    res.status(500).json({ 
      error: 'فشل في تحويل الملف إلى PDF',
      details: error.message 
    });
  } finally {
    // تنظيف الملفات المؤقتة
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('تحذير: لم يتم حذف الملفات المؤقتة:', e.message);
    }
  }
});

// ======================================
// نقطة فحص صحة السيرفر
// GET /health
// ======================================
app.get('/health', (req, res) => {
  // فحص وجود LibreOffice
  let loVersion = 'unknown';
  try {
    loVersion = execSync('libreoffice --version', { timeout: 5000 }).toString().trim();
  } catch(e) {}

  res.json({ 
    status: 'ok', 
    service: 'PDF Converter',
    libreoffice: loVersion,
    timestamp: new Date().toISOString()
  });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    name: 'PDF Converter API',
    version: '2.0.0',
    endpoints: {
      'POST /convert': 'تحويل ملف Office إلى PDF - أرسل الملف في حقل "file"',
      'GET /health': 'فحص صحة السيرفر'
    }
  });
});

// معالجة الأخطاء
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'حجم الملف يتجاوز الحد الأقصى (50MB)' });
    }
  }
  res.status(500).json({ error: error.message });
});

// بدء السيرفر
app.listen(PORT, () => {
  console.log(`🚀 PDF Converter Server v2.0 running on port ${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   POST /convert - Convert Office file to PDF`);
  console.log(`   GET  /health  - Health check`);
});
