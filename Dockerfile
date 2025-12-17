# Multi-stage build for Futures Link
# Force rebuild: 2025-10-14

# Stage 1: Build Frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend
FROM python:3.10-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Create necessary directories
RUN mkdir -p backend/instance backend/logs backend/uploads backend/temp_audio backend/exports backend/data

# Verify critical files exist and list them
RUN echo "=== Verifying files ===" && \
    ls -la backend/*.json && \
    echo "users.json:" && ls -lh backend/users.json && \
    echo "campuses.json:" && ls -lh backend/campuses.json && \
    echo "static files:" && ls -lh backend/static/*.json backend/static/*.png 2>/dev/null || echo "Some static files missing" && \
    echo "migrations:" && ls -lh backend/migrations/*.sql 2>/dev/null || echo "No migrations found"

# Set environment variable for Railway
ENV PORT=5002
ENV PYTHONUNBUFFERED=1

# Expose port (Railway will override PORT env var)
EXPOSE ${PORT}

# Copy and setup startup script
COPY start.sh ./
RUN chmod +x start.sh

# Start the application
CMD ["./start.sh"]

