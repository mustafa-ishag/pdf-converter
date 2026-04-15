FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# تثبيت Node.js 20
RUN apt-get update && \
    apt-get install -y curl gnupg2 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# تثبيت OnlyOffice DocumentBuilder (يحتوي على محرك x2t)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.onlyoffice.com/repo/onlyoffice.key | gpg --dearmor -o /etc/apt/keyrings/onlyoffice.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/onlyoffice.gpg] https://download.onlyoffice.com/repo/debian squeeze main" > /etc/apt/sources.list.d/onlyoffice.list && \
    apt-get update && \
    apt-get install -y onlyoffice-documentbuilder && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# تثبيت الخطوط
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    fonts-liberation fonts-liberation2 \
    fonts-arabeyes fonts-kacst fonts-kacst-one \
    fonts-noto-core fonts-noto-extra \
    fonts-dejavu-core fonts-freefont-ttf \
    fontconfig && \
    fc-cache -fv && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# تحديث خطوط OnlyOffice
RUN /opt/onlyoffice/documentbuilder/allfontsgen \
    /usr/share/fonts \
    /opt/onlyoffice/documentbuilder/sdkjs/common/AllFonts.js \
    /opt/onlyoffice/documentbuilder/sdkjs/common/fonts_thumbnail.png \
    /opt/onlyoffice/documentbuilder/sdkjs/common/fonts_thumbnail@2x.png || true

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
