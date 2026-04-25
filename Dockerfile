# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# dist/ is now at /app/dist

# Stage 2: Production Node backend
FROM node:20-alpine AS production
WORKDIR /app

# Install server dependencies only (no devDependencies)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

# Create upload directories (overridden by Docker volume in production)
RUN mkdir -p server/uploads/recordings \
             server/uploads/branding \
             server/uploads/homework \
             server/uploads/teachers \
             server/logs

# Health check — matches ecosystem.config.cjs health_check_url
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health/ready || exit 1

EXPOSE 5000

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "server/index.js"]
