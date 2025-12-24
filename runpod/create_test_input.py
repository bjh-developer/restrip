"""
Create test_input.json file with base64-encoded image for RunPod handler testing
"""
import base64
import json

def create_test_input(image_path, output_json="test_input.json"):
    """
    Create a test input JSON file with base64-encoded image.
    
    Args:
        image_path: Path to the image file to encode
        output_json: Output JSON file path
    """
    # Read the image file
    with open(image_path, 'rb') as f:
        image_bytes = f.read()
    
    # Encode to base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Create the input structure (matches what RunPod expects)
    test_input = {
        "input": {
            "image": image_base64
        }
    }
    
    # Write to JSON file
    with open(output_json, 'w') as f:
        json.dump(test_input, f, indent=2)
    
    print(f"✅ Created {output_json}")
    print(f"   Image: {image_path}")
    print(f"   Base64 length: {len(image_base64)} characters")

if __name__ == '__main__':
    # Change this to your test image path
    create_test_input("test_files/IMG_1287.JPG", "test_input.json")
