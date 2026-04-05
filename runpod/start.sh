#!/bin/bash
set -e

WEIGHTS_PATH="/app/runs/segment/train/weights/Best.pth"

if [ ! -f "$WEIGHTS_PATH" ]; then
    echo "Downloading model weights from HuggingFace..."
    mkdir -p /app/runs/segment/train/weights
    hf download \
        ReStrip/restrip_photostrip_detection_crop \
        runs/segment/train/weights/Best.pth \
        --token "$HF_TOKEN" \
        --local-dir /app/runs/segment/train/weights
    echo "Weights downloaded."
fi

exec python -u handler.py
