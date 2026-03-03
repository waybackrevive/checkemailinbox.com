FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for dkimpy and pyspf
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code — timestamp forces cache invalidation on redeploy
ARG CACHEBUST=1
COPY . .

EXPOSE 8000

# Run with uvicorn — Python handles PORT env var for Railway compatibility
CMD ["python", "-c", "import os,uvicorn;uvicorn.run('main:app',host='0.0.0.0',port=int(os.environ.get('PORT','8000')))"]
