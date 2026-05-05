# Stage 1 — build the React frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN VITE_API_URL=https://clemify.com NODE_OPTIONS=--max-old-space-size=1536 npm run build

# Stage 2 — production server (lean image, no devDeps)
FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=frontend /app/dist ../dist/
RUN mkdir -p logs uploads/content uploads/recordings uploads/branding uploads/teachers uploads/homework && \
    chmod -R 777 logs uploads
EXPOSE 5000
CMD ["node", "index.js"]
