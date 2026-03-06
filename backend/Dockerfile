FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for dkimpy, pyspf, and SpamAssassin
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    spamassassin \
    spamc \
    && rm -rf /var/lib/apt/lists/*

# Update SpamAssassin rules (run once during build)
RUN sa-update || true

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create startup script that runs spamd + uvicorn
RUN echo '#!/bin/bash\n\
# Start SpamAssassin daemon in background\n\
spamd --listen=127.0.0.1 --allowed-ips=127.0.0.1 --max-children=2 --pidfile=/var/run/spamd.pid &\n\
\n\
# Wait for spamd to start\n\
sleep 2\n\
\n\
# Run the Python app\n\
exec python run.py\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 8000

# Use bash to run both spamd and the app
CMD ["/bin/bash", "/app/start.sh"]
