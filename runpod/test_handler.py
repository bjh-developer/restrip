"""
Test the RunPod handler locally
"""
import json
from handler import handler

# Load test input
with open('test_input.json', 'r') as f:
    event = json.load(f)

# Run handler
print("🚀 Testing handler...")
result = handler(event)

# Display results
print("\n📊 Results:")
print(f"  Success: {result.get('success')}")

if result.get('success'):
    print(f"  Dimensions: {result.get('dimensions')}")
    print(f"  Base64 length: {len(result.get('photostrip', ''))} characters")
    
    # Optionally save the result
    with open('test_output.json', 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\n✅ Output saved to test_output.json")
    
    # Save the image
    import base64
    import cv2
    import numpy as np
    
    img_data = base64.b64decode(result['photostrip'])
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    cv2.imwrite('test_output.png', img)
    print(f"✅ Image saved to test_output.png")
else:
    print(f"  Error: {result.get('error')}")
