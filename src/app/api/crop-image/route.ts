import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      console.error("Missing RunPod configuration");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

    // Remove data URL prefix if present
    const base64Data = image.split(",")[1] || image;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          image: base64Data,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("RunPod response:", data);

    // Extract the cropped image from output.photostrip
    if (data.output?.photostrip) {
      return NextResponse.json({
        success: true,
        photostrip: data.output.photostrip,
      });
    } else {
      return NextResponse.json(
        { error: "No photostrip in response" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Crop image error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 },
    );
  }
}
