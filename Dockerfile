FROM node:20-slim

# تثبيت LibreOffice مع جميع الخطوط المطلوبة
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-calc \
    libreoffice-writer \
    libreoffice-impress \
    # خطوط Microsoft الأساسية (Arial, Times New Roman, Courier, etc.)
    fonts-liberation \
    fonts-liberation2 \
    # خطوط عربية شاملة
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-extra \
    fonts-noto-mono \
    fonts-noto-ui-core \
    # خطوط إضافية
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-freefont-ttf \
    fonts-opensymbol \
    fonts-symbola \
    fonts-arabeyes \
    fonts-kacst \
    fonts-kacst-one \
    fontconfig \
    && fc-cache -fv \
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
