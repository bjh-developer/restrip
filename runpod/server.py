"""
Local Development Server for Photostrip Detection.

Wraps the same YOLO detection logic from handler.py into a
FastAPI server for local development, removing the dependency
on RunPod's serverless infrastructure.

Usage:
    pip install fastapi uvicorn
    python server.py

The server exposes a single endpoint:
    POST /crop
    Body: { "image": "<base64-encoded-image>" }
    Response: { "success": true, "photostrip": "<base64-png>" }
          or: { "success": false, "error": "<message>" }
"""

from __future__ import annotations

import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from handler import detect_crop_photostrip

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="ReStrip Local Crop Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class CropRequest(BaseModel):
    """Request body for the /crop endpoint."""
    image: str


@app.post("/crop")
async def crop(body: CropRequest):
    """
    Detect and extract a photo strip from the provided base64 image.

    Delegates to the same ``detect_crop_photostrip`` function used by
    the RunPod handler, ensuring identical behaviour between local
    and cloud processing.
    """
    logger.info("Received crop request (%d chars)", len(body.image))
    result = detect_crop_photostrip(body.image)
    return result


if __name__ == "__main__":
    logger.info("Starting local crop server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
