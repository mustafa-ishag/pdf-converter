# PDF Converter Server

سيرفر خاص لتحويل ملفات Office (Excel, Word, PowerPoint) إلى PDF باستخدام LibreOffice.

## الاستخدام

### API Endpoint

```
POST /convert
```

أرسل الملف في حقل `file` كـ `multipart/form-data`.

### مثال

```javascript
const formData = new FormData();
formData.append('file', excelBlob, 'report.xlsx');

const response = await fetch('https://your-server.onrender.com/convert', {
  method: 'POST',
  body: formData
});

const pdfBlob = await response.blob();
```

## النشر على Render

1. ارفع هذا المجلد إلى GitHub repository جديد
2. ادخل [render.com](https://render.com) وأنشئ حساب
3. اضغط **New > Web Service**
4. اربط الـ GitHub repo
5. اختر:
   - **Environment**: Docker
   - **Plan**: Free
6. اضغط **Create Web Service**
7. انتظر حتى يكتمل البناء (5-10 دقائق)
8. انسخ الرابط وضعه في `_pdfServerUrl` في `AppController.js`

## التشغيل المحلي (يتطلب LibreOffice مثبت)

```bash
npm install
npm start
```
