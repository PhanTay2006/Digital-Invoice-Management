FROM python:3.12-slim
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-vie \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN TESS_DIR="$(dirname "$(find /usr/share/tesseract-ocr -name 'vie.traineddata' | head -n 1)")" \
    && [ -n "$TESS_DIR" ] \
    && curl -fsSL --max-time 45 https://github.com/tesseract-ocr/tessdata_best/raw/main/vie.traineddata -o "$TESS_DIR/vie.traineddata" \
    || true
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
