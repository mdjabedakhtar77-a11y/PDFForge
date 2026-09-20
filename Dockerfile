# syntax=docker/dockerfile:1
# Multi-stage production Dockerfile for PDFForge

# ==============================================================================
# Stage 1: Build & Dependency Resolution
# ==============================================================================
FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev

# ==============================================================================
# Stage 2: Lean Production Runtime
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install runtime libraries: curl for healthchecks, fonts for PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create application user and group for non-root execution
RUN groupadd --gid 1001 pdfforge && \
    useradd --uid 1001 --gid pdfforge --shell /bin/bash --create-home pdfforge

# Copy installed dependencies from dependencies stage
COPY --from=dependencies --chown=pdfforge:pdfforge /app/node_modules ./node_modules

# Copy application source files
COPY --chown=pdfforge:pdfforge package.json ./
COPY --chown=pdfforge:pdfforge backend ./backend
COPY --chown=pdfforge:pdfforge frontend ./frontend
COPY --chown=pdfforge:pdfforge eng.traineddata ./

# Ensure storage directories exist with proper ownership
RUN mkdir -p /app/uploads/temp /app/uploads/results && \
    chown -R pdfforge:pdfforge /app/uploads

# Expose server port
EXPOSE 3000

# Define container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Run as non-root user
USER pdfforge

# Start PDFForge server
CMD ["node", "backend/app.js"]
