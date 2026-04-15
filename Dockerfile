FROM node:20-slim

# تثبيت LibreOffice الكامل مع الخطوط
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice \
    fonts-liberation fonts-liberation2 \
    fonts-arabeyes fonts-kacst fonts-kacst-one \
    fonts-noto-core fonts-dejavu-core \
    fonts-freefont-ttf fonts-opensymbol \
    fontconfig && \
    fc-cache -fv && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
