/**
 * Upload Page Component
 *
 * Main page for uploading photo strip memories. Provides a form interface
 * for users to upload images, add captions, select delivery timing, and
 * choose notification method.
 *
 * Features:
 * - Image upload with drag-and-drop support
 * - Optional auto-crop using YOLO model (via RunPod)
 * - Multiple delivery timing options (surprise, custom period, custom date)
 * - Email or Telegram delivery
 * - Client-side validation with helpful error messages
 * - Manual cropping
 *
 * @module app/upload/page
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Brush,
  Crop as CropIcon,
  RotateCcw,
  Check,
  ArrowLeft,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PeriodPicker, type PeriodOption } from "../../components/PeriodPicker";
import {
  DeliveryMethodPicker,
  type DeliveryMethod,
} from "../../components/DeliveryMethodPicker";
import { computeScheduledSendTime } from "../../lib/delivery-scheduling";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../components/ui/shadcn-io/spinner";
import * as z from "zod";
import { loadUserJot } from "../../lib/userjot";

// =============================================================================
// Constants
// =============================================================================

/** Maximum file size before compression is applied (in MB) */
const COMPRESSION_THRESHOLD_MB = 3;

/** Target maximum file size after compression (in MB) */
const COMPRESSION_TARGET_MB = 3;

/** Maximum image dimension after compression */
const MAX_IMAGE_DIMENSION = 2048;

/** Initial quality for image compression (0-1) */
const COMPRESSION_QUALITY = 0.9;

/** UserJot widget configuration ID */
const USERJOT_CONFIG_ID = "cmjjzikhm01fr15o1n4jg1h93";

// =============================================================================
// Types
// =============================================================================

/** Field-specific validation error messages */
interface FieldErrors {
  image?: string;
  caption?: string;
  period?: string;
  deliveryAddress?: string;
}

/** Props for the UploadImage component */
interface UploadImageProps {
  /** Pre-processed image to display (e.g., cropped version) */
  displayImage?: string;
  /** Callback when user uploads an image */
  onImageUpload?: (base64Image: string) => void;
  /** Whether image is being processed */
  isLoading?: boolean;
  /** Whether to show error styling */
  error?: boolean;
}

/** Props for the AutoCropSwitch component */
interface AutoCropSwitchProps {
  /** Whether auto-crop is enabled */
  autoCropEnabled: boolean;
  /** Callback when toggle changes */
  onToggle: (checked: boolean) => void;
  /** Whether crop is in progress */
  isProcessing: boolean;
  /** Whether an image has been uploaded */
  imageUploaded?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Converts a base64 data URL to a Blob without using fetch.
 * This approach is CSP-friendly and works in strict environments.
 *
 * @param base64 - Base64-encoded data URL
 * @returns Blob object
 */
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const binaryString = atob(parts[1]);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * Compresses an image to reduce file size before encryption and upload.
 *
 * Only compresses if the image exceeds the threshold size. Uses Web Workers
 * for better performance and maintains reasonable quality.
 *
 * @param base64Image - Base64-encoded image data URL
 * @returns Promise resolving to compressed (or original) base64 image
 */
async function compressImage(base64Image: string): Promise<string> {
  try {
    const blob = base64ToBlob(base64Image);
    const sizeInMB = blob.size / 1024 / 1024;

    // Skip compression for small images
    if (sizeInMB <= COMPRESSION_THRESHOLD_MB) {
      console.log(`📷 Image is ${sizeInMB.toFixed(2)}MB, skipping compression`);
      return base64Image;
    }

    console.log(`📷 Image is ${sizeInMB.toFixed(2)}MB, compressing...`);

    // Convert to File object (required by imageCompression library)
    const file = new File([blob], "image.jpg", { type: blob.type });

    const options = {
      maxSizeMB: COMPRESSION_TARGET_MB,
      maxWidthOrHeight: MAX_IMAGE_DIMENSION,
      useWebWorker: true,
      initialQuality: COMPRESSION_QUALITY,
    };

    const compressedBlob = await imageCompression(file, options);

    // Convert compressed blob back to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error("⚠️ Compression failed, using original:", error);
    return base64Image;
  }
}

/**
 * Draws the cropped portion of the original image onto a canvas
 */
async function canvasPreview(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation = 0,
): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  const TO_RADIANS = Math.PI / 180;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const rotateRads = rotation * TO_RADIANS;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();
  //  Move image centre to canvas origin
  ctx.translate(-cropX, -cropY);
  //  Move to centre of original image
  ctx.translate(centerX, centerY);
  //  Rotate around that centre
  ctx.rotate(rotateRads);
  //  Move image centre back
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(
    image,
    0, // start at x=0 (left edge of original image)
    0, // start at y=0 (top edge of original image)
    image.naturalWidth,
    image.naturalHeight,
    0, //draw starting at x=0 on the canvas
    0, // draw starting at y=0 on the canvas
    image.naturalWidth,
    image.naturalHeight,
  );
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.95);
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Image upload component with drag-and-drop support.
 *
 * Displays a dropzone for image upload and shows a preview of the
 * uploaded image. Supports loading state overlay.
 */
const UploadImage = React.memo(
  ({ displayImage, onImageUpload, isLoading, error }: UploadImageProps) => {
    const [files, setFiles] = useState<File[] | undefined>();
    const [filePreview, setFilePreview] = useState<string | undefined>();

    /**
     * Handles file drop/selection.
     * Reads the file as base64 and notifies parent.
     */
    const handleDrop = useCallback(
      (droppedFiles: File[]) => {
        setFiles(droppedFiles);

        if (droppedFiles.length === 0) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result;
          if (typeof result === "string") {
            setFilePreview(result);
            onImageUpload?.(result);
          }
        };
        reader.readAsDataURL(droppedFiles[0]);
      },
      [onImageUpload],
    );

    const previewSrc = displayImage ?? filePreview;

    return (
      <Dropzone
        accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
        onDrop={handleDrop}
        onError={console.error}
        src={files}
        multiple={false}
        className={
          error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
        }
      >
        <DropzoneEmptyState />
        <DropzoneContent>
          {previewSrc && (
            <div className="w-full flex items-center justify-center py-4 relative">
              <img
                alt="Preview of uploaded image"
                className="max-w-full max-h-96 object-contain rounded-md"
                src={previewSrc}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-soft-black/50 rounded-md z-10">
                  <Spinner
                    variant="pinwheel"
                    className="text-pastel-blue"
                    size={128}
                    style={{ width: "128px", height: "128px" }}
                  />
                </div>
              )}
            </div>
          )}
        </DropzoneContent>
      </Dropzone>
    );
  },
);
UploadImage.displayName = "UploadImage";

/**
 * Toggle switch for enabling/disabling auto-crop feature.
 *
 * Auto-crop uses a YOLO model to detect and extract photo strips
 * from images, applying perspective correction.
 */
const AutoCropSwitch = React.memo(
  ({
    autoCropEnabled,
    onToggle,
    isProcessing,
    imageUploaded,
  }: AutoCropSwitchProps) => {
    // Determine status text to show
    let statusText = "";
    if (isProcessing) {
      statusText = "(Processing...)";
    } else if (!imageUploaded) {
      statusText = "(Upload image first)";
    }

    return (
      <div className="flex items-center gap-3 rounded-lg border bg-background p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue">
          <Brush className="size-5 text-soft-black" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1">
          <div className="flex items-center justify-between gap-4">
            <Label className="font-medium" htmlFor="feature-toggle">
              Enable auto-crop {statusText}
            </Label>
            <Switch
              id="feature-toggle"
              checked={autoCropEnabled}
              onCheckedChange={onToggle}
              disabled={isProcessing || imageUploaded === false}
            />
          </div>
        </div>
      </div>
    );
  },
);
AutoCropSwitch.displayName = "AutoCropSwitch";

// =============================================================================
// Main Component
// =============================================================================

/**
 * Main upload page component.
 *
 * Orchestrates the entire upload flow including image capture, caption entry,
 * delivery timing selection, and final submission. Handles form validation
 * and error display.
 */
export default function UploadPage() {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Period selection state
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodOption>("surprise");
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customPeriod, setCustomPeriod] = useState<string | undefined>();
  const [scheduledSendTime, setScheduledSendTime] = useState<
    Date | undefined
  >();

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null);

  // Image state
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [croppedImage, setCroppedImage] = useState<string | undefined>();

  // Manual Crop State
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [savedCropPct, setSavedCropPct] = useState<Crop | undefined>();

  const imgRef = useRef<HTMLImageElement>(null);

  const [rotation, setRotation] = useState(0);

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");

  // Form state
  const [caption, setCaption] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<
    string | undefined
  >();

  // -------------------------------------------------------------------------
  // Refs for scroll-to-error functionality
  // -------------------------------------------------------------------------
  const imageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  /**
   * Handles image upload from dropzone.
   * Resets crop state and clears validation errors.
   */
  const handleImageUpload = useCallback((base64Image: string) => {
    setOriginalImage(base64Image);
    setCroppedImage(undefined);
    setAutoCropEnabled(false);
    setValidationErrors([]);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    // Reset manual crop state
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSavedCropPct(undefined);
    setRotation(0);
  }, []);

  /**
   * Sends image to RunPod for auto-cropping.
   *
   * @param base64Image - Image to process
   * @returns Cropped image as base64 data URL
   * @throws Error if processing fails
   */
  const processImageWithRunPod = async (
    base64Image: string,
  ): Promise<string> => {
    const response = await fetch("/api/crop-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error ?? `HTTP error! status: ${response.status}`,
      );
    }

    const data = await response.json();
    console.log("📥 Crop API response:", data);

    if (!data.photostrip) {
      throw new Error("No photostrip detected in image");
    }

    return `data:image/png;base64,${data.photostrip}`;
  };

  /**
   * Handles auto-crop toggle.
   * When enabled, processes image through RunPod YOLO model.
   * Caches result to avoid re-processing.
   */
  const handleAutoCropToggle = useCallback(
    async (checked: boolean) => {
      setAutoCropEnabled(checked);

      if (!checked || !originalImage) return;

      // Use cached result if available
      if (croppedImage) {
        console.log("📦 Using cached cropped image from memory");
        // if user triggered from manual dialog close it immediately
        if (isManualCropping) setIsManualCropping(false);
        return;
      }

      setIsCropping(true);
      try {
        const croppedResult = await processImageWithRunPod(originalImage);
        setCroppedImage(croppedResult);
        console.log("✅ Image cropped successfully");

        // if we're currently in manual crop dialog, close it once auto-crop finishes
        if (isManualCropping) {
          setIsManualCropping(false);
        }

        // // Refresh scroll triggers after image changes
        // setTimeout(() => ScrollTrigger.refresh(), 100);
      } catch (error) {
        console.error("❌ Failed to crop image:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        alert(`Failed to crop image: ${errorMessage}\n\nPlease try again.`);
        setAutoCropEnabled(false);
      } finally {
        setIsCropping(false);
      }
    },
    [originalImage, croppedImage, isManualCropping],
  );

  /**
   * Handles saving the manual crop from the modal
   */
  const handleSaveManualCrop = useCallback(async () => {
    if (
      completedCrop &&
      imgRef.current &&
      completedCrop.width > 0 &&
      completedCrop.height > 0
    ) {
      try {
        const croppedBase64 = await canvasPreview(
          imgRef.current,
          completedCrop,
          rotation,
        );
        setCroppedImage(croppedBase64);
        // Persist current crop in % so dialog can restore it next time
        setSavedCropPct(crop);
        setIsManualCropping(false);
        setAutoCropEnabled(false);
        console.log("✅ Manual crop saved");
      } catch (e) {
        console.error("Failed to crop", e);
        alert("Something went wrong while cropping. Please try again.");
      }
    } else {
      // If user clicked apply without moving the crop box, or dimensions are 0
      // We can just close the modal if they didn't really crop, or alert them.
      setIsManualCropping(false);
    }
  }, [completedCrop, crop, rotation]);

  /**
   * Handles resetting to the original image
   */
  const handleResetCropInDialog = useCallback(() => {
    setRotation(0);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  /**
   * Initializes default crop when image loads in modal
   */
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;

    if (savedCropPct) {
      // Restore the last-applied crop (stored as %, valid at any display size)
      setCrop(savedCropPct);
    } else {
      // First time — start with a centred 80%-wide default
      const initialCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 80 }, width / height, width, height),
        width,
        height,
      );
      setCrop(initialCrop);
    }
  }

  /**
   * Handles period selection from PeriodPicker.
   * Calculates appropriate send time based on selection.
   */
  const handleRotationChange = useCallback((degrees: number) => {
    setRotation(degrees);
  }, []);

  const handlePeriodSelect = useCallback(
    (period: PeriodOption, date?: Date) => {
      setSelectedPeriod(period);

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const sendTime = computeScheduledSendTime(period, timezone, date);

      if (!sendTime) {
        setScheduledSendTime(undefined);
        setCustomDate(undefined);
        setCustomPeriod(undefined);
        return;
      }

      if (period === "custom date") {
        setCustomDate(sendTime);
      } else if (period === "custom period") {
        setCustomPeriod(sendTime.toISOString());
      }

      setScheduledSendTime(sendTime);
      setValidationErrors([]);
      setFieldErrors((prev) => ({ ...prev, period: undefined }));
    },
    [],
  );

  /**
   * Handles delivery method selection.
   * Updates method and clears validation errors.
   */
  const handleDeliveryMethodSelect = useCallback(
    (method: DeliveryMethod, value?: string) => {
      setDeliveryMethod(method);
      setDeliveryAddress(value ?? "");
      setValidationErrors([]);
      setFieldErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Form Submission
  // -------------------------------------------------------------------------

  /**
   * Zod schema for form validation.
   * Validates all required fields before submission.
   */
  const SnapSchema = z
    .object({
      Image: z.string().min(1, "Image is required"),
      Caption: z.string().min(1, "Caption is required"),
      sendTime: z.date(),
      deliveryMethod: z.enum(["email", "telegram"]),
      Delivery_Address: z.string(),
    })
    .refine(
      (data) => {
        // Email requires valid email address; Telegram uses chat_id instead
        if (data.deliveryMethod === "email") {
          return z.string().email().safeParse(data.Delivery_Address).success;
        }
        return true;
      },
      {
        message: "Invalid email address",
        path: ["Delivery_Address"],
      },
    );

  /**
   * Maps validation errors to user-friendly field error messages.
   */
  const mapValidationErrors = (
    issues: z.ZodIssue[],
    period: PeriodOption,
  ): FieldErrors => {
    const errors: FieldErrors = {};

    issues.forEach((issue) => {
      const field = issue.path[0];

      switch (field) {
        case "Image":
          errors.image = "Please upload a photo before continuing";
          break;
        case "Caption":
          errors.caption = "Please add a caption for your photo";
          break;
        case "sendTime":
          if (period === "custom period") {
            errors.period = "Please select a time period for delivery";
          } else if (period === "custom date") {
            errors.period = "Please select a specific date for delivery";
          } else {
            errors.period = "Please select when to deliver your memory";
          }
          break;
        case "Delivery_Address":
          errors.deliveryAddress = "Please enter a valid email address";
          break;
      }
    });

    return errors;
  };

  /**
   * Scrolls to the first field with an error.
   */
  const scrollToFirstError = (errors: FieldErrors): void => {
    setTimeout(() => {
      if (errors.image && imageRef.current) {
        imageRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (errors.caption && captionRef.current) {
        captionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (errors.period && periodRef.current) {
        periodRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (errors.deliveryAddress && deliveryRef.current) {
        deliveryRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
  };

  /**
   * Handles form submission.
   *
   * Process flow:
   * 1. Validate all form fields
   * 2. Compress image if needed
   * 3. Upload to server for encryption
   * 4. Save snap metadata to database
   * 5. Show success confirmation / open Telegram
   */
  const handleStartProcessing = async (): Promise<void> => {
    setValidationErrors([]);
    setFieldErrors({});

    // Validate form data
    const validationResult = SnapSchema.safeParse({
      Image: originalImage ?? "",
      Caption: caption,
      sendTime: scheduledSendTime,
      deliveryMethod: deliveryMethod,
      Delivery_Address: deliveryAddress,
    });

    if (!validationResult.success) {
      const errors = mapValidationErrors(
        validationResult.error.issues,
        selectedPeriod,
      );
      setFieldErrors(errors);
      scrollToFirstError(errors);
      return;
    }

    // Validate Turnstile CAPTCHA token
    if (!turnstileToken) {
      alert("⚠️ Please complete the CAPTCHA verification before submitting.");
      return;
    }

    // Start processing without pre-opening any tabs
    setValidationErrors([]);
    setIsProcessing(true);

    try {
      console.log("✅ All inputs valid. Starting processing...");

      // Select image source.
      // If a manual crop or auto crop resulted in croppedImage, use that.
      // Otherwise use original.
      const imageToUpload = croppedImage ? croppedImage : originalImage;

      // Step 1: Compress image
      console.log("🗜️ Compressing image...");
      const compressedImage = await compressImage(imageToUpload!);
      console.log("✅ Image compressed");

      console.log(`📅 Scheduled for: ${scheduledSendTime?.toLocaleString()}`);

      // Step 2: Upload and encrypt
      console.log("🔐 Uploading to server for encryption...");
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: compressedImage,
          caption: caption,
          turnstileToken: turnstileToken,
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error ?? "Failed to upload image");
      }

      const { storagePath, encryptedCaption, captionIv, imageIv, uploadNonce } =
        await uploadResponse.json();
      console.log("✅ Encrypted and stored at:", storagePath);

      // Step 3: Save metadata to database
      console.log("💾 Saving snap metadata...");
      const createSnapResponse = await fetch("/api/create-snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          encryptedCaption,
          captionIv,
          imageIv,
          scheduledSendTime: scheduledSendTime?.toISOString(),
          deliveryMethod,
          deliveryAddress,
          periodType: selectedPeriod,
          uploadNonce,
        }),
      });

      if (!createSnapResponse.ok) {
        const errorData = await createSnapResponse.json();
        throw new Error(errorData.error ?? "Failed to save snap metadata");
      }

      const snapData = await createSnapResponse.json();
      console.log("🎉 Snap saved successfully:", snapData.snap?.id);

      // Show success page for both email and telegram
      if (snapData.snap?.id) {
        if (deliveryMethod === "telegram") {
          const botUsername =
            process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "RestripBot";
          const telegramLink = `https://t.me/${botUsername}?start=snap_${snapData.snap.id}_${snapData.snap.telegram_link_token}`;
          setTelegramBotLink(telegramLink);
        }
        setIsSuccess(true);
      } else {
        throw new Error("No snap ID returned");
      }
    } catch (error) {
      console.error("❌ Processing failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Processing failed";
      setValidationErrors([errorMessage]);
    } finally {
      setIsProcessing(false);

      // Reset Turnstile widget to generate a new token for next submission
      if (turnstileWidgetId && window.turnstile) {
        console.log("Resetting Turnstile widget...");
        window.turnstile.reset(turnstileWidgetId);
        setTurnstileToken(null);
      }
    }
  };

  /**
   * Resets the form to initial state after successful submission.
   */
  const resetForm = useCallback((): void => {
    setOriginalImage(undefined);
    setCroppedImage(undefined);
    setCaption("");
    setDeliveryAddress("");
    setResetKey((prev) => prev + 1);
    setRotation(0);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSavedCropPct(undefined);
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // /**
  //  * Refresh ScrollTrigger when image changes.
  //  */
  // useEffect(() => {
  //   if (originalImage) {
  //     const timeoutId = setTimeout(() => ScrollTrigger.refresh(), 100);
  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [originalImage]);

  /**
   * Initialize with surprise period on mount.
   */
  useEffect(() => {
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  // /**
  //  * Reset errors and refresh ScrollTrigger on mount.
  //  */
  // useEffect(() => {
  //   setValidationErrors([]);
  //   setFieldErrors({});

  //   const timeoutId = setTimeout(() => ScrollTrigger.refresh(), 500);
  //   return () => clearTimeout(timeoutId);
  // }, []);

  /**
   * Load UserJot feedback widget SDK.
   */
  useEffect(() => {
    return loadUserJot(USERJOT_CONFIG_ID);
  }, []);

  /**
   * Load Cloudflare Turnstile CAPTCHA script and initialize widget.
   * Uses explicit rendering for SPA compatibility.
   * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
   */
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.warn("Turnstile site key not configured");
      return;
    }

    let widgetId: string | undefined;

    // Function to render/re-render the Turnstile widget
    const renderWidget = () => {
      if (!window.turnstile) {
        console.warn("Turnstile not loaded yet");
        return;
      }

      const container = document.getElementById("turnstile-widget");
      if (!container) {
        console.error("Turnstile container not found");
        return;
      }

      // Remove old widget if it exists
      if (widgetId && window.turnstile) {
        console.log("Removing old widget:", widgetId);
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          console.warn("Failed to remove old widget:", e);
        }
      }

      console.log("Initializing Turnstile widget...");
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => {
          console.log("✅ Turnstile token received");
          setTurnstileToken(token);
        },
        "error-callback": () => {
          console.error("❌ Turnstile error");
          setTurnstileToken(null);
        },
        "expired-callback": () => {
          console.warn("⚠️ Turnstile token expired");
          setTurnstileToken(null);
        },
        theme: "light",
      });
      console.log("Turnstile widget rendered with ID:", widgetId);
      setTurnstileWidgetId(widgetId);
    };

    // Define onload callback before loading script
    const callbackName = `onTurnstileLoad_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = renderWidget;

    // Check if Turnstile is already loaded
    if (window.turnstile) {
      console.log("Turnstile already loaded, rendering widget");
      renderWidget();
    } else {
      // Load Turnstile script with explicit rendering
      const script = document.createElement("script");
      script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${callbackName}`;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          console.warn("Failed to remove widget on unmount:", e);
        }
      }
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };
  }, [isSuccess]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Show success screen if submission was successful
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-display text-3xl font-bold text-soft-black mb-3">
            All Set! 🎉
          </h1>
          {telegramBotLink ? (
            <>
              <p className="text-grey mb-4">
                Your memory will be delivered via Telegram in time to come.
                Start the bot below to confirm you will receive it.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.open(telegramBotLink, "_blank", "noopener,noreferrer");
                }}
                className="w-full mb-4 px-4 py-3 bg-[#229ED9] text-white rounded-lg hover:bg-[#1e8bc3] transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.154.232.17.326.016.094.036.308.02.475z" />
                </svg>
                Start Telegram Bot
              </button>
            </>
          ) : (
            <p className="text-grey mb-4">
              Your memory will be delivered to your email address in time to
              come.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setTelegramBotLink(null);
              setTurnstileToken(null);
              resetForm();
              // Widget will be re-rendered by useEffect when isSuccess changes
            }}
            className="w-full px-4 py-2 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-medium"
          >
            Create Another Memory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-beige">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        {/* Back Button */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-soft-black hover:text-accent-red transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-soft-black mb-2">
            Quick Send
          </h1>
        </div>

        {/* Upload Card */}
        <div className="max-w-2xl mx-auto">
          <div className="text-center bg-white rounded-lg shadow-card hover:shadow-card-hover p-8 transition-shadow">
            {/* Upload Area */}
            <div>
              <h3 className="font-display text-xl font-bold text-soft-black mb-1">
                1. take photo/upload your photo strip
              </h3>
            </div>
            <div className="mt-6 flex gap-4 justify-center" ref={imageRef}>
              <UploadImage
                key={resetKey}
                displayImage={croppedImage ? croppedImage : undefined}
                onImageUpload={handleImageUpload}
                isLoading={isCropping}
                error={!!fieldErrors.image}
              />
            </div>

            {originalImage && (
              <div className="flex gap-3 justify-center mt-4 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsManualCropping(true);
                  }}
                  className="gap-2"
                >
                  <CropIcon size={16} />
                  {croppedImage ? "Re-crop" : "Crop & Straighten"}
                </Button>
              </div>
            )}

            {fieldErrors.image && (
              <div className="mt-2 mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{fieldErrors.image}</p>
              </div>
            )}

            {/* Journal Caption */}
            <div>
              <h3 className="font-display text-xl font-bold text-soft-black mt-6">
                2. write a caption
              </h3>
            </div>
            <div className="mt-6 flex gap-4 justify-center" ref={captionRef}>
              <Textarea
                placeholder="Write a message to your future self..."
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  if (validationErrors.length > 0) {
                    setValidationErrors([]);
                  }
                  setFieldErrors((prev) => ({ ...prev, caption: undefined }));
                }}
                className={
                  fieldErrors.caption
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : ""
                }
              />
            </div>
            {fieldErrors.caption && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{fieldErrors.caption}</p>
              </div>
            )}

            {/* Period Picker */}
            <div>
              <h3 className="font-display text-xl font-bold text-soft-black mt-6">
                3. deliver random email in/on
              </h3>
            </div>
            <div className="mt-6 flex gap-4 justify-center" ref={periodRef}>
              <PeriodPicker onSelect={handlePeriodSelect} />
            </div>
            {fieldErrors.period && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{fieldErrors.period}</p>
              </div>
            )}

            {/* Delivery Method */}
            <div>
              <h3 className="font-display text-xl font-bold text-soft-black mt-6">
                4. where to send your memory
              </h3>
            </div>
            <div className="mt-4 flex gap-4 justify-center" ref={deliveryRef}>
              <DeliveryMethodPicker
                onSelect={handleDeliveryMethodSelect}
                error={!!fieldErrors.deliveryAddress}
              />
            </div>
            {fieldErrors.deliveryAddress && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">
                  {fieldErrors.deliveryAddress}
                </p>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-red-700 text-sm">
                    {error}
                  </p>
                ))}
              </div>
            )}

            {/* Turnstile CAPTCHA Widget */}
            <div className="mt-6 flex justify-center">
              <div id="turnstile-widget"></div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing || !turnstileToken}
              className="w-full mt-8 bg-blush-pink text-soft-black rounded-md min-h-button font-body font-semibold hover:bg-yellow-cream transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Spinner
                    variant="pinwheel"
                    size={16}
                    className="text-warm-beige"
                  />
                  One day, you&apos;ll open this and smile...
                </>
              ) : !turnstileToken ? (
                "Completing CAPTCHA..."
              ) : (
                "Deliver to the Future!"
              )}
            </button>

            {/* Buy Me a Coffee Button */}
            <div className="mt-6 flex justify-center items-center w-full">
              <a
                href="https://www.buymeacoffee.com/bjh21"
                className="hover:-translate-y-0.5 transition-all inline-block"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=bjh21&button_colour=fff2c9&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00"
                  alt="Buy me a coffee"
                  className="h-[40px] w-auto md:h-[50px]"
                  loading="lazy"
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isManualCropping} onOpenChange={setIsManualCropping}>
        <DialogContent className="z-50 max-w-[95vw] md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>Crop &amp; Straighten your photo strip</DialogTitle>
          </DialogHeader>

          <div className="px-4 pt-3 pb-2 border-b shrink-0 flex flex-col gap-2">
            {/* Auto-crop toggle inside dialog */}
            {originalImage && (
              <AutoCropSwitch
                autoCropEnabled={autoCropEnabled}
                onToggle={handleAutoCropToggle}
                isProcessing={isCropping}
                imageUploaded={!!originalImage || !!croppedImage}
              />
            )}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="rotation-slider">
                Rotation: {rotation > 0 ? `+${rotation}` : rotation}°
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetCropInDialog}
                className="gap-1.5 text-xs h-7 px-2"
              >
                <RotateCcw size={13} />
                Reset
              </Button>
            </div>
            <input
              id="rotation-slider"
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={rotation}
              onChange={(e) => handleRotationChange(Number(e.target.value))}
              className="w-full accent-pastel-blue"
            />{" "}
            <div className="flex justify-between text-xs text-muted-foreground select-none">
              <span>−180°</span>
              <span>0°</span>
              <span>+180°</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-zinc-100/50 p-4 relative">
            {originalImage && (
              <ReactCrop
                crop={crop}
                onChange={(c, pct) => {
                  setCrop(pct);
                }}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  src={originalImage}
                  alt="Rotate and crop"
                  onLoad={onImageLoad}
                  style={{
                    maxHeight: "55vh",
                    maxWidth: "100%",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    transform: `rotate(${rotation}deg)`,
                    transition: "transform 0.05s linear",
                  }}
                />
              </ReactCrop>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-white gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsManualCropping(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveManualCrop}>
              Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer Section */}
      <footer className="bg-soft-black text-warm-beige py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️.
          </p>
          <div className="mt-3 flex justify-center space-x-4">
            <a
              href="/privacy-policy"
              className="text-warm-beige hover:underline text-xs"
            >
              Privacy Policy
            </a>
            <a
              href="/contact"
              className="text-warm-beige hover:underline text-xs"
            >
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
