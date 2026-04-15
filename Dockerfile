FROM node:20-slim

# تثبيت LibreOffice
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-calc \
    libreoffice-writer \
    libreoffice-impress \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# تعريف المنفذ
EXPOSE 3000

# تشغيل السيرفر
CMD ["node", "server.js"]
