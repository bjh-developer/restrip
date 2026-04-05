FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY runpod/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download model weights from HuggingFace (private repo)
ARG HF_TOKEN
RUN mkdir -p /app/runs/segment/train/weights && \
    pip install --no-cache-dir huggingface_hub && \
    python -c "\
from huggingface_hub import hf_hub_download; \
import os; \
hf_hub_download( \
    repo_id='ReStrip/restrip_photostrip_detection_crop', \
    filename='runs/segment/train/weights/Best.pth', \
    token=os.environ['HF_TOKEN'], \
    local_dir='/app/runs/segment/train/weights', \
)"

# Copy handler and metrics scripts
COPY runpod/handler.py .
COPY runpod/metrics.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run as non-root user to reduce container escape risk
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# Command to run the handler
CMD ["python", "-u", "handler.py"]