const express = require('express');
const multer = require('multer');
const cors = require('cors');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const libreConvert = promisify(libre.convert);

const app = express();
const PORT = process.env.PORT || 3000;

// السماح بالطلبات من أي مصدر (CORS)
app.use(cors());

// إعداد multer لاستقبال الملفات (حد أقصى 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
      'application/vnd.ms-excel',                                                  // xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // docx
      'application/msword',                                                        // doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint',                                             // ppt
      'application/octet-stream'                                                   // fallback
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`نوع الملف غير مدعوم: ${file.mimetype}`), false);
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

  console.log(`📄 تحويل: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  try {
    const inputBuffer = req.file.buffer;
    const ext = '.pdf';

    // تحويل الملف إلى PDF باستخدام LibreOffice
    const pdfBuffer = await libreConvert(inputBuffer, ext, undefined);

    // إرسال ملف PDF
    const originalName = path.parse(req.file.originalname).name;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
    console.log(`✅ تم التحويل بنجاح: ${originalName}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  } catch (error) {
    console.error('❌ خطأ في التحويل:', error.message);
    res.status(500).json({ 
      error: 'فشل في تحويل الملف إلى PDF',
      details: error.message 
    });
  }
});

// ======================================
// نقطة فحص صحة السيرفر
// GET /health
// ======================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'PDF Converter',
    timestamp: new Date().toISOString()
  });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    name: 'PDF Converter API',
    version: '1.0.0',
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
  console.log(`🚀 PDF Converter Server running on port ${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   POST /convert - Convert Office file to PDF`);
  console.log(`   GET  /health  - Health check`);
});
