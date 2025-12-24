# RunPod Serverless Deployment Guide

This guide walks you through deploying the ReReel photostrip detection handler to RunPod.

## 📋 Prerequisites

1. **Docker** installed on your machine
2. **Docker Hub account** (or other container registry)
3. **RunPod account** with serverless access
4. **Model weights** at `runs/segment/train/weights/best.pt`

## 🚀 Deployment Steps

### 1. Build the Docker Image

**Option A: Using the deployment script (Recommended)**

```bash
# Edit deploy.sh to set your Docker Hub username
nano deploy.sh

# Run the script
./deploy.sh
```

**Option B: Manual build**

```bash
# Build the image
docker build -t your-username/rereel-photostrip-handler:latest .

# Push to registry
docker login
docker push your-username/rereel-photostrip-handler:latest
```

### 2. Test Locally (Optional but Recommended)

```bash
# Generate test input
python create_test_input.py

# Test the handler
python test_handler.py

# Or test in Docker
docker run --rm \
  -v $(pwd)/test_input.json:/app/test_input.json \
  -v $(pwd)/test_output.png:/app/test_output.png \
  your-username/rereel-photostrip-handler:latest \
  python test_handler.py
```

### 3. Deploy to RunPod

1. **Go to RunPod Console**
   - Navigate to https://www.runpod.io/console/serverless

2. **Create a New Endpoint**
   - Click "New Endpoint"
   - Name: `rereel-photostrip-detection`

3. **Configure the Endpoint**
   - **Container Image**: `your-username/rereel-photostrip-handler:latest`
   - **Container Disk**: 10 GB (enough for model + dependencies)
   - **GPU Type**: Select based on your needs
     - For testing: Any GPU (even T4)
     - For production: A4000/A5000 recommended
   - **Min/Max Workers**: Start with 0 min, 3 max
   - **Idle Timeout**: 5 seconds
   - **Execution Timeout**: 600 seconds (for large images)

4. **Environment Variables** (if needed)
   ```
   PYTHONUNBUFFERED=1
   ```

5. **Click "Deploy"**

### 4. Test Your Endpoint

Once deployed, you'll get an endpoint URL. Test it:

```bash
# Get your endpoint ID and API key from RunPod console
ENDPOINT_ID="your-endpoint-id"
API_KEY="your-api-key"

# Create test request
curl -X POST "https://api.runpod.ai/v2/${ENDPOINT_ID}/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "input": {
      "image": "base64_encoded_image_here"
    }
  }'
```

Or use the test script:

```python
import requests
import base64
import json

# Read and encode image
with open('test_files/IMG_1287.JPG', 'rb') as f:
    image_b64 = base64.b64encode(f.read()).decode('utf-8')

# Make request
response = requests.post(
    'https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'input': {
            'image': image_b64
        }
    }
)

print(response.json())
```

## 📊 Expected Response Format

**Success:**
```json
{
  "id": "request-id",
  "status": "COMPLETED",
  "output": {
    "success": true,
    "photostrip": "base64_encoded_processed_image",
    "dimensions": {
      "width": 1536,
      "height": 3366
    }
  }
}
```

**Error:**
```json
{
  "id": "request-id",
  "status": "FAILED",
  "error": "Error message"
}
```

## 💰 Cost Optimization

1. **Set Min Workers to 0**: Only pay when processing
2. **Use Spot Instances**: 50-80% cheaper
3. **Set Idle Timeout**: Stop workers when not in use
4. **Monitor Usage**: Track GPU hours in RunPod dashboard

## 🔧 Troubleshooting

### Image too large
- Current image might be large due to PyTorch + YOLO
- Consider using multi-stage builds
- Remove unnecessary dependencies

### Model not found
- Verify `runs/segment/train/weights/best.pt` exists
- Check Dockerfile COPY path

### Out of memory
- Increase Container Disk in RunPod settings
- Or reduce model size / use quantized version

### Slow cold starts
- Increase Min Workers to 1
- Or accept 10-20s cold start for cost savings

## 📝 Files Reference

- `Dockerfile` - Container definition
- `handler.py` - Main serverless handler
- `requirements.txt` - Python dependencies
- `deploy.sh` - Build and push script
- `.dockerignore` - Files to exclude from image

## 🔗 Useful Links

- [RunPod Documentation](https://docs.runpod.io/serverless/overview)
- [RunPod API Reference](https://docs.runpod.io/reference/run)
- [Docker Hub](https://hub.docker.com/)
