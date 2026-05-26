# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.13.1
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app

# Install system dependencies for PostgreSQL and SSL connections
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose the port
EXPOSE 3600

# Entrypoint
CMD ["npm", "start"]