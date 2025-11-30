'use client';

import { useRef, useState } from 'react';

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {!capturedImage ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-w-lg rounded-lg shadow-card"
          />
        ) : (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full max-w-lg rounded-lg shadow-card"
          />
        )}
      </div>
      
      <div className="flex gap-2">
        {!stream && !capturedImage && (
          <button
            onClick={startCamera}
            className="px-6 min-h-button font-body font-semibold bg-blush-pink text-soft-black rounded-md hover:bg-blush-pink-hover transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Camera
          </button>
        )}
        
        {stream && !capturedImage && (
          <>
            <button
              onClick={capturePhoto}
              className="px-6 min-h-button font-body font-semibold bg-blush-pink text-soft-black rounded-md hover:bg-blush-pink-hover transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Capture Photo
            </button>
            <button
              onClick={stopCamera}
              className="px-6 min-h-button font-body font-semibold bg-white text-soft-black border-2 border-mist-grey rounded-md hover:border-soft-black transition-all"
            >
              Stop Camera
            </button>
          </>
        )}
        
        {capturedImage && (
          <button
            onClick={() => {
              setCapturedImage(null);
              startCamera();
            }}
            className="px-6 min-h-button font-body font-semibold bg-pastel-blue text-soft-black rounded-md hover:opacity-90 transition-all"
          >
            Retake Photo
          </button>
        )}
      </div>
    </div>
  );
}
