# Stage 1 — build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG NODE_HEAP_MB=3072
RUN NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB} npm run build

# Stage 2 — production server (lean image, no devDeps)
FROM node:22-alpine
# A font for the generated app icons (server/utils/pwaIcons.js draws the center's initial)
RUN apk add --no-cache fontconfig ttf-dejavu
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=frontend /app/dist ../dist/
RUN mkdir -p logs uploads/content uploads/recordings uploads/branding uploads/teachers uploads/homework && \
    chmod -R 777 logs uploads
EXPOSE 5000
CMD ["node", "--import", "./instrument.js", "index.js"]
