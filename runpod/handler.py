"""
RunPod Handler for Photostrip Detection
This script processes uploaded images to detect, extract and enhance photo strip from image.
"""

import base64
from io import BytesIO

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

import runpod


model = YOLO("runs/segment/train/weights/best.pt")


def order_points(pts):
    """
    Order points in consistent order: top-left, top-right, bottom-right, bottom-left
    
    This is critical for perspective transform to work correctly.
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # Sum of coordinates
    # Top-left has smallest sum, bottom-right has largest
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Top-left
    rect[2] = pts[np.argmax(s)]  # Bottom-right
    
    # Difference of coordinates
    # Top-right has smallest difference, bottom-left has largest
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # Top-right
    rect[3] = pts[np.argmax(diff)]  # Bottom-left
    
    return rect

def straighten_transparent_crop(iso_crop):
    """
    Straighten an isolated photostrip that has a transparent background.
    
    Args:
        iso_crop: BGRA image (with alpha channel) containing isolated photostrip
                  Shape: (height, width, 4) where channel 4 is alpha/transparency
    
    Returns:
        straightened: BGRA image with straightened photostrip and transparent background
    """
    
    # Step 1: Extract the alpha channel (transparency mask)
    # The alpha channel tells us where the photostrip is (255) vs background (0)
    if iso_crop.shape[2] == 4:
        alpha = iso_crop[:, :, 3]
    else:
        # If no alpha channel, create one from non-black pixels
        gray = cv2.cvtColor(iso_crop, cv2.COLOR_BGR2GRAY)
        _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    
    # Step 2: Find the contour of the photostrip from the alpha mask
    contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("No contour found in transparent image")
        return iso_crop
    
    # Get the largest contour (should be the photostrip)
    contour = max(contours, key=cv2.contourArea)
    
    # Step 3: Get the minimum area rectangle (handles rotation)
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    box = np.intp(box)
    
    # Step 4: Order corners consistently
    rect_ordered = order_points(box.astype("float32"))
    (tl, tr, br, bl) = rect_ordered
    
    # Step 5: Calculate output dimensions
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # Step 6: Define destination points (perfect rectangle)
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # Step 7: Get perspective transform matrix
    M = cv2.getPerspectiveTransform(rect_ordered, dst)
    
    # Step 8: Apply transform to the entire image (including alpha channel)
    straightened = cv2.warpPerspective(
        iso_crop, 
        M, 
        (maxWidth, maxHeight),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)  # Transparent border
    )
    
    return straightened

def ensure_vertical_orientation(img):
    """
    Ensure photostrip is vertical (portrait).
    Rotate 90° if horizontal.
    """
    h, w = img.shape[:2]
    
    if w > h:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    
    return img


def detect_crop_photostrip(image_data):
    """
    Detect and extract photo strip from image.
    
    Args:
        image_data: Base64 encoded image or image bytes
        
    Returns:
        photostrip: Base64 encoded photostrip image
    """
    global model
    try:
        # Decode base64 image if needed
        if isinstance(image_data, str):
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data
            
        # Open image
        img = Image.open(BytesIO(image_bytes))
        res = model.predict(source=img)
        
        for r in res:
            img = np.copy(r.orig_img)

            # Iterate each object contour 
            for ci, c in enumerate(r):
                label = c.names[c.boxes.cls.tolist().pop()]

                b_mask = np.zeros(img.shape[:2], np.uint8)

                # Create contour mask 
                contour = c.masks.xy.pop().astype(np.int32).reshape(-1, 1, 2)
                _ = cv2.drawContours(b_mask, [contour], -1, (255, 255, 255), cv2.FILLED)

                # Isolate object with transparent background (when saved as PNG)
                isolated = np.dstack([img, b_mask])
                # detection crop
                x1, y1, x2, y2 = c.boxes.xyxy.cpu().numpy().squeeze().astype(np.int32)
                iso_crop = isolated[y1:y2, x1:x2]
        
        straightened = straighten_transparent_crop(iso_crop)
        final_photostrip = ensure_vertical_orientation(straightened)
        
        # Encode the image as base64 for return
        # First encode to PNG bytes
        success, buffer = cv2.imencode('.png', final_photostrip)
        if not success:
            raise Exception("Failed to encode image")
        
        # Convert to base64 string
        photostrip_base64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        
        return {
            'success': True,
            'photostrip': photostrip_base64,
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def handler(event):
    """
    RunPod handler function.
    
    Args:
        event: The event data passed to the function
        
    Returns:
        dict: Processing results
    """
    try:
        # Get input data
        input_data = event.get('input', {})
        image_data = input_data.get('image')
        
        if not image_data:
            return {
                'error': 'No image data provided'
            }
        
        # Process the image
        result = detect_crop_photostrip(image_data)
        
        return result
        
    except Exception as e:
        return {
            'error': f'Handler error: {str(e)}'
        }


if __name__ == '__main__':
    runpod.serverless.start({'handler': handler})
