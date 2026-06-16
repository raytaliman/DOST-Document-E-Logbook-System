# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.13.1

# Build stage
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

# Install dependencies (npm ci for deterministic builds)
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the application source
COPY --link . .

# Build the production-ready static files
RUN npm run build

# Production stage: serve with a minimal static server
FROM node:${NODE_VERSION}-slim AS final
WORKDIR /app

# Install a minimal static file server (serve)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g serve

# Copy built assets and minimal files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Security: create and use a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

EXPOSE 3601
CMD ["serve", "-s", "dist", "-l", "3601"]
