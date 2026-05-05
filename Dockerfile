FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./

RUN npm install --omit=dev

COPY server/ ./

COPY dist/ ../dist/

RUN mkdir -p logs uploads/content uploads/recordings uploads/branding uploads/teachers uploads/homework && \
    chmod -R 777 logs uploads

EXPOSE 5000

CMD ["node", "index.js"]
