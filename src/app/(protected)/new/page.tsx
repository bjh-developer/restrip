/**
 * Authenticated Upload Page (/new)
 *
 * Allows signed-in users to create memories that are saved
 * to their gallery.
 *
 * Key differences from anonymous /upload:
 * - Uploads stored under user's folder: {userId}/...
 * - Snap records have user_id set
 * - Optional delivery (email/telegram)
 * - Auth managed by Clerk
 *
 * @module app/(protected)/new/page
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, Brush, CircleAlert, Check } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";
import imageCompression from "browser-image-compression";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PeriodPicker, type PeriodOption } from "../../../components/PeriodPicker";
import {
  DeliveryMethodPicker,
  type DeliveryMethod,
} from "../../../components/DeliveryMethodPicker";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../../components/ui/shadcn-io/spinner";
import { useUser } from "@clerk/nextjs";
import * as z from "zod";

// =============================================================================
// Constants
// =============================================================================

/** Maximum file size before compression (in MB) */
const COMPRESSION_THRESHOLD_MB = 3;

/** Target maximum file size after compression (in MB) */
const COMPRESSION_TARGET_MB = 3;

/** Maximum image dimension after compression */
const MAX_IMAGE_DIMENSION = 2048;

/** Initial quality for image compression (0-1) */
const COMPRESSION_QUALITY = 0.9;

/** Default delivery time (6 PM local time) */
const DEFAULT_DELIVERY_HOUR = 18;

/** Minimum days for surprise delivery */
const SURPRISE_MIN_DAYS = 30;

/** Maximum days for surprise delivery */
const SURPRISE_MAX_DAYS = 180;

/** Milliseconds in one day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds in one hour */
const MS_PER_HOUR = 60 * 60 * 1000;

/** Storage bucket name */
const STORAGE_BUCKET = "encrypted-images";

// =============================================================================
// GSAP Setup
// =============================================================================

try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered
}

// =============================================================================
// Types
// =============================================================================

/** Field-specific validation error messages */
interface FieldErrors {
  image?: string;
  caption?: string;
  period?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Converts a base64 data URL to a Blob (CSP-friendly).
 * Returns null if input is malformed.
 */
function base64ToBlob(base64: string): Blob | null {
  try {
    const parts = base64.split(",");
    if (parts.length < 2) {
      console.error("Invalid base64: missing comma separator");
      return null;
    }
    
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch?.[1] ?? "image/jpeg";
    
    const base64Data = parts[1];
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
      console.error("Invalid base64: contains illegal characters");
      return null;
    }
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (error) {
    console.error("base64ToBlob error:", error);
    return null;
  }
}

/**
 * Compresses an image to reduce file size before encryption.
 */
async function compressImage(base64Image: string): Promise<string> {
  try {
    const blob = base64ToBlob(base64Image);
    if (!blob) {
      console.warn("Failed to convert base64 to blob, using original");
      return base64Image;
    }
    const sizeInMB = blob.size / 1024 / 1024;
    if (sizeInMB <= COMPRESSION_THRESHOLD_MB) return base64Image;

    const file = new File([blob], "image.jpg", { type: blob.type });
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: COMPRESSION_TARGET_MB,
      maxWidthOrHeight: MAX_IMAGE_DIMENSION,
      useWebWorker: true,
      initialQuality: COMPRESSION_QUALITY,
    });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedBlob);
    });
  } catch {
    return base64Image;
  }
}

/** Calculates send time from a selected date */
function calculateSendTime(selectedDate: Date): Date {
  const now = new Date();
  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();

  if (!isToday) {
    const sendTime = new Date(selectedDate);
    sendTime.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
    return sendTime;
  }

  if (now.getHours() >= DEFAULT_DELIVERY_HOUR) {
    const oneHourFromNow = new Date(now.getTime() + MS_PER_HOUR);
    if (oneHourFromNow.getDate() === now.getDate()) return oneHourFromNow;
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);
    return endOfDay;
  }

  const sixPm = new Date(selectedDate);
  sixPm.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
  return sixPm;
}

/** Generates a random surprise date */
function generateSurpriseDate(): Date {
  const now = new Date();
  const randomDays =
    Math.floor(Math.random() * (SURPRISE_MAX_DAYS - SURPRISE_MIN_DAYS + 1)) +
    SURPRISE_MIN_DAYS;
  const sendTime = new Date(now.getTime() + randomDays * MS_PER_DAY);
  sendTime.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
  return sendTime;
}

// =============================================================================
// Sub-components
// =============================================================================

/** Image upload with drag-and-drop */
const UploadImage = React.memo(
  ({
    displayImage,
    onImageUpload,
    isLoading,
    error,
  }: {
    displayImage?: string;
    onImageUpload?: (base64Image: string) => void;
    isLoading?: boolean;
    error?: boolean;
  }) => {
    const [files, setFiles] = useState<File[] | undefined>();
    const [filePreview, setFilePreview] = useState<string | undefined>();

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
        className={error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}
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

/** Auto-crop toggle switch */
const AutoCropSwitch = React.memo(
  ({
    autoCropEnabled,
    onToggle,
    isProcessing,
    imageUploaded,
  }: {
    autoCropEnabled: boolean;
    onToggle: (checked: boolean) => void;
    isProcessing: boolean;
    imageUploaded?: boolean;
  }) => (
    <div className="flex items-center gap-3 mt-3">
      <Switch
        id="auto-crop"
        checked={autoCropEnabled}
        onCheckedChange={onToggle}
        disabled={isProcessing || !imageUploaded}
      />
      <Label
        htmlFor="auto-crop"
        className={`flex items-center gap-2 text-sm cursor-pointer ${
          !imageUploaded ? "text-gray-400" : "text-gray-600"
        }`}
      >
        <Brush className="w-4 h-4" />
        {isProcessing ? "Processing..." : "Auto-detect & crop photo strip"}
      </Label>
    </div>
  ),
);
AutoCropSwitch.displayName = "AutoCropSwitch";

// =============================================================================
// Main Page Component
// =============================================================================

export default function NewMemoryPage() {
  const router = useRouter();
  const { user } = useUser();

  // Form state
  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [croppedImage, setCroppedImage] = useState<string | undefined>();
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("surprise");
  const [scheduledSendTime, setScheduledSendTime] = useState<Date | undefined>();
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customPeriod, setCustomPeriod] = useState<string | undefined>();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<z.ZodIssue[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const formRef = useRef<HTMLFormElement>(null);

  // =========================================================================
  // Event handlers
  // =========================================================================

  const handleImageUpload = useCallback((base64Image: string) => {
    setOriginalImage(base64Image);
    setCroppedImage(undefined);
    setAutoCropEnabled(false);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
  }, []);

  /** Process image with RunPod for auto-cropping */
  const handleAutoCropToggle = useCallback(
    async (checked: boolean) => {
      setAutoCropEnabled(checked);
      if (!checked || !originalImage) return;
      if (croppedImage) return;

      setIsCropping(true);
      try {
        const response = await fetch("/api/crop-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: originalImage }),
        });
        if (!response.ok) throw new Error("Crop failed");
        const data = await response.json();
        if (!data.photostrip) throw new Error("No photostrip detected");
        setCroppedImage(`data:image/png;base64,${data.photostrip}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        alert(`Failed to crop: ${msg}`);
        setAutoCropEnabled(false);
      } finally {
        setIsCropping(false);
      }
    },
    [originalImage, croppedImage],
  );

  const handlePeriodSelect = useCallback(
    (period: PeriodOption, date?: Date) => {
      setSelectedPeriod(period);
      if (date) {
        const sendTime = calculateSendTime(date);
        if (period === "custom date") setCustomDate(sendTime);
        if (period === "custom period") setCustomPeriod(sendTime.toISOString());
        setScheduledSendTime(sendTime);
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else if (period === "surprise") {
        setScheduledSendTime(generateSurpriseDate());
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else {
        setScheduledSendTime(undefined);
        setCustomDate(undefined);
        setCustomPeriod(undefined);
      }
    },
    [],
  );

  const handleDeliveryMethodSelect = useCallback(
    (method: DeliveryMethod, value?: string) => {
      setDeliveryMethod(method);
      setDeliveryAddress(value ?? "");
    },
    [],
  );

  // =========================================================================
  // Effects
  // =========================================================================

  /**
   * Initialize with surprise period on mount so scheduledSendTime is set.
   */
  useEffect(() => {
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  // =========================================================================
  // Form submission
  // =========================================================================

  /** Zod schema for form validation */
  const SnapSchema = z.object({
    Image: z.string().min(1, "Image is required"),
    Caption: z.string().min(1, "Caption is required"),
    sendTime: z.date(),
    deliveryMethod: z.enum(["email", "telegram"]),
  });

  const mapValidationErrors = (issues: z.ZodIssue[]): FieldErrors => {
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
          errors.period = "Please select when to deliver your memory";
          break;
      }
    });
    return errors;
  };

  /**
   * Submit handler — encrypts client-side and uploads to storage.
   *
   * Flow:
   * 1. Validate form with Zod
   * 2. Compress image
   * 3. Upload image to storage (via authenticated API)
   * 4. Create snap record with user_id
   */
  const handleStartProcessing = async () => {
    if (isSubmitting) return;

    // Guard: Ensure user is authenticated
    if (!user || !user.primaryEmailAddress?.emailAddress) {
      alert("Session expired. Please sign in again.");
      router.push("/sign-in");
      return;
    }

    const imageToSubmit = autoCropEnabled && croppedImage ? croppedImage : originalImage;

    // Validate
    const validation = SnapSchema.safeParse({
      Image: imageToSubmit ?? "",
      Caption: caption,
      sendTime: scheduledSendTime,
      deliveryMethod,
    });

    if (!validation.success) {
      setValidationErrors(validation.error.issues);
      setFieldErrors(mapValidationErrors(validation.error.issues));
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);
    setFieldErrors({});

    try {
      // Step 1: Compress image
      console.log("📦 Compressing image...");
      const compressed = await compressImage(imageToSubmit!);

      // Step 2: Upload image to storage
      const userEmail = user.primaryEmailAddress.emailAddress;

      console.log("☁️ Uploading encrypted image...");
      const uploadResponse = await fetch("/api/upload/authenticated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: compressed,
          caption,
          scheduledSendTime: scheduledSendTime!.toISOString(),
          deliveryMethod,
          deliveryAddress: deliveryMethod === "email" ? userEmail : deliveryAddress,
          periodType: selectedPeriod,
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error ?? "Upload failed");
      }

      const responseData = await uploadResponse.json();
      console.log("✅ Memory created successfully!");

      // Store telegram bot link if telegram delivery was selected
      if (deliveryMethod === "telegram" && responseData.snap?.id) {
        const botUsername =
          process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "RestripBot";
        const telegramLink = `https://t.me/${botUsername}?start=snap_${responseData.snap.id}_${responseData.snap.telegram_link_token}`;
        setTelegramBotLink(telegramLink);
      }

      setIsSuccess(true);
    } catch (error) {
      console.error("❌ Upload error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create memory. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // Success state
  // =========================================================================

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-display text-3xl font-bold text-soft-black mb-3">
            Memory Created! 🎉
          </h1>
          <p className="text-grey mb-2">
            Your photo strip has been saved to your gallery.
          </p>
          {telegramBotLink ? (
            <>
              <p className="text-grey mb-4">
                To receive your memory, please start the Telegram bot by clicking the button below.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.open(telegramBotLink, "_blank", "noopener,noreferrer");
                }}
                className="w-full mb-4 px-4 py-3 bg-[#229ED9] text-white rounded-lg hover:bg-[#1e8bc3] transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.154.232.17.326.016.094.036.308.02.475z" />
                </svg>
                Start Telegram Bot
              </button>
            </>
          ) : (
            <p className="text-grey mb-4">
              Your memory will be delivered to you soon...
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/gallery")}
              className="px-4 py-2 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-medium"
            >
              View Gallery
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setTelegramBotLink(null);
                setOriginalImage(undefined);
                setCroppedImage(undefined);
                setCaption("");
                setDeliveryAddress("");
                handlePeriodSelect("surprise");
              }}
              className="px-4 py-2 bg-white border border-mist-grey text-soft-black rounded-lg hover:bg-mist-grey/30 transition text-sm font-medium"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Form render
  // =========================================================================

  const displayImage = autoCropEnabled && croppedImage ? croppedImage : originalImage;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-soft-black mb-2">
            New Memory
          </h1>
        </div>

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleStartProcessing();
          }}
          className="space-y-6"
        >
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-soft-black mb-2">
              Photo Strip
            </label>
            <UploadImage
              displayImage={displayImage}
              onImageUpload={handleImageUpload}
              isLoading={isCropping}
              error={!!fieldErrors.image}
            />
            <AutoCropSwitch
              autoCropEnabled={autoCropEnabled}
              onToggle={handleAutoCropToggle}
              isProcessing={isCropping}
              imageUploaded={!!originalImage}
            />
            {fieldErrors.image && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
                {fieldErrors.image}
              </p>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-soft-black mb-2">
              Caption
            </label>
            <Textarea
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setFieldErrors((prev) => ({ ...prev, caption: undefined }));
              }}
              placeholder="Write a message to your future self..."
              className={`resize-none ${fieldErrors.caption ? "border-red-300" : ""}`}
              rows={3}
            />
            {fieldErrors.caption && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
                {fieldErrors.caption}
              </p>
            )}
          </div>

          {/* Period Picker */}
          <div>
            <label className="block text-sm font-medium text-soft-black mb-2">
              When to deliver
            </label>
            <PeriodPicker onSelect={handlePeriodSelect} />
            {fieldErrors.period && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
                {fieldErrors.period}
              </p>
            )}
          </div>

          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-medium text-soft-black mb-2">
              How to deliver
            </label>
            <DeliveryMethodPicker onSelect={handleDeliveryMethodSelect} hideEmailInput />
            {deliveryMethod === "email" && (
              <p className="mt-2 text-xs text-grey flex items-center gap-1">
                Will be sent to: {user?.primaryEmailAddress?.emailAddress}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner variant="pinwheel" size={16} className="text-warm-beige" />
                Encrypting & Uploading...
              </>
            ) : (
              "Create Memory"
            )}
          </button>

          {/* Validation errors summary */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600 text-center">
                Please fix the highlighted fields above.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
