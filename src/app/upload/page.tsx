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
  ArrowUpRightIcon,
  Brush,
  CircleAlert,
  Crop as CropIcon,
  RotateCcw,
} from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";
import imageCompression from "browser-image-compression";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

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
import ScrollReveal from "../../components/ScrollReveal";
import ShinyText from "../../components/ShinyText";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "../../components/ui/shadcn-io/announcement";
import {
  Banner,
  BannerAction,
  BannerClose,
  BannerIcon,
  BannerTitle,
} from "../../components/ui/shadcn-io/banner";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../components/ui/shadcn-io/spinner";
import * as z from "zod";

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

/** UserJot widget configuration ID */
const USERJOT_CONFIG_ID = "cmjjzikhm01fr15o1n4jg1h93";

// =============================================================================
// GSAP Plugin Registration
// =============================================================================

try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered - safe to ignore
}

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
async function canvasPreview(image: HTMLImageElement, crop: PixelCrop) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to match crop area (in actual pixels)
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  // Draw just the cropped portion onto the canvas
  ctx.drawImage(
    image,
    crop.x * scaleX, // Source X (where to start copying from)
    crop.y * scaleY, // Source Y
    crop.width * scaleX, // Source width (how much to copy)
    crop.height * scaleY, // Source height
    0, // Destination X (where to paste on canvas)
    0, // Destination Y
    canvas.width, // Destination width
    canvas.height, // Destination height
  );

  return canvas.toDataURL("image/jpeg", 0.95);
}

/**
 * Calculates the scheduled send time based on a selected date.
 *
 * Rules:
 * - If today and after 6 PM: schedule for 1 hour from now (or 11:59 PM)
 * - If today and before 6 PM: schedule for 6 PM today
 * - If future date: schedule for 6 PM on that date
 *
 * @param selectedDate - The date selected by the user
 * @returns Calculated send time
 */
function calculateSendTime(selectedDate: Date): Date {
  const now = new Date();
  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();

  if (!isToday) {
    // Future date: schedule for 6 PM
    const sendTime = new Date(selectedDate);
    sendTime.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
    return sendTime;
  }

  // Today: check current time
  const currentHour = now.getHours();

  if (currentHour >= DEFAULT_DELIVERY_HOUR) {
    // After 6 PM: try 1 hour from now
    const oneHourFromNow = new Date(now.getTime() + MS_PER_HOUR);
    const isStillToday =
      oneHourFromNow.getDate() === now.getDate() &&
      oneHourFromNow.getMonth() === now.getMonth() &&
      oneHourFromNow.getFullYear() === now.getFullYear();

    if (isStillToday) {
      return oneHourFromNow;
    }

    // Would be tomorrow, use 11:59 PM today
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);
    return endOfDay;
  }

  // Before 6 PM: schedule for 6 PM today
  const sixPmToday = new Date(selectedDate);
  sixPmToday.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
  return sixPmToday;
}

/**
 * Generates a random surprise date within the configured range.
 *
 * @returns Random date between SURPRISE_MIN_DAYS and SURPRISE_MAX_DAYS from now
 */
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
 * Announcement banner for upcoming features.
 */
const AnnouncementBanner = React.memo(() => (
  <Banner>
    <BannerIcon icon={CircleAlert} />
    <BannerTitle>
      v2.0 is coming soon with exciting new features! e.g. a canvas to store
      your photo strip memories...
    </BannerTitle>
    <BannerAction
      onClick={() => {
        window.open("https://restrip.userjot.com/", "_blank");
      }}
    >
      Suggest a feature
    </BannerAction>
    <BannerClose />
  </Banner>
));
AnnouncementBanner.displayName = "AnnouncementBanner";

/**
 * Beta testing announcement pill.
 */
const AnnouncementPill = React.memo(() => (
  <Announcement className="bg-sky-100 text-sky-700" themed>
    <AnnouncementTag>Info</AnnouncementTag>
    <AnnouncementTitle>
      Beta testing in progress, all memories
      <br />
      will be sent within 5 minutes
      <ArrowUpRightIcon className="shrink-0 opacity-70" size={16} />
    </AnnouncementTitle>
  </Announcement>
));
AnnouncementPill.displayName = "AnnouncementPill";

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
      <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue">
          <Brush className="size-5 text-soft-black" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
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
          <p className="text-muted-foreground text-sm text-left">
            Auto crops out photo strip just like it had been scanned.
            (Recommended for physical copy)
          </p>
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

  // Image state
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [croppedImage, setCroppedImage] = useState<string | undefined>();

  // Manual Crop State
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");

  // Form state
  const [caption, setCaption] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
        return;
      }

      setIsCropping(true);
      try {
        const croppedResult = await processImageWithRunPod(originalImage);
        setCroppedImage(croppedResult);
        console.log("✅ Image cropped successfully");

        // Refresh scroll triggers after image changes
        setTimeout(() => ScrollTrigger.refresh(), 100);
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
    [originalImage, croppedImage],
  );

  /**
   * Handles saving the manual crop from the modal
   */
  const handleSaveManualCrop = useCallback(async () => {
    // Check if we have a valid image ref and a valid crop object
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
        );
        setCroppedImage(croppedBase64);
        setIsManualCropping(false);
        // Ensure auto-crop is disabled to avoid confusion
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
  }, [completedCrop]);

  /**
   * Handles resetting to the original image
   */
  const handleResetCrop = useCallback(() => {
    setCroppedImage(undefined);
    setAutoCropEnabled(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  /**
   * Initializes default crop when image loads in modal
   */
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 80,
        },
        width / height,
        width,
        height,
      ),
      width,
      height,
    );
    setCrop(crop);
  }

  /**
   * Handles period selection from PeriodPicker.
   * Calculates appropriate send time based on selection.
   */
  const handlePeriodSelect = useCallback(
    (period: PeriodOption, date?: Date) => {
      setSelectedPeriod(period);

      let sendTime: Date | undefined;

      if (date) {
        // User selected a specific date - calculate send time
        sendTime = calculateSendTime(date);

        if (period === "custom date") {
          setCustomDate(sendTime);
        } else if (period === "custom period") {
          setCustomPeriod(sendTime.toISOString());
        }

        setScheduledSendTime(sendTime);
        setValidationErrors([]);
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else if (period === "surprise") {
        // Generate random surprise date
        sendTime = generateSurpriseDate();
        setScheduledSendTime(sendTime);
        setValidationErrors([]);
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else {
        // Clear scheduled time when period type requires manual date selection
        setScheduledSendTime(undefined);
        setCustomDate(undefined);
        setCustomPeriod(undefined);
      }

      if (sendTime) {
        console.log(
          `📅 Memory will be delivered on: ${sendTime.toISOString()} (${sendTime.toLocaleString()})`,
        );
      }
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
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error ?? "Failed to upload image");
      }

      const { storagePath, encryptedCaption, captionIv, imageIv } =
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
        }),
      });

      if (!createSnapResponse.ok) {
        const errorData = await createSnapResponse.json();
        throw new Error(errorData.error ?? "Failed to save snap metadata");
      }

      const snapData = await createSnapResponse.json();
      console.log("🎉 Snap saved successfully:", snapData.snap?.id);

      // Step 4: Show success confirmation
      if (deliveryMethod === "telegram" && snapData.snap?.id) {
        const botUsername =
          process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "RestripBot";
        const telegramLink = `https://t.me/${botUsername}?start=snap_${snapData.snap.id}`;

        const shouldOpenTelegram = window.confirm(
          "🎉 Memory scheduled!\n\n" +
            "Click OK to open Telegram and start the bot.\n" +
            "The bot will send your memory back on the scheduled date.\n\n" +
            `Telegram username: @${botUsername}`,
        );

        if (shouldOpenTelegram) {
          // Use location.href for better iOS Safari compatibility
          window.location.href = telegramLink;
        }
      } else {
        alert("🎉 Your memory has been scheduled for delivery!");
      }

      // Step 5: Reset form for next upload
      resetForm();
    } catch (error) {
      console.error("❌ Processing failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Processing failed";
      setValidationErrors([errorMessage]);
    } finally {
      setIsProcessing(false);
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
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  /**
   * Refresh ScrollTrigger when image changes.
   */
  useEffect(() => {
    if (originalImage) {
      const timeoutId = setTimeout(() => ScrollTrigger.refresh(), 100);
      return () => clearTimeout(timeoutId);
    }
  }, [originalImage]);

  /**
   * Initialize with surprise period on mount.
   */
  useEffect(() => {
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  /**
   * Reset errors and refresh ScrollTrigger on mount.
   */
  useEffect(() => {
    setValidationErrors([]);
    setFieldErrors({});

    const timeoutId = setTimeout(() => ScrollTrigger.refresh(), 500);
    return () => clearTimeout(timeoutId);
  }, []);

  /**
   * Load UserJot feedback widget SDK.
   */
  useEffect(() => {
    // Load UserJot SDK loader
    const loaderScript = document.createElement("script");
    loaderScript.innerHTML = `
      window.$ujq = window.$ujq || [];
      window.uj = window.uj || new Proxy({}, {
        get: (_, p) => (...a) => window.$ujq.push([p, ...a])
      });
      document.head.appendChild(
        Object.assign(document.createElement('script'), {
          src: 'https://cdn.userjot.com/sdk/v2/uj.js',
          type: 'module',
          async: true
        })
      );
    `;
    document.head.appendChild(loaderScript);

    // Initialize UserJot widget
    const initScript = document.createElement("script");
    initScript.innerHTML = `
      window.uj.init('${USERJOT_CONFIG_ID}', {
        widget: true,
        position: 'right',
        theme: 'auto'
      });
    `;
    document.head.appendChild(initScript);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-warm-beige">
      <AnnouncementBanner />
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">
            ReStrip
          </h1>
          <ShinyText
            text="Photo strips that come back to you."
            disabled={false}
            speed={15}
            className="font-display text-3xl md:text-4xl font-semibold text-soft-black mb-4"
          />
          <p className="font-body text-grey mb-6">
            Upload your photo strip, pick a future period, and we'll send you a
            surprise email then. That's it.
          </p>
          <AnnouncementPill />
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
            <div className="mt-6 flex gap-4 justify center" ref={imageRef}>
              <UploadImage
                key={resetKey}
                displayImage={croppedImage ? croppedImage : undefined}
                onImageUpload={handleImageUpload}
                isLoading={isCropping}
                error={!!fieldErrors.image}
              />
            </div>

            {originalImage && (
              <div className="flex gap-3 justify-center mt-4">
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
                  Manual Crop
                </Button>

                {croppedImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      handleResetCrop();
                    }}
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <RotateCcw size={16} />
                    Reset to Original
                  </Button>
                )}
              </div>
            )}

            {fieldErrors.image && (
              <div className="mt-2 mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{fieldErrors.image}</p>
              </div>
            )}
            <AutoCropSwitch
              autoCropEnabled={autoCropEnabled}
              onToggle={handleAutoCropToggle}
              isProcessing={isCropping}
              imageUploaded={!!originalImage || !!croppedImage}
            />

            {/* Journal Caption */}
            <div>
              <h3 className="font-display text-xl font-bold text-soft-black mt-6">
                2. write a caption
              </h3>
            </div>
            <div className="mt-6 flex gap-4 justify-center" ref={captionRef}>
              <Textarea
                placeholder="Type caption here for your photo strip."
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
            <div className="mt-6 flex gap-4 justify-center" ref={deliveryRef}>
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

            {/* CTA Button */}
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="w-full mt-8 bg-blush-pink text-soft-black rounded-md min-h-button font-body font-semibold hover:bg-yellow-cream transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Encrypting & Delivering..."
                : "Deliver to the Future!"}
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

        {/* About Section */}
        <div className="max-w-2xl mx-auto mt-6">
          <div className="text-center bg-white rounded-lg shadow-card hover:shadow-card-hover p-8 transition-shadow">
            <ScrollReveal
              baseOpacity={0}
              enableBlur={true}
              baseRotation={0}
              blurStrength={10}
            >
              We live in a world where memories are fleeting, photo strips pile
              up, and feelings fade. ReStrip slows time down. You capture a
              moment today and, months later, it comes back to make you smile.
              ReStrip is a time machine for your happiest moments.
            </ScrollReveal>
          </div>
        </div>
      </div>

      <Dialog open={isManualCropping} onOpenChange={setIsManualCropping}>
        <DialogContent className="z-50 max-w-[95vw] md:max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Crop your photo strip</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-zinc-100/50 p-4">
            {originalImage && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  src={originalImage}
                  alt="Crop me"
                  onLoad={onImageLoad}
                  style={{
                    maxHeight: "70vh", // Fits within the flex-1 area roughly
                    maxWidth: "100%",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              </ReactCrop>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-white gap-2">
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
      <footer className="bg-soft-black text-warm-beige py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️, by{" "}
            <a
              href="https://www.linkedin.com/in/bek-joon-hao/"
              className="hover:underline transition-all hover:text-pastel-blue"
            >
              Joon Hao
            </a>
            .
          </p>
          <div className="mt-4 flex justify-center space-x-4">
            <a
              href="/privacy-policy"
              className="text-warm-beige hover:underline"
            >
              Privacy Policy
            </a>
            <a href="/contact" className="text-warm-beige hover:underline">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
