FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./

RUN npm install --omit=dev

COPY server/ ./

RUN mkdir -p logs uploads/content uploads/recordings uploads/branding uploads/teachers uploads/homework && \
    chmod -R 777 logs uploads

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health/ready || exit 1

EXPOSE 5000

CMD ["node", "index.js"]
