FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# تثبيت Node.js 20
RUN apt-get update && \
    apt-get install -y curl gnupg2 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# تثبيت OnlyOffice DocumentBuilder
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys CB2DE8E5 && \
    echo "deb https://download.onlyoffice.com/repo/debian squeeze main" > /etc/apt/sources.list.d/onlyoffice.list && \
    apt-get update && \
    apt-get install -y onlyoffice-documentbuilder && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# تثبيت الخطوط
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    fonts-liberation fonts-liberation2 \
    fonts-arabeyes fonts-kacst fonts-kacst-one \
    fonts-noto-core fonts-dejavu-core \
    fonts-freefont-ttf fontconfig && \
    fc-cache -fv && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# تحديث خطوط OnlyOffice
RUN if [ -f /opt/onlyoffice/documentbuilder/allfontsgen ]; then \
    /opt/onlyoffice/documentbuilder/allfontsgen \
    /usr/share/fonts \
    /opt/onlyoffice/documentbuilder/sdkjs/common/AllFonts.js \
    /opt/onlyoffice/documentbuilder/sdkjs/common/fonts_thumbnail.png \
    /opt/onlyoffice/documentbuilder/sdkjs/common/fonts_thumbnail@2x.png; fi || true

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
