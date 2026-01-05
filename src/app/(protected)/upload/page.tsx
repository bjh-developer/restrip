"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, Brush, CircleAlert, LogOut } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";
import imageCompression from "browser-image-compression";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Textarea } from "../../../../components/ui/textarea";
import { PeriodPicker } from "../../../components/PeriodPicker";
import { DeliveryMethodPicker } from "../../../components/DeliveryMethodPicker";
import ScrollReveal from "../../../components/ScrollReveal";
import ShinyText from "../../../components/ShinyText";
import { PasswordLinkingModal } from "../../../components/auth/PasswordLinkingModal";
import { useAuth } from "../../../hooks/useAuth";
import {
  encryptImage,
  encryptData,
  getEncryptionKey,
} from "../../../lib/encryption";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "../../../components/ui/shadcn-io/announcement";
import {
  Banner,
  BannerAction,
  BannerClose,
  BannerIcon,
  BannerTitle,
} from "../../../components/ui/shadcn-io/banner";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../../components/ui/shadcn-io/dropzone";
import { Spinner } from "../../../components/ui/shadcn-io/spinner";
import * as z from "zod";

// Register ScrollTrigger plugin
try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper to compress image before encryption
async function compressImage(base64Image: string): Promise<string> {
  try {
    // Convert base64 to blob without using fetch (CSP-friendly)
    const arr = base64Image.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });

    // Only compress if larger than 3MB
    const sizeInMB = blob.size / 1024 / 1024;
    if (sizeInMB <= 3) {
      console.log(`Image is ${sizeInMB.toFixed(2)}MB, skipping compression`);
      return base64Image; // Return original
    }

    console.log(`Image is ${sizeInMB.toFixed(2)}MB, compressing...`);

    // Convert blob to File (required by imageCompression)
    const file = new File([blob], "image.jpg", { type: blob.type });

    // Compress image
    const options = {
      maxSizeMB: 3, // Target max 3MB (leaves room for encryption overhead)
      maxWidthOrHeight: 2048, // Higher quality, larger dimension
      useWebWorker: true,
      initialQuality: 0.9, // Higher quality (0.8 is default)
    };

    const compressedBlob = await imageCompression(file, options);

    // Convert back to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error("Compression failed:", error);
    return base64Image; // Return original on error
  }
}

type PeriodOption = "surprise" | "custom period" | "custom date";
type DeliveryMethod = "email" | "telegram";

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
      (files: File[]) => {
        console.log(files);
        setFiles(files);
        if (files.length > 0) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (typeof e.target?.result === "string") {
              setFilePreview(e.target?.result);
              onImageUpload?.(e.target?.result);
            }
          };
          reader.readAsDataURL(files[0]);
        }
      },
      [onImageUpload],
    );
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
          {(displayImage || filePreview) && (
            <div className="w-full flex items-center justify-center py-4 relative">
              <img
                alt="Preview"
                className="max-w-full max-h-96 object-contain rounded-md"
                src={displayImage || filePreview}
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

const AnnouncementBanner = () => (
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
);

const AnnouncementPill = () => (
  <Announcement className="bg-sky-100 text-sky-700" themed>
    <AnnouncementTag>Info</AnnouncementTag>
    <AnnouncementTitle>
      Website under construction, functionalities limited
      <ArrowUpRightIcon className="shrink-0 opacity-70" size={16} />
    </AnnouncementTitle>
  </Announcement>
);

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
    <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue">
        <Brush className="size-5 text-soft-black" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <Label className="font-medium" htmlFor="feature-toggle">
            Enable auto-crop{" "}
            {(isProcessing && "(Processing...)") ||
              (!imageUploaded && "(Upload image first)")}
          </Label>
          <Switch
            id="feature-toggle"
            checked={autoCropEnabled}
            onCheckedChange={onToggle}
            disabled={isProcessing || imageUploaded === false}
          />
        </div>
        <p className="text-muted-foreground text-sm text-left">
          Auto crops out photo strip just like it had been scanned. (Recommended
          for physical copy)
        </p>
      </div>
    </div>
  ),
);
AutoCropSwitch.displayName = "AutoCropSwitch";

export default function UploadPage() {
  const router = useRouter();
  const { user, signOut, hasEncryptionKey, isLoading: authLoading } = useAuth();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && (!user || !hasEncryptionKey)) {
      console.log("UploadPage: Not fully authenticated, redirecting to /");
      router.push("/");
    }
  }, [user, hasEncryptionKey, authLoading, router]);

  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodOption>("surprise");
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customPeriod, setCustomPeriod] = useState<string | undefined>();
  const [scheduledSendTime, setScheduledSendTime] = useState<
    Date | undefined
  >();
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoCropEnabled, setAutoCropEnabled] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [croppedImage, setCroppedImage] = useState<string | undefined>();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    image?: string;
    caption?: string;
    period?: string;
    deliveryAddress?: string;
  }>({});
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showPasswordLinking, setShowPasswordLinking] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Function to check passkey status and update banners
  const checkPasskeyStatus = useCallback(async () => {
    if (user?.email) {
      try {
        const response = await fetch("/api/auth/check-account-type", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        });

        if (response.ok) {
          const data = await response.json();
          setHasPasskey(data.hasPasskey || false);
          setShowPasskeySetup(
            data.accountType === "password" && !data.hasPasskey,
          );
          setShowPasswordSetup(
            data.accountType === "passkey" && data.hasPasskey,
          );
        }
      } catch (error) {
        console.error("Failed to check passkey status:", error);
        setHasPasskey(null);
        setShowPasskeySetup(false);
        setShowPasswordSetup(false);
      }
    } else {
      setHasPasskey(null);
      setShowPasskeySetup(false);
      setShowPasswordSetup(false);
    }
  }, [user?.email]);

  // Handle adding passkey authentication
  const handleAddPasskey = useCallback(
    async (userEmail: string) => {
      try {
        setPasskeyError(null);
        const response = await fetch("/api/auth/passkey/register-options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        });

        if (!response.ok) {
          throw new Error("Failed to get registration options");
        }

        const { options, salt } = await response.json();
        const saltBytes = salt ? base64ToUint8Array(salt) : new Uint8Array(32);

        const optionsWithSalt = {
          ...options,
          extensions: {
            ...options.extensions,
            prf: {
              eval: {
                first: saltBytes,
              },
            },
          },
        };

        const { startRegistration } = await import("@simplewebauthn/browser");
        const registrationResponse = await startRegistration({
          optionsJSON: optionsWithSalt,
        });

        const verifyResponse = await fetch(
          "/api/auth/passkey/register-verify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: userEmail,
              response: registrationResponse,
              salt: salt,
            }),
          },
        );

        if (verifyResponse.ok) {
          await checkPasskeyStatus();
          setShowPasskeySetup(false);
          setPasskeyError(null);
        } else {
          const errorData = await verifyResponse.json().catch(() => ({}));
          const errorMessage = errorData.error || "Passkey registration failed";
          console.error("Passkey registration failed:", errorMessage);
          setPasskeyError(`Registration failed: ${errorMessage}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Failed to add passkey:", error);
        setPasskeyError(`Failed to add passkey: ${errorMessage}`);
      }
    },
    [checkPasskeyStatus],
  );

  // Refs for scrolling to error sections
  const imageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);

  // Handle image upload
  const handleImageUpload = useCallback((base64Image: string) => {
    setOriginalImage(base64Image);
    setCroppedImage(undefined);
    setAutoCropEnabled(false);
    setValidationErrors([]);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
  }, []);

  // Refresh ScrollTrigger when image is uploaded
  useEffect(() => {
    if (originalImage) {
      const timeoutId = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [originalImage]);

  // Upload image to API route for processing
  const processImageWithRunPod = async (
    base64Image: string,
  ): Promise<string> => {
    try {
      const response = await fetch("/api/crop-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      console.log("Crop API response:", data);

      if (data.photostrip) {
        return `data:image/png;base64,${data.photostrip}`;
      } else {
        throw new Error("No photostrip in response");
      }
    } catch (error) {
      console.error("Image processing error:", error);
      throw error;
    }
  };

  // Handle autocrop toggle
  const handleAutoCropToggle = useCallback(
    async (checked: boolean) => {
      setAutoCropEnabled(checked);

      if (checked && originalImage) {
        if (croppedImage) {
          console.log("Using cached cropped image from memory");
          return;
        }

        setIsCropping(true);
        try {
          const croppedResult = await processImageWithRunPod(originalImage);
          setCroppedImage(croppedResult);
          console.log("Image cropped successfully");

          setTimeout(() => {
            ScrollTrigger.refresh();
          }, 100);
        } catch (error) {
          console.error("Failed to crop image:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          alert(`Failed to crop image: ${errorMessage}\n\nPlease try again.`);
          setAutoCropEnabled(false);
        } finally {
          setIsCropping(false);
        }
      }
    },
    [originalImage, croppedImage],
  );

  const handlePeriodSelect = useCallback(
    (period: PeriodOption, date?: Date) => {
      setSelectedPeriod(period);

      let sendTime: Date | undefined;

      if (date) {
        const now = new Date();
        const selectedDate = new Date(date);
        const isToday =
          selectedDate.getFullYear() === now.getFullYear() &&
          selectedDate.getMonth() === now.getMonth() &&
          selectedDate.getDate() === now.getDate();

        if (isToday) {
          const currentHour = now.getHours();
          if (currentHour >= 18) {
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
            const isStillToday =
              oneHourFromNow.getDate() === now.getDate() &&
              oneHourFromNow.getMonth() === now.getMonth() &&
              oneHourFromNow.getFullYear() === now.getFullYear();

            if (isStillToday) {
              sendTime = oneHourFromNow;
            } else {
              const endOfDay = new Date(now);
              endOfDay.setHours(23, 59, 0, 0);
              sendTime = endOfDay;
            }
          } else {
            const sixPmToday = new Date(selectedDate);
            sixPmToday.setHours(18, 0, 0, 0);
            sendTime = sixPmToday;
          }
        } else {
          sendTime = new Date(selectedDate);
          sendTime.setHours(18, 0, 0, 0);
        }

        setScheduledSendTime(sendTime);

        if (period === "custom date") {
          setCustomDate(sendTime);
        } else if (period === "custom period") {
          setCustomPeriod(sendTime.toISOString());
        }

        setValidationErrors([]);
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else if (period === "surprise") {
        const now = new Date();
        const randomDays = Math.floor(Math.random() * (180 - 30 + 1)) + 30;
        sendTime = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);
        sendTime.setHours(18, 0, 0, 0);

        setScheduledSendTime(sendTime);
        setValidationErrors([]);
        setFieldErrors((prev) => ({ ...prev, period: undefined }));
      } else {
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

  const handleDeliveryMethodSelect = useCallback(
    (method: DeliveryMethod, value?: string) => {
      setDeliveryMethod(method);
      setDeliveryAddress(value || "");
      setValidationErrors([]);
      setFieldErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
    },
    [],
  );

  const handleStartProcessing = async () => {
    setValidationErrors([]);
    setFieldErrors({});

    const SnapSchema = z
      .object({
        Image: z.string().min(1, "Image is required"),
        Caption: z.string().min(1),
        sendTime: z.date(),
        deliveryMethod: z.enum(["email", "telegram"]),
        Delivery_Address: z.string(),
      })
      .refine(
        (data) => {
          if (data.deliveryMethod === "email") {
            return z.email().safeParse(data.Delivery_Address).success;
          }
          // Telegram doesn't require delivery_address, bot will use chat_id instead
          return true;
        },
        {
          message: "Invalid email address",
          path: ["Delivery_Address"],
        },
      );

    const validationResult = SnapSchema.safeParse({
      Image: originalImage || "",
      Caption: caption,
      sendTime: scheduledSendTime!,
      deliveryMethod: deliveryMethod,
      Delivery_Address: deliveryAddress,
    });

    if (!validationResult.success) {
      const errors: typeof fieldErrors = {};

      validationResult.error?.issues?.forEach((e) => {
        const field = e.path[0];
        if (field === "Image") {
          errors.image = "Please upload a photo before continuing";
        }
        if (field === "Caption") {
          errors.caption = "Please add a caption for your photo";
        }
        if (field === "sendTime") {
          if (selectedPeriod === "custom period") {
            errors.period = "Please select a time period for delivery";
          } else if (selectedPeriod === "custom date") {
            errors.period = "Please select a specific date for delivery";
          } else {
            errors.period = "Please select when to deliver your memory";
          }
        }
        if (field === "Delivery_Address") {
          if (deliveryMethod === "email") {
            errors.deliveryAddress = "Please enter a valid email address";
          }
        }
      });

      setFieldErrors(errors);

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

      return;
    }

    setValidationErrors([]);
    setIsProcessing(true);
    try {
      console.log("All inputs are valid. Proceeding with processing...");

      const encryptionKey = await getEncryptionKey();
      if (!encryptionKey) {
        throw new Error(
          "Encryption key not available. Please sign in again to continue.",
        );
      }

      const imageToUpload =
        autoCropEnabled && croppedImage ? croppedImage : originalImage;

      // Compress image before encryption
      console.log("🗜️ Compressing image...");
      const compressedImage = await compressImage(imageToUpload!);
      console.log("✅ Image compressed successfully");

      console.log("🔐 Encrypting image...");
      const { encrypted: encryptedImage, iv: imageIv } = await encryptImage(
        compressedImage,
        encryptionKey,
      );
      console.log("✅ Image encrypted successfully");

      console.log("🔐 Encrypting caption...");
      const { encrypted: encryptedCaption, iv: captionIv } = await encryptData(
        caption,
        encryptionKey,
      );
      console.log("✅ Caption encrypted successfully");

      console.log("Processing with period:", selectedPeriod);
      console.log(
        "Scheduled send time:",
        scheduledSendTime?.toISOString(),
        `(${scheduledSendTime?.toLocaleString()})`,
      );
      console.log("📦 Encrypted payload ready for upload");

      console.log("🚀 Uploading encrypted image blob to server...");
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          encryptedImage,
          userId: user?.id,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const { storagePath } = await uploadResponse.json();
      console.log(
        "✅ Image uploaded successfully to storage path:",
        storagePath,
      );

      console.log("🚀 Saving snap metadata to database...");
      const createSnapResponse = await fetch("/api/create-snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user?.id,
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
        throw new Error("Failed to save snap metadata");
      }

      const snapData = await createSnapResponse.json();
      console.log("✅ Snap saved successfully!", snapData);

      // Success! Show confirmation based on delivery method
      if (deliveryMethod === "telegram" && snapData.snap?.id) {
        const botUsername =
          process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "RestripBot";
        const telegramLink = `https://t.me/${botUsername}?start=snap_${snapData.snap.id}`;

        // Show modal with Telegram link
        const shouldOpenTelegram = window.confirm(
          "🎉 Memory scheduled!\n\n" +
            "Click OK to open Telegram and start the bot.\n" +
            "The bot will send your memory back on the scheduled date.\n\n" +
            "Telegram username: @" +
            botUsername,
        );

        if (shouldOpenTelegram) {
          // Use location.href instead of window.open for better iOS Safari compatibility
          window.location.href = telegramLink;
        }
      } else {
        alert("🎉 Your memory has been scheduled for delivery!");
      }

      // Reset form
      setOriginalImage(undefined);
      setCroppedImage(undefined);
      setCaption("");
      setResetKey(prev => prev + 1);
      handlePeriodSelect("surprise");
    } catch (error) {
      console.error("Processing failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Processing failed";
      setValidationErrors([errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle sign out with redirect
  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  useEffect(() => {
    handlePeriodSelect("surprise");
  }, [handlePeriodSelect]);

  useEffect(() => {
    setValidationErrors([]);
    setFieldErrors({});
    checkPasskeyStatus();

    const timeoutId = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [user, hasEncryptionKey, checkPasskeyStatus]);

  // Load UserJot SDK
  useEffect(() => {
    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.uj.init('cmjjzikhm01fr15o1n4jg1h93', {
        widget: true,
        position: 'right',
        theme: 'auto'
      });
    `;
    document.head.appendChild(script2);
  }, []);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user || !hasEncryptionKey) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirecting...</div>
      </div>
    );
  }

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

        {/* User info bar */}
        <div className="max-w-2xl mx-auto mb-4">
          <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
            <span className="text-sm text-gray-600">
              Signed in as <span className="font-medium">{user.email}</span>
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Password setup banner */}
        {showPasswordSetup && (
          <div className="max-w-2xl mx-auto mb-4">
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium mb-1 text-green-800">
                    Add Password Authentication
                  </h3>
                  <p className="text-sm mb-3 text-green-700">
                    Add a password to your account for additional login options.
                    This provides a backup authentication method.
                  </p>
                  <button
                    onClick={() => setShowPasswordLinking(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition"
                  >
                    Add Password
                  </button>
                </div>
                <button
                  onClick={() => setShowPasswordSetup(false)}
                  className="ml-4 text-green-400 hover:text-green-600"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Passkey setup banner */}
        {showPasskeySetup && (
          <div className="max-w-2xl mx-auto mb-4">
            <div
              className={`border rounded-lg p-4 ${
                passkeyError
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3
                    className={`text-sm font-medium mb-1 ${
                      passkeyError ? "text-red-800" : "text-blue-800"
                    }`}
                  >
                    {passkeyError
                      ? "Passkey Setup Failed"
                      : "Add Passkey Authentication"}
                  </h3>
                  <p
                    className={`text-sm mb-3 ${
                      passkeyError ? "text-red-700" : "text-blue-700"
                    }`}
                  >
                    {passkeyError ||
                      "Secure your account with passkey authentication. Passkeys are more secure than passwords and easier to use."}
                  </p>
                  {!passkeyError && (
                    <button
                      onClick={() =>
                        user?.email && handleAddPasskey(user.email)
                      }
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Add Passkey
                    </button>
                  )}
                  {passkeyError && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setPasskeyError(null)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => {
                          setShowPasskeySetup(false);
                          setPasskeyError(null);
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowPasskeySetup(false);
                    setPasskeyError(null);
                  }}
                  className={`ml-4 ${
                    passkeyError
                      ? "text-red-400 hover:text-red-600"
                      : "text-blue-400 hover:text-blue-600"
                  }`}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

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
                displayImage={
                  autoCropEnabled && croppedImage ? croppedImage : undefined
                }
                onImageUpload={handleImageUpload}
                isLoading={isCropping}
                error={!!fieldErrors.image}
              />
            </div>
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
              <DeliveryMethodPicker onSelect={handleDeliveryMethodSelect} />
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
              disabled={isProcessing || !hasEncryptionKey}
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

      {/* Password Linking Modal */}
      {showPasswordLinking && user?.id && user?.email && (
        <PasswordLinkingModal
          isOpen={showPasswordLinking}
          onClose={() => setShowPasswordLinking(false)}
          onSuccess={() => {
            setShowPasswordLinking(false);
            setShowPasswordSetup(false);
            checkPasskeyStatus();
          }}
          userId={user.id}
          email={user.email}
        />
      )}

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
