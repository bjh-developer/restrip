"""
Tests for RunPod photostrip detection handler.
All external dependencies (YOLO model, file I/O) are mocked.
"""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_png_b64(width: int = 100, height: int = 200, channels: int = 3) -> str:
    """Return a base64-encoded PNG for use as test input."""
    img = np.zeros((height, width, channels), dtype=np.uint8)
    img[:] = (120, 80, 40)  # non-black so alpha extraction works
    success, buf = cv2.imencode(".png", img)
    assert success
    return base64.b64encode(buf.tobytes()).decode()


def _make_bgra(width: int = 100, height: int = 200) -> np.ndarray:
    """Return a solid BGRA image (no transparency)."""
    img = np.zeros((height, width, 4), dtype=np.uint8)
    img[:, :, :3] = (120, 80, 40)
    img[:, :, 3] = 255  # fully opaque
    return img


# ── order_points ──────────────────────────────────────────────────────────────

def test_order_points_correct_order():
    from handler import order_points

    pts = np.array([[10, 90], [90, 10], [90, 90], [10, 10]], dtype=np.float32)
    ordered = order_points(pts)

    np.testing.assert_array_equal(ordered[0], [10, 10])   # top-left
    np.testing.assert_array_equal(ordered[1], [90, 10])   # top-right
    np.testing.assert_array_equal(ordered[2], [90, 90])   # bottom-right
    np.testing.assert_array_equal(ordered[3], [10, 90])   # bottom-left


def test_order_points_returns_four_points():
    from handler import order_points

    pts = np.array([[0, 1], [1, 0], [1, 1], [0, 0]], dtype=np.float32)
    result = order_points(pts)
    assert result.shape == (4, 2)


# ── _calculate_distance ───────────────────────────────────────────────────────

def test_calculate_distance_horizontal():
    from handler import _calculate_distance

    assert _calculate_distance(
        np.array([0, 0], dtype=np.float32),
        np.array([3, 0], dtype=np.float32),
    ) == pytest.approx(3.0)


def test_calculate_distance_diagonal():
    from handler import _calculate_distance

    assert _calculate_distance(
        np.array([0, 0], dtype=np.float32),
        np.array([3, 4], dtype=np.float32),
    ) == pytest.approx(5.0)


def test_calculate_distance_same_point():
    from handler import _calculate_distance

    p = np.array([5, 5], dtype=np.float32)
    assert _calculate_distance(p, p) == pytest.approx(0.0)


# ── _extract_alpha_channel ────────────────────────────────────────────────────

def test_extract_alpha_channel_from_bgra():
    from handler import _extract_alpha_channel

    img = np.zeros((10, 10, 4), dtype=np.uint8)
    img[:, :, 3] = 128
    alpha = _extract_alpha_channel(img)
    assert alpha.shape == (10, 10)
    assert np.all(alpha == 128)


def test_extract_alpha_channel_from_bgr():
    from handler import _extract_alpha_channel

    img = np.zeros((10, 10, 3), dtype=np.uint8)
    img[2:8, 2:8] = (255, 255, 255)  # white region = foreground
    alpha = _extract_alpha_channel(img)
    assert alpha.shape == (10, 10)
    assert alpha[5, 5] == 255    # inside white region → foreground
    assert alpha[0, 0] == 0      # black corner → background


# ── ensure_vertical_orientation ───────────────────────────────────────────────

def test_ensure_vertical_orientation_portrait_unchanged():
    from handler import ensure_vertical_orientation

    img = np.zeros((200, 100, 3), dtype=np.uint8)  # already portrait
    result = ensure_vertical_orientation(img)
    assert result.shape == (200, 100, 3)


def test_ensure_vertical_orientation_landscape_rotated():
    from handler import ensure_vertical_orientation

    img = np.zeros((100, 200, 3), dtype=np.uint8)  # landscape
    result = ensure_vertical_orientation(img)
    h, w = result.shape[:2]
    assert h > w, "Result should be portrait after rotation"


def test_ensure_vertical_orientation_square_unchanged():
    from handler import ensure_vertical_orientation

    img = np.zeros((100, 100, 3), dtype=np.uint8)
    result = ensure_vertical_orientation(img)
    assert result.shape == (100, 100, 3)


# ── _decode_image_data ────────────────────────────────────────────────────────

def test_decode_image_data_from_base64_string():
    from handler import _decode_image_data

    original = b"hello world"
    encoded = base64.b64encode(original).decode()
    assert _decode_image_data(encoded) == original


def test_decode_image_data_from_bytes():
    from handler import _decode_image_data

    raw = b"raw bytes"
    assert _decode_image_data(raw) == raw


# ── _encode_image_to_base64 ───────────────────────────────────────────────────

def test_encode_image_to_base64_returns_string():
    from handler import _encode_image_to_base64

    img = np.zeros((50, 50, 3), dtype=np.uint8)
    result = _encode_image_to_base64(img)
    assert isinstance(result, str)
    # Should be valid base64
    decoded = base64.b64decode(result)
    assert len(decoded) > 0


def test_encode_decode_roundtrip():
    from handler import _encode_image_to_base64

    img = np.zeros((50, 50, 3), dtype=np.uint8)
    img[10:40, 10:40] = (0, 255, 0)
    b64 = _encode_image_to_base64(img)
    decoded = base64.b64decode(b64)
    arr = np.frombuffer(decoded, dtype=np.uint8)
    recovered = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    assert recovered is not None
    assert recovered.shape == img.shape


# ── handler — input validation ─────────────────────────────────────────────────

@patch("handler.model")
def test_handler_missing_image_returns_error(mock_model):
    from handler import handler

    result = handler({"input": {}})
    assert result["success"] is False
    assert "No image data provided" in result["error"]


@patch("handler.model")
def test_handler_empty_event_returns_error(mock_model):
    from handler import handler

    result = handler({})
    assert result["success"] is False


# ── handler — no detection ─────────────────────────────────────────────────────

@patch("handler.model")
def test_handler_no_detection_returns_error(mock_model):
    """YOLO finds nothing → handler returns a clear error."""
    from handler import handler

    mock_result = MagicMock()
    mock_result.__iter__ = MagicMock(return_value=iter([]))  # no detections
    mock_model.predict.return_value = [mock_result]

    result = handler({"input": {"image": _make_png_b64()}})
    assert result["success"] is False
    assert "No photostrip detected" in result["error"]


# ── handler — successful detection ────────────────────────────────────────────

@patch("handler.model")
def test_handler_successful_detection(mock_model):
    """Full happy-path: YOLO returns a mask → handler returns base64 PNG."""
    from handler import handler

    h, w = 200, 100
    orig_img = np.zeros((h, w, 3), dtype=np.uint8)
    orig_img[:] = (120, 80, 40)

    # Build a simple rectangular contour covering most of the image
    contour_pts = np.array([[10, 10], [90, 10], [90, 190], [10, 190]], dtype=np.float32)

    mock_box = MagicMock()
    mock_box.cls.tolist.return_value = [0]
    mock_box.xyxy.cpu.return_value.numpy.return_value.squeeze.return_value.astype.return_value = (
        np.array([10, 10, 90, 190])
    )

    mock_mask = MagicMock()
    mock_mask.xy = [contour_pts]

    mock_detection = MagicMock()
    mock_detection.boxes = mock_box
    mock_detection.masks = mock_mask
    mock_detection.names = {0: "photostrip"}

    mock_result = MagicMock()
    mock_result.orig_img = orig_img
    mock_result.__iter__ = MagicMock(return_value=iter([mock_detection]))

    mock_model.predict.return_value = [mock_result]

    result = handler({"input": {"image": _make_png_b64(w, h)}})

    assert result["success"] is True
    assert "photostrip" in result
    # Verify it's valid base64-encoded image data
    decoded = base64.b64decode(result["photostrip"])
    assert len(decoded) > 0


@patch("handler.model")
def test_handler_detection_missing_masks_skipped(mock_model):
    """Detection with no masks should be skipped gracefully."""
    from handler import handler

    orig_img = np.zeros((200, 100, 3), dtype=np.uint8)

    mock_detection = MagicMock()
    mock_detection.boxes = MagicMock()
    mock_detection.masks = None  # no mask

    mock_result = MagicMock()
    mock_result.orig_img = orig_img
    mock_result.__iter__ = MagicMock(return_value=iter([mock_detection]))

    mock_model.predict.return_value = [mock_result]

    result = handler({"input": {"image": _make_png_b64()}})
    assert result["success"] is False


# ── straighten_transparent_crop ───────────────────────────────────────────────

def test_straighten_transparent_crop_no_contour_returns_original():
    from handler import straighten_transparent_crop

    # Fully transparent image → no contour found
    img = np.zeros((100, 100, 4), dtype=np.uint8)
    result = straighten_transparent_crop(img)
    assert result.shape == img.shape


def test_straighten_transparent_crop_returns_bgra():
    from handler import straighten_transparent_crop

    img = _make_bgra(100, 200)
    result = straighten_transparent_crop(img)
    assert result.ndim == 3
    assert result.shape[2] == 4  # BGRA preserved