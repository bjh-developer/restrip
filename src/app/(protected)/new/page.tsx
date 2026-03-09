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

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@clerk/nextjs";
import imageCompression from "browser-image-compression";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Brush,
  Check,
  CircleAlert,
  Crop as CropIcon,
  RotateCcw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { mutate } from "swr";
import { WebHaptics, defaultPatterns } from "web-haptics";
import * as z from "zod";
import {
  DeliveryMethodPicker,
  type DeliveryMethod,
} from "../../../components/DeliveryMethodPicker";
import {
  PeriodPicker,
  type PeriodOption,
} from "../../../components/PeriodPicker";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../../components/ui/shadcn-io/spinner";
import { computeScheduledSendTime } from "../../../lib/delivery-scheduling";

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

// helper for manual cropping – draw rotated crop area to canvas
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
  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
  );
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.95);
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
    // Pass a non-undefined src when we have a preview image so DropzoneContent
    // renders even when no file was dropped (e.g. prefill from sessionStorage).
    const dropzoneSrc = files ?? (previewSrc ? ([] as File[]) : undefined);

    return (
      <Dropzone
        accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
        onDrop={handleDrop}
        onError={console.error}
        src={dropzoneSrc}
        multiple={false}
        className={
          error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
        }
      >
        <DropzoneEmptyState />
        <DropzoneContent>
          {previewSrc && (
            <div className="w-full flex items-center justify-center py-4 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
  }) => {
    const haptics = useMemo(() => new WebHaptics(), []);

    return (
      <div className="flex items-center gap-3 mt-3">
        <Switch
          onClick={() => {
            void haptics.trigger(defaultPatterns.selection);
          }}
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
          {isProcessing ? "Processing..." : "Enable auto-crop"}
        </Label>
      </div>
    );
  },
);
AutoCropSwitch.displayName = "AutoCropSwitch";

// =============================================================================
// Main Page Component
// =============================================================================

function NewMemoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  // Form state
  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [croppedImage, setCroppedImage] = useState<string | undefined>();
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  // manual crop state
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [savedCropPct, setSavedCropPct] = useState<Crop | undefined>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [rotation, setRotation] = useState(0);
  const [caption, setCaption] = useState("");
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodOption>("surprise");
  const [scheduledSendTime, setScheduledSendTime] = useState<
    Date | undefined
  >();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [prefillKey, setPrefillKey] = useState(0);
  const [prefillPeriodDate, setPrefillPeriodDate] = useState<
    Date | undefined
  >();
  const [prefillPeriodRange, setPrefillPeriodRange] = useState<
    { from: Date; to: Date } | undefined
  >();
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [isPrefilling, setIsPrefilling] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<z.ZodIssue[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<{
    user: string;
    detail?: string;
  } | null>(null);

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
      if (croppedImage) {
        if (isManualCropping) setIsManualCropping(false);
        return;
      }

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
        if (isManualCropping) setIsManualCropping(false);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setSubmitError({
          user: "Oops, auto-crop failed. You can crop manually instead.",
          detail,
        });
        setAutoCropEnabled(false);
      } finally {
        setIsCropping(false);
      }
    },
    [originalImage, croppedImage, isManualCropping],
  );

  const handleRotationChange = useCallback((degrees: number) => {
    setRotation(degrees);
  }, []);

  const handleResetCropInDialog = useCallback(() => {
    setRotation(0);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    if (savedCropPct) {
      setCrop(savedCropPct);
    } else {
      const initialCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 80 }, width / height, width, height),
        width,
        height,
      );
      setCrop(initialCrop);
    }
  }

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
        setSavedCropPct(crop);
        setIsManualCropping(false);
        setAutoCropEnabled(false);
      } catch (e) {
        setIsManualCropping(false);
        setSubmitError({
          user: "Sorry, could not apply the crop. Please try again.",
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    } else {
      setIsManualCropping(false);
    }
  }, [completedCrop, crop, rotation]);

  const handlePeriodSelect = useCallback(
    (period: PeriodOption, date?: Date, _range?: { from: Date; to: Date }) => {
      setSelectedPeriod(period);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const sendTime = computeScheduledSendTime(period, timezone, date);
      if (!sendTime) {
        setScheduledSendTime(undefined);
        return;
      }

      setScheduledSendTime(sendTime);
      setFieldErrors((prev) => ({ ...prev, period: undefined }));
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

  /**
   * Restore form state from DB if redirected from /upload sign-up flow.
   * Reads prefill_token from URL, fetches saved form data, and fills state.
   */
  useEffect(() => {
    const token = searchParams.get("prefill_token");
    if (!token) return;

    const controller = new AbortController();
    setIsPrefilling(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/pending-upload?token=${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const { formData: data } = await res.json();
        if (!data) return;

        // Only update URL and state after a successful fetch
        const url = new URL(window.location.href);
        url.searchParams.delete("prefill_token");
        window.history.replaceState({}, "", url.pathname + url.search);

        if (data.image) setOriginalImage(data.image);
        if (data.caption) setCaption(data.caption);
        if (data.selectedPeriod) {
          setSelectedPeriod(data.selectedPeriod);
          if (data.scheduledSendTime) {
            setScheduledSendTime(new Date(data.scheduledSendTime));
          }
          // Restore calendar display state for custom date / custom period
          if (
            data.selectedPeriod === "custom date" &&
            data.customSelectedDate
          ) {
            setPrefillPeriodDate(new Date(data.customSelectedDate));
          } else if (
            data.selectedPeriod === "custom period" &&
            data.customPeriodRange
          ) {
            setPrefillPeriodRange({
              from: new Date(data.customPeriodRange.from),
              to: new Date(data.customPeriodRange.to),
            });
            if (data.scheduledSendTime) {
              setPrefillPeriodDate(new Date(data.scheduledSendTime));
            }
          }
        }
        if (data.deliveryMethod) setDeliveryMethod(data.deliveryMethod);
        if (data.deliveryAddress) setDeliveryAddress(data.deliveryAddress);
        // Bump key to remount pickers so their internal defaultValue is applied
        setPrefillKey((k) => k + 1);
      } catch (err) {
        // Swallow AbortError (unmount) — ignore other fetch failures
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setIsPrefilling(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSubmitError({
        user: "Your session has expired :/ Please sign in again.",
      });
      router.push("/sign-in");
      return;
    }

    const imageToSubmit =
      autoCropEnabled && croppedImage ? croppedImage : originalImage;

    // Validate
    const validation = SnapSchema.safeParse({
      Image: imageToSubmit ?? "",
      Caption: caption,
      sendTime: scheduledSendTime,
      deliveryMethod,
    });

    const haptics = new WebHaptics();

    if (!validation.success) {
      void haptics.trigger(defaultPatterns.error);
      setValidationErrors(validation.error.issues);
      setFieldErrors(mapValidationErrors(validation.error.issues));
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);
    setFieldErrors({});
    setSubmitError(null);

    try {
      // Step 1: Compress image
      const compressed = await compressImage(imageToSubmit!);

      // Step 2: Upload image to storage
      const userEmail = user.primaryEmailAddress.emailAddress;

      const uploadResponse = await fetch("/api/upload/authenticated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: compressed,
          caption,
          scheduledSendTime: scheduledSendTime!.toISOString(),
          deliveryMethod,
          deliveryAddress:
            deliveryMethod === "email" ? userEmail : deliveryAddress,
          periodType: selectedPeriod,
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error ?? "Upload failed");
      }

      const responseData = await uploadResponse.json();

      // Invalidate gallery SWR cache so the new memory appears immediately on next visit
      mutate("/api/gallery");

      // Store telegram bot link if telegram delivery was selected
      if (deliveryMethod === "telegram" && responseData.snap?.id) {
        const botUsername =
          process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "RestripBot";
        const telegramLink = `https://t.me/${botUsername}?start=snap_${responseData.snap.id}_${responseData.snap.telegram_link_token}`;
        setTelegramBotLink(telegramLink);
      }

      setIsSuccess(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setSubmitError({
        user: "Ohno! Something went wrong while saving your memory. Please try again.",
        detail,
      });
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
          {telegramBotLink ? (
            <>
              <h1 className="font-display text-3xl font-bold text-soft-black mb-3">
                Start Telegram Bot! 🎉
              </h1>
              <p className="text-grey mb-2">
                Your photo strip has been saved to your gallery.
              </p>
              <p className="text-grey mb-4">
                To receive your memory, please start the Telegram bot by
                clicking the button below (even if you've used it before).
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
            <>
              <h1 className="font-display text-3xl font-bold text-soft-black mb-3">
                All Set! 🎉
              </h1>
              <p className="text-grey mb-2">
                Your photo strip has been saved to your gallery.
              </p>
              <p className="text-grey mb-4">
                Your memory will be delivered to you soon...
              </p>
            </>
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

  const displayImage =
    autoCropEnabled && croppedImage ? croppedImage : originalImage;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-soft-black mb-2">
            New Memory
          </h1>
        </div>

        {isPrefilling && (
          <div className="space-y-6">
            {/* Image Upload skeleton */}
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="w-full aspect-[3/4] rounded-xl" />
            </div>
            {/* Caption skeleton */}
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            {/* Period picker skeleton */}
            <div>
              <Skeleton className="h-4 w-28 mb-2" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
            {/* Delivery method skeleton */}
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
            {/* Submit button skeleton */}
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleStartProcessing();
          }}
          className={`space-y-6${isPrefilling ? " invisible h-0 overflow-hidden" : ""}`}
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
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
                {fieldErrors.image}
              </p>
            )}
          </div>
          {/* Caption */}
          {/* manual crop dialog */}
          <Dialog open={isManualCropping} onOpenChange={setIsManualCropping}>
            <DialogContent className="z-50 max-w-[95vw] md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
              <DialogHeader className="p-4 border-b shrink-0">
                <DialogTitle>
                  Crop &amp; Straighten your photo strip
                </DialogTitle>
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
                  <label
                    className="text-sm font-medium"
                    htmlFor="rotation-slider"
                  >
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
                />
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
          {/* Caption */}{" "}
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
            <label className="block text-sm font-medium text-soft-black mb-1">
              When to deliver
            </label>
            <PeriodPicker
              key={prefillKey}
              defaultValue={selectedPeriod}
              prefillDate={prefillPeriodDate}
              prefillRange={prefillPeriodRange}
              onSelect={handlePeriodSelect}
            />
            {fieldErrors.period && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
              </p>
            )}
          </div>
          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-medium text-soft-black mb-2">
              How to deliver
            </label>
            <DeliveryMethodPicker
              key={prefillKey}
              defaultValue={deliveryMethod}
              onSelect={handleDeliveryMethodSelect}
              hideEmailInput
            />
            {deliveryMethod === "email" && (
              <p className="text-xs text-grey flex items-center gap-1">
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
                <Spinner
                  variant="pinwheel"
                  size={16}
                  className="text-warm-beige"
                />
                One day, you'll open this and smile...
              </>
            ) : (
              "Create Memory"
            )}
          </button>
          {/* Validation errors summary */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600 text-center">
                Oops—that didn&apos;t work. Please fix the errors above and try
                again.
              </p>
            </div>
          )}
          {/* Runtime / submission errors */}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <p className="text-sm text-red-700">{submitError.user}</p>
              {submitError.detail && (
                <p className="font-mono text-xs text-red-400 break-all">
                  Error: {submitError.detail}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function NewMemoryPage() {
  return (
    <Suspense>
      <NewMemoryPageContent />
    </Suspense>
  );
}
