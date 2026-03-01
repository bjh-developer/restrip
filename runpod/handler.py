"""
RunPod Handler for Photostrip Detection.

This module provides serverless image processing functionality for detecting,
extracting, and enhancing photo strips from uploaded images using YOLO
segmentation. The handler runs on RunPod's serverless infrastructure.

Key features:
- YOLO-based photostrip segmentation
- Perspective correction for skewed images
- Automatic orientation normalization
- Transparent background isolation

Example usage (via RunPod API):
    {
        "input": {
            "image": "<base64-encoded-image>"
        }
    }
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
import uuid
from io import BytesIO
from typing import TypedDict, Union

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image
from ultralytics import YOLO

import runpod
from metrics import push_metric


# ── Structured JSON logging ──

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data: dict = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        return json.dumps(log_data)


_handler = logging.StreamHandler()
_handler.setFormatter(JSONFormatter())
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.addHandler(_handler)
logger.propagate = False


# ── Type aliases ──

ImageArray = NDArray[np.uint8]
PointsArray = NDArray[np.float32]


class SuccessResult(TypedDict):
    """Type for successful processing result."""
    success: bool
    photostrip: str


class ErrorResult(TypedDict):
    """Type for error processing result."""
    success: bool
    error: str


ProcessingResult = Union[SuccessResult, ErrorResult]


# ── Model initialisation ──

MODEL_PATH = "runs/segment/train/weights/best.pt"

# Only load model in RunPod environment — skip during CI testing
model = YOLO(MODEL_PATH) if os.getenv("RUNPOD_POD_ID") else None
if model:
    logger.info("Model loaded successfully", extra={"extra": {"model_path": MODEL_PATH}})
else:
    logger.info("Skipping model load (not in RunPod environment)")


# ── Pure utility functions ──

def order_points(pts: PointsArray) -> PointsArray:
    """
    Order corner points in a consistent clockwise order.

    Arranges four corner points in the order: top-left, top-right,
    bottom-right, bottom-left. This consistent ordering is critical
    for perspective transforms to work correctly.

    Args:
        pts: Array of shape (4, 2) containing four corner points.

    Returns:
        Ordered array of shape (4, 2) with points in clockwise order
        starting from top-left.
    """
    rect = np.zeros((4, 2), dtype=np.float32)

    coordinate_sums = pts.sum(axis=1)
    rect[0] = pts[np.argmin(coordinate_sums)]   # Top-left
    rect[2] = pts[np.argmax(coordinate_sums)]   # Bottom-right

    coordinate_diffs = np.diff(pts, axis=1).flatten()
    rect[1] = pts[np.argmin(coordinate_diffs)]  # Top-right
    rect[3] = pts[np.argmax(coordinate_diffs)]  # Bottom-left

    return rect


def _calculate_distance(point1: PointsArray, point2: PointsArray) -> float:
    """
    Calculate Euclidean distance between two points.

    Args:
        point1: First point as (x, y) array.
        point2: Second point as (x, y) array.

    Returns:
        Euclidean distance between the points.
    """
    return float(np.sqrt(
        ((point1[0] - point2[0]) ** 2) + ((point1[1] - point2[1]) ** 2)
    ))


def _extract_alpha_channel(image: ImageArray) -> ImageArray:
    """
    Extract or create alpha channel from an image.

    If the image has 4 channels (BGRA), extracts the alpha channel.
    Otherwise, creates a binary mask from non-black pixels.

    Args:
        image: Input image array (BGR or BGRA).

    Returns:
        Single-channel alpha mask (255 for foreground, 0 for background).
    """
    if image.shape[2] == 4:
        return np.asarray(image[:, :, 3], dtype=np.uint8)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    return np.asarray(alpha, dtype=np.uint8)


def _decode_image_data(image_data: Union[str, bytes]) -> bytes:
    """
    Decode image data from base64 string or return bytes directly.

    Args:
        image_data: Base64-encoded string or raw image bytes.

    Returns:
        Raw image bytes.
    """
    if isinstance(image_data, str):
        return base64.b64decode(image_data)
    return image_data


def _encode_image_to_base64(image: ImageArray) -> str:
    """
    Encode an image array to base64-encoded PNG string.

    Args:
        image: OpenCV image array (BGR or BGRA).

    Returns:
        Base64-encoded PNG string.

    Raises:
        ValueError: If image encoding fails.
    """
    success, buffer = cv2.imencode(".png", image)
    if not success:
        raise ValueError("Failed to encode image to PNG format")
    return base64.b64encode(buffer.tobytes()).decode("utf-8")


# ── Image processing functions ───

def straighten_transparent_crop(iso_crop: ImageArray) -> ImageArray:
    """
    Apply perspective correction to straighten an isolated photostrip.

    Args:
        iso_crop: BGRA image with alpha channel containing isolated photostrip.

    Returns:
        Straightened BGRA image with transparent background and corrected
        perspective.
    """
    alpha = _extract_alpha_channel(iso_crop)

    contours, _ = cv2.findContours(
        alpha,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        logger.warning("No contour found in transparent image, returning original")
        return iso_crop

    largest_contour = max(contours, key=cv2.contourArea)
    min_rect = cv2.minAreaRect(largest_contour)
    box_points = cv2.boxPoints(min_rect)

    ordered_corners = order_points(np.asarray(box_points, dtype=np.float32))
    top_left, top_right, bottom_right, bottom_left = ordered_corners

    width_bottom = _calculate_distance(bottom_right, bottom_left)
    width_top = _calculate_distance(top_right, top_left)
    max_width = max(int(width_bottom), int(width_top))

    height_right = _calculate_distance(top_right, bottom_right)
    height_left = _calculate_distance(top_left, bottom_left)
    max_height = max(int(height_right), int(height_left))

    destination_points = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype=np.float32)

    transform_matrix = cv2.getPerspectiveTransform(ordered_corners, destination_points)

    straightened = cv2.warpPerspective(
        iso_crop,
        transform_matrix,
        (max_width, max_height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)
    )

    return np.asarray(straightened, dtype=np.uint8)


def ensure_vertical_orientation(image: ImageArray) -> ImageArray:
    """
    Ensure the image is in vertical (portrait) orientation.

    Args:
        image: Input image array of any shape.

    Returns:
        Image rotated to portrait orientation if needed.
    """
    height, width = image.shape[:2]

    if width > height:
        logger.info("Rotating image from landscape to portrait orientation")
        rotated = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        return np.asarray(rotated, dtype=np.uint8)

    return image


def detect_crop_photostrip(image_data: Union[str, bytes]) -> ProcessingResult:
    """
    Detect and extract a photo strip from an input image.

    Args:
        image_data: Base64-encoded image string or raw image bytes.

    Returns:
        Dictionary containing either:
        - On success: {"success": True, "photostrip": "<base64-png>"}
        - On failure: {"success": False, "error": "<error-message>"}
    """
    try:
        image_bytes = _decode_image_data(image_data)
        pil_image = Image.open(BytesIO(image_bytes))
        logger.info("Processing image", extra={"extra": {"size": str(pil_image.size)}})

        predictions = model.predict(source=pil_image)

        isolated_crop = None
        for result in predictions:
            original_image = np.copy(result.orig_img)

            for detection in result:
                if detection.boxes is None or detection.masks is None:
                    logger.warning("Detection missing boxes or masks, skipping")
                    continue

                class_idx = detection.boxes.cls.tolist().pop()
                label = detection.names[class_idx]
                logger.info("Detected object", extra={"extra": {"label": label}})

                mask = np.zeros(original_image.shape[:2], np.uint8)
                contour = (
                    detection.masks.xy.pop()
                    .astype(np.int32)
                    .reshape(-1, 1, 2)
                )
                cv2.drawContours(mask, [contour], -1, (255, 255, 255), cv2.FILLED)

                isolated = np.dstack([original_image, mask])

                x1, y1, x2, y2 = (
                    detection.boxes.xyxy.cpu()
                    .numpy()
                    .squeeze()
                    .astype(np.int32)
                )
                isolated_crop = isolated[y1:y2, x1:x2]

        if isolated_crop is None:
            return {
                "success": False,
                "error": "No photostrip detected in image"
            }

        straightened = straighten_transparent_crop(isolated_crop)
        final_photostrip = ensure_vertical_orientation(straightened)
        photostrip_base64 = _encode_image_to_base64(final_photostrip)

        logger.info("Successfully processed photostrip")

        return {
            "success": True,
            "photostrip": photostrip_base64,
        }

    except Exception as e:
        logger.exception("Error during photostrip detection")
        return {
            "success": False,
            "error": str(e)
        }


# ── Handler entry point ───

def handler(event: dict) -> ProcessingResult:
    """
    RunPod serverless handler entry point.

    Expected input format:
        {
            "input": {
                "image": "<base64-encoded-image>"
            }
        }

    Args:
        event: RunPod event dictionary containing input data.

    Returns:
        Processing result dictionary with either success data or error.
    """
    request_id = event.get("id", str(uuid.uuid4()))
    start = time.time()

    try:
        input_data = event.get("input", {})
        image_data = input_data.get("image")

        if not image_data:
            duration_ms = round((time.time() - start) * 1000, 2)
            logger.error("No image data provided", extra={"extra": {
                "request_id": request_id,
                "duration_ms": duration_ms,
                "status": "error",
                "error": "No image data provided"
            }})
            push_metric(request_id, duration_ms, "error")
            return {
                "success": False,
                "error": "No image data provided"
            }

        result = detect_crop_photostrip(image_data)
        duration_ms = round((time.time() - start) * 1000, 2)
        status = "success" if result["success"] else "error"

        if result["success"]:
            logger.info("Request completed", extra={"extra": {
                "request_id": request_id,
                "duration_ms": duration_ms,
                "status": status,
            }})
        else:
            logger.error("Detection failed", extra={"extra": {
                "request_id": request_id,
                "duration_ms": duration_ms,
                "status": status,
                "error": result.get("error")
            }})

        push_metric(request_id, duration_ms, status)
        return result

    except Exception as e:
        duration_ms = round((time.time() - start) * 1000, 2)
        logger.exception("Unhandled handler error", extra={"extra": {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "status": "error",
            "error": str(e)
        }})
        push_metric(request_id, duration_ms, "error")
        return {
            "success": False,
            "error": f"Handler error: {str(e)}"
        }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})