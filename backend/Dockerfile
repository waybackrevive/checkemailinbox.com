FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for dkimpy and pyspf
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# Simple entry point — run.py reads PORT from env
CMD ["python", "run.py"]
