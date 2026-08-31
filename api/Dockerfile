FROM node:22-bookworm-slim

# pdftotext (poppler-utils) is required for CV text extraction (src/cv/extract.ts).
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
