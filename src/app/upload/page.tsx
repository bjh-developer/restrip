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

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  BookImage,
  Brush,
  Check,
  CircleUserRound,
  Crop as CropIcon,
  HandCoins,
  RotateCcw,
  Share,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, {
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

import { WebHaptics, defaultPatterns } from "web-haptics";
import * as z from "zod";
import {
  DeliveryMethodPicker,
  type DeliveryMethod,
} from "../../components/DeliveryMethodPicker";
import { PeriodPicker, type PeriodOption } from "../../components/PeriodPicker";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../components/ui/shadcn-io/spinner";
import { computeScheduledSendTime } from "../../lib/delivery-scheduling";

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
      return base64Image;
    }

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
  } catch {
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
    const haptics = useMemo(() => new WebHaptics(), []);

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
              onClick={() => {
                void haptics.trigger(defaultPatterns.selection);
              }}
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

/**
 * CTA modal encouraging anonymous users to create a free account.
 * Shows value propositions and offers two paths: sign up or continue.
 */
function AccountCTAModal({
  open,
  onCreateAccount,
  onContinue,
  onClose,
}: {
  open: boolean;
  onCreateAccount: () => void;
  onContinue: (rememberChoice: boolean) => void;
  onClose: () => void;
}) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const haptics = useMemo(() => new WebHaptics(), []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cta-title"
    >
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-300">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-blush-pink/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-base" aria-label="Circle User Round">
            <CircleUserRound size={30} />
          </span>
        </div>

        {/* Title */}
        <h2
          id="cta-title"
          className="font-display text-xl font-bold text-soft-black text-center mb-2"
        >
          Keep Your Memories Safe
        </h2>

        {/* Subtitle */}
        <p className="text-grey text-sm text-center mb-4">
          Create a free account to unlock:
        </p>

        {/* Features */}
        <ul className="space-y-2.5 mb-5 text-sm text-soft-black">
          <li className="flex items-start gap-2.5">
            <span className="text-base leading-5">
              <BookImage size={18} />
            </span>
            <span>Your own photo strip gallery</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-base leading-5">
              <Share size={18} />
            </span>
            <span>Shareable scrapbooks for friends &amp; family</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-base leading-5">
              <Trash size={18} />
            </span>
            <span>Delete unwanted memories anytime</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-base leading-5">
              <HandCoins size={18} />
            </span>
            <span>Completely free — no catches, ever</span>
          </li>
        </ul>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onCreateAccount}
          className="w-full py-2.5 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-semibold mb-2"
        >
          Create Free Account
        </button>

        {/* Secondary CTA */}
        <button
          type="button"
          onClick={() => onContinue(rememberChoice)}
          className="w-full py-2.5 bg-white border border-mist-grey text-soft-black rounded-lg hover:bg-mist-grey/30 transition text-sm font-medium mb-3"
        >
          Continue without account
        </button>

        {/* Remember choice */}
        <label className="flex items-center gap-2 justify-center cursor-pointer">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            onClick={() => {
              void haptics.trigger(defaultPatterns.soft);
            }}
            className="rounded border-mist-grey text-soft-black focus:ring-soft-black h-3.5 w-3.5"
          />
          <span className="text-xs text-grey">Don&apos;t show this again</span>
        </label>
      </div>
    </div>
  );
}

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
  const router = useRouter();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // CTA modal state
  const [showCTAModal, setShowCTAModal] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const compressionAbortRef = useRef(0);

  // Period selection state
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodOption>("surprise");
  const [scheduledSendTime, setScheduledSendTime] = useState<
    Date | undefined
  >();
  const [customPeriodRange, setCustomPeriodRange] = useState<
    { from: Date; to: Date } | undefined
  >();
  const [customSelectedDate, setCustomSelectedDate] = useState<
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
  const [validationErrors, setValidationErrors] = useState<
    { user: string; detail?: string }[]
  >([]);
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
  const handleImageUpload = useCallback(async (base64Image: string) => {
    const uploadId = ++compressionAbortRef.current;
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

    // Compress image immediately on upload to keep size manageable
    setIsCompressing(true);
    try {
      const compressed = await compressImage(base64Image);
      if (
        compressionAbortRef.current === uploadId &&
        compressed !== base64Image
      ) {
        setOriginalImage(compressed);
      }
    } finally {
      if (compressionAbortRef.current === uploadId) {
        setIsCompressing(false);
      }
    }
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
        // if user triggered from manual dialog close it immediately
        if (isManualCropping) setIsManualCropping(false);
        return;
      }

      setIsCropping(true);
      try {
        const croppedResult = await processImageWithRunPod(originalImage);
        setCroppedImage(croppedResult);

        // if we're currently in manual crop dialog, close it once auto-crop finishes
        if (isManualCropping) {
          setIsManualCropping(false);
        }

        // // Refresh scroll triggers after image changes
        // setTimeout(() => ScrollTrigger.refresh(), 100);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setValidationErrors([
          {
            user: "Oops, auto-crop failed. You can crop manually instead.",
            detail,
          },
        ]);
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
      } catch (e) {
        setIsManualCropping(false);
        setValidationErrors([
          {
            user: "Sorry, could not apply the crop. Please try again.",
            detail: e instanceof Error ? e.message : String(e),
          },
        ]);
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
    (period: PeriodOption, date?: Date, range?: { from: Date; to: Date }) => {
      setSelectedPeriod(period);
      if (range) setCustomPeriodRange(range);
      else setCustomPeriodRange(undefined);
      if (period === "custom date") setCustomSelectedDate(date);
      else setCustomSelectedDate(undefined);

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const sendTime = computeScheduledSendTime(period, timezone, date);

      if (!sendTime) {
        setScheduledSendTime(undefined);
        return;
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
   * 2. Check if CTA modal should show (for anonymous users)
   * 3. Compress image if needed
   * 4. Upload to server for encryption
   * 5. Save snap metadata to database
   * 6. Show success confirmation / open Telegram
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
      const haptics = new WebHaptics();
      void haptics.trigger(defaultPatterns.error);
      setFieldErrors(errors);
      scrollToFirstError(errors);
      return;
    }

    // Validate Turnstile CAPTCHA token (skipped in development)
    if (process.env.NODE_ENV !== "development" && !turnstileToken) {
      setValidationErrors([
        {
          user: "Are you a robot? Please complete the CAPTCHA verification before submitting.",
        },
      ]);
      return;
    }

    // Show CTA modal for anonymous users (unless they opted out)
    try {
      if (localStorage.getItem("skipAccountCTA") !== "true") {
        setShowCTAModal(true);
        return;
      }
    } catch {
      // localStorage unavailable — proceed without modal
    }

    // User previously chose to skip — proceed directly
    await performUpload();
  };

  /**
   * Performs the actual upload after validation and CTA decision.
   */
  const performUpload = async (): Promise<void> => {
    setValidationErrors([]);
    setIsProcessing(true);

    try {
      const imageToUpload = croppedImage ? croppedImage : originalImage;

      // Compress image (no-op if already under threshold from early compression)
      const compressedImage = await compressImage(imageToUpload!);

      // Upload and encrypt
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

      // Save metadata to database
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
      const detail = error instanceof Error ? error.message : String(error);
      setValidationErrors([
        {
          user: "Oopsie! Something went wrong while saving your memory. Please try again. If this keeps happening, contact support.",
          detail,
        },
      ]);
    } finally {
      setIsProcessing(false);

      // Reset Turnstile widget to generate a new token for next submission
      if (turnstileWidgetId && window.turnstile) {
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

  /**
   * Saves form state to DB and redirects to sign-up.
   * After sign-up, user is redirected to /new with form data pre-filled.
   */
  const handleCreateAccount = async (): Promise<void> => {
    const imageToSave = croppedImage ?? originalImage;
    try {
      const res = await fetch("/api/pending-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageToSave,
          caption,
          selectedPeriod,
          scheduledSendTime: scheduledSendTime?.toISOString(),
          customSelectedDate: customSelectedDate?.toISOString(),
          customPeriodRange: customPeriodRange
            ? {
                from: customPeriodRange.from.toISOString(),
                to: customPeriodRange.to.toISOString(),
              }
            : undefined,
          deliveryMethod,
          deliveryAddress,
        }),
      });
      if (res.ok) {
        const { token } = await res.json();
        setShowCTAModal(false);
        router.push(`/sign-up?redirect_url=/new&prefill_token=${token}`);
        return;
      }
    } catch {
      // API unavailable — fall through to redirect without token
    }
    setShowCTAModal(false);
    router.push("/sign-up?redirect_url=/new");
  };

  /**
   * User chose to continue without account.
   * Optionally remembers the choice and proceeds with upload.
   */
  const handleContinueWithoutAccount = async (
    rememberChoice: boolean,
  ): Promise<void> => {
    if (rememberChoice) {
      try {
        localStorage.setItem("skipAccountCTA", "true");
      } catch {
        // localStorage unavailable
      }
    }
    setShowCTAModal(false);
    await performUpload();
  };

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  /**
   * Initialize with surprise period on mount.
   */
  useEffect(() => {
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  /**
   * Load Cloudflare Turnstile CAPTCHA script and initialize widget.
   * Uses explicit rendering for SPA compatibility.
   * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
   */
  useEffect(() => {
    // Skip Turnstile in development — it doesn't work on localhost
    if (process.env.NODE_ENV === "development") return;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      return;
    }

    let widgetId: string | undefined;

    // Function to render/re-render the Turnstile widget
    const renderWidget = () => {
      if (!window.turnstile) {
        return;
      }

      const container = document.getElementById("turnstile-widget");
      if (!container) {
        return;
      }

      // Remove old widget if it exists
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore
        }
      }

      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
        "error-callback": () => {
          setTurnstileToken(null);
        },
        "expired-callback": () => {
          setTurnstileToken(null);
        },
        theme: "light",
      });
      setTurnstileWidgetId(widgetId);
    };

    // The Turnstile api.js is loaded by the server-rendered <script> tag in
    // upload/layout.tsx with a nonce, so strict-dynamic propagates trust to
    // all scripts Turnstile loads dynamically.
    // Register the fixed global callback Turnstile will call on load.
    (window as unknown as Record<string, unknown>).__onTurnstileLoad =
      renderWidget;

    // If the script already finished loading before this effect ran, render now.
    if (window.turnstile) {
      renderWidget();
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore
        }
      }
      delete (window as unknown as Record<string, unknown>).__onTurnstileLoad;
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
          {telegramBotLink ? (
            <>
              <h1 className="font-display text-3xl font-bold text-soft-black mb-3">
                Start Telegram Bot! 🎉
              </h1>
              <p className="text-grey mb-4">
                Your memory will be delivered via Telegram in time to come.
                Start the bot below (even if you used it before).
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
              <p className="text-grey mb-4">
                Your memory will be delivered to your email address in time to
                come.
              </p>
            </>
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
    <main className="min-h-screen bg-warm-beige">
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
            <h2 className="font-display text-xl font-bold text-soft-black mb-2">
                1. take photo/upload your photo strip
              </h2>
            </div>
            <div className="flex gap-4 justify-center" ref={imageRef}>
              <UploadImage
                key={resetKey}
                displayImage={croppedImage ? croppedImage : undefined}
                onImageUpload={handleImageUpload}
                isLoading={isCropping || isCompressing}
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
            <div className="mt-10">
              <h2 className="font-display text-xl font-bold text-soft-black mb-2">
                2. write a caption
              </h2>
            </div>
            <div className="flex gap-4 justify-center" ref={captionRef}>
              <Textarea
                aria-label="Write a caption for your memory"
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
            <div className="mt-10">
              <h2 className="font-display text-xl font-bold text-soft-black mb-2">
                3. deliver random email in/on
              </h2>
            </div>
            <div className="flex gap-4 justify-center" ref={periodRef}>
              <PeriodPicker onSelect={handlePeriodSelect} />
            </div>
            {fieldErrors.period && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{fieldErrors.period}</p>
              </div>
            )}

            {/* Delivery Method */}
            <div className="mt-10">
              <h2 className="font-display text-xl font-bold text-soft-black mb-2">
                4. where to send your memory
              </h2>
            </div>
            <div className="flex gap-4 justify-center" ref={deliveryRef}>
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
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                {validationErrors.map(({ user, detail }, index) => (
                  <div key={index}>
                    <p className="text-red-700 text-sm">{user}</p>
                    {detail && (
                      <p className="mt-1 font-mono text-xs text-red-400 break-all">
                        Error: {detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Turnstile CAPTCHA Widget — hidden in development */}
            {process.env.NODE_ENV !== "development" && (
              <div className="mt-6 flex justify-center">
                <div id="turnstile-widget"></div>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleStartProcessing}
              disabled={
                isProcessing ||
                (process.env.NODE_ENV !== "development" && !turnstileToken)
              }
              className="w-full mt-8 bg-blush-pink text-soft-black rounded-md min-h-button font-body font-semibold hover:bg-yellow-cream transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 md:gap-2 px-4 py-3"
            >
              {isProcessing ? (
                <>
                  <Spinner
                    variant="pinwheel"
                    size={14}
                    className="text-soft-black flex-shrink-0"
                  />
                  <span className="text-xs md:text-base whitespace-nowrap">One day, you&apos;ll open this and smile...</span>
                </>
              ) : !turnstileToken && process.env.NODE_ENV !== "development" ? (
                <span className="text-sm md:text-base">Completing CAPTCHA...</span>
              ) : (
                <span className="text-sm md:text-base">Deliver to the Future!</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Account CTA Modal */}
      <AccountCTAModal
        open={showCTAModal}
        onCreateAccount={handleCreateAccount}
        onContinue={handleContinueWithoutAccount}
        onClose={() => setShowCTAModal(false)}
      />

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

          <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-zinc-100/50 p-4 relative overflow-hidden">
            {originalImage && (
              <div className="relative flex items-center justify-center">
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
                      maxHeight: "calc(90vh - 340px)",
                      maxWidth: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      transform: `rotate(${rotation}deg)`,
                      transition: "transform 0.05s linear",
                    }}
                  />
                </ReactCrop>
                {isCropping && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-sm z-10">
                    <Spinner
                      variant="pinwheel"
                      className="text-warm-beige"
                      size={40}
                    />
                  </div>
                )}
              </div>
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
            <Button
              type="button"
              onClick={handleSaveManualCrop}
              disabled={isCropping}
            >
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
    </main>
  );
}
