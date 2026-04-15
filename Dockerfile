FROM node:20-slim

# تثبيت LibreOffice الكامل مع جميع الخطوط
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice \
    # خطوط Microsoft المتوافقة
    fonts-liberation \
    fonts-liberation2 \
    # خطوط عربية شاملة
    fonts-arabeyes \
    fonts-kacst \
    fonts-kacst-one \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-noto-ui-core \
    # خطوط إضافية
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-freefont-ttf \
    fonts-opensymbol \
    fontconfig \
    && fc-cache -fv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# تعريف المنفذ
EXPOSE 3000

# تشغيل السيرفر
CMD ["node", "server.js"]
