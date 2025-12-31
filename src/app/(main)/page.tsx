"use client";
import React from "react";
import { ArrowUpRightIcon, Brush, CircleAlert, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { PeriodPicker } from "../../components/PeriodPicker";
import { DeliveryMethodPicker } from "../../components/DeliveryMethodPicker";
import ScrollReveal from "../../components/ScrollReveal";
import ShinyText from "../../components/ShinyText";
import { AuthGate } from "../../components/auth";
import { PasswordLinkingModal } from "../../components/auth/PasswordLinkingModal";
import { useAuth } from "../../hooks/useAuth";
import { encryptImage, encryptData, getEncryptionKey } from "../../lib/encryption";
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

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type PeriodOption = "surprise" | "custom period" | "custom date";
type DeliveryMethod = "email" | "telegram";

const UploadImage = React.memo(({
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
  const handleDrop = useCallback((files: File[]) => {
    console.log(files);
    setFiles(files);
    if (files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          setFilePreview(e.target?.result);
          // Pass the image to parent component
          onImageUpload?.(e.target?.result);
        }
      };
      reader.readAsDataURL(files[0]);
    }
  }, [onImageUpload]);
  return (
    <Dropzone
      accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
      onDrop={handleDrop}
      onError={console.error}
      src={files}
      multiple={false}
      className={error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
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
});
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

const AutoCropSwitch = React.memo(({
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
));
AutoCropSwitch.displayName = "AutoCropSwitch";

export default function MainPage() {
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    image?: string;
    caption?: string;
    period?: string;
    deliveryAddress?: string;
  }>({});
  const { user, signOut, hasEncryptionKey } = useAuth();
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showPasswordLinking, setShowPasswordLinking] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Function to check passkey status and update banners
  const checkPasskeyStatus = async () => {
    if (user?.email) {
      try {
        const response = await fetch('/api/auth/check-account-type', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });

        if (response.ok) {
          const data = await response.json();
          setHasPasskey(data.hasPasskey || false);
          // Show passkey setup banner if user has password but no passkey
          setShowPasskeySetup(data.accountType === 'password' && !data.hasPasskey);
          // Show password setup banner if user has passkey but no password
          setShowPasswordSetup(data.accountType === 'passkey' && data.hasPasskey);
        }
      } catch (error) {
        console.error('Failed to check passkey status:', error);
        setHasPasskey(null);
        setShowPasskeySetup(false);
        setShowPasswordSetup(false);
      }
    } else {
      setHasPasskey(null);
      setShowPasskeySetup(false);
      setShowPasswordSetup(false);
    }
  };

  // Refs for scrolling to error sections
  const imageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);

  // Handle image upload
  const handleImageUpload = useCallback((base64Image: string) => {
    setOriginalImage(base64Image);
    // Reset cropped image when new image is uploaded
    setCroppedImage(undefined);
    setAutoCropEnabled(false);
    
    // Clear validation errors when user uploads an image
    setValidationErrors([]);
    setFieldErrors(prev => ({ ...prev, image: undefined }));

    // ScrollTrigger will be refreshed in useEffect when originalImage changes
  }, []);

  // Refresh ScrollTrigger when image is uploaded (after DOM update)
  useEffect(() => {
    if (originalImage) {
      // Small delay to ensure DOM is stable
      const timeoutId = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [originalImage]);

  // Upload image to API route for processing
  const processImageWithRunPod = async (
    base64Image: string
  ): Promise<string> => {
    try {
      const response = await fetch("/api/crop-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
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
  const handleAutoCropToggle = useCallback(async (checked: boolean) => {
    setAutoCropEnabled(checked);

    if (checked && originalImage) {
      // If we already have the cropped image in memory, use it
      if (croppedImage) {
        console.log("Using cached cropped image from memory");
        return;
      }

      // Process with RunPod
      setIsCropping(true);
      try {
        const croppedResult = await processImageWithRunPod(originalImage);
        setCroppedImage(croppedResult);
        console.log("Image cropped successfully");
        
        // Refresh ScrollTrigger after cropping completes to ensure animations work
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
  }, [originalImage, croppedImage]);

  const handlePeriodSelect = useCallback((period: PeriodOption, date?: Date) => {
    // TODO: Refactor to include random time logic here, right now it's always 6pm
    setSelectedPeriod(period);

    let sendTime: Date;

    if (date) {
      const now = new Date();
      const selectedDate = new Date(date);

      // Check if selected date is today
      const isToday =
        selectedDate.getFullYear() === now.getFullYear() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getDate() === now.getDate();

      if (isToday) {
        const currentHour = now.getHours();

        // If it's past 6pm (18:00)
        if (currentHour >= 18) {
          const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

          // Check if one hour from now is still today
          const isStillToday =
            oneHourFromNow.getDate() === now.getDate() &&
            oneHourFromNow.getMonth() === now.getMonth() &&
            oneHourFromNow.getFullYear() === now.getFullYear();

          if (isStillToday) {
            // Send 1 hour from now
            sendTime = oneHourFromNow;
          } else {
            // Send at 11:59pm today
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 0, 0);
            sendTime = endOfDay;
          }
        } else {
          // Before 6pm, send at 6pm today
          const sixPmToday = new Date(selectedDate);
          sixPmToday.setHours(18, 0, 0, 0);
          sendTime = sixPmToday;
        }
      } else {
        // For future dates, set time to 6pm
        sendTime = new Date(selectedDate);
        sendTime.setHours(18, 0, 0, 0);
      }

      setScheduledSendTime(sendTime);

      if (period === "custom date") {
        setCustomDate(sendTime);
      } else if (period === "custom period") {
        setCustomPeriod(sendTime.toISOString());
      }
      
      // Clear validation errors when user selects a period
      setValidationErrors([]);
      setFieldErrors(prev => ({ ...prev, period: undefined }));
    } else if (period === "surprise") {
      // For surprise, generate a random date between 1-6 months from now
      const now = new Date();
      const randomDays = Math.floor(Math.random() * (180 - 30 + 1)) + 30; // Random days between 30-180 (1-6 months)
      sendTime = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);

      // Set time to 6pm
      sendTime.setHours(18, 0, 0, 0);

      setScheduledSendTime(sendTime);
      
      // Clear validation errors when user selects surprise
      setValidationErrors([]);
      setFieldErrors(prev => ({ ...prev, period: undefined }));
    } else {
      // User selected custom period or custom date but didn't provide a date
      // Clear the scheduled send time to force them to select
      setScheduledSendTime(undefined);
      setCustomDate(undefined);
      setCustomPeriod(undefined);
    }

    // Single console log for all cases
    if (sendTime!) {
      console.log(
        `📅 Memory will be delivered on: ${sendTime.toISOString()} (${sendTime.toLocaleString()})`
      );
    }
  }, []);

  const handleDeliveryMethodSelect = useCallback((
    method: DeliveryMethod,
    value?: string
  ) => {
    setDeliveryMethod(method);
    setDeliveryAddress(value || "");
    
    // Clear validation errors when user selects delivery method
    setValidationErrors([]);
    setFieldErrors(prev => ({ ...prev, deliveryAddress: undefined }));
  }, []);

  const handleStartProcessing = async () => {
    // Clear previous errors
    setValidationErrors([]);
    setFieldErrors({});

    // Define validation schema (no password needed - using encryption key from auth)
    const SnapSchema = z
      .object({
        Image: z.string().min(1, "Image is required"),
        Caption: z.string().min(1),
        sendTime: z.date(),
        deliveryMethod: z.enum(["email", "telegram"]),
        Delivery_Address: z.string().min(1),
      })
      .refine(
        (data) => {
          if (data.deliveryMethod === "email") {
            // Validate email format
            return z.email().safeParse(data.Delivery_Address).success;
          } else if (data.deliveryMethod === "telegram") {
            // Validate telegram username starts with @
            return data.Delivery_Address.startsWith("@");
          }
          return false;
        },
        {
          message: "Invalid email/telegram username format",
          path: ["Delivery_Address"],
        }
      );

    // Validate inputs
    const validationResult = SnapSchema.safeParse({
      Image: originalImage || "",
      Caption: caption,
      sendTime: scheduledSendTime!,
      deliveryMethod: deliveryMethod,
      Delivery_Address: deliveryAddress,
    });

    if (!validationResult.success) {
      // Validation failed - create user-friendly error messages
      const errors: typeof fieldErrors = {};
      
      validationResult.error?.issues?.forEach((e) => {
        const field = e.path[0];
        // Map field errors to user-friendly messages
        if (field === 'Image') {
          errors.image = 'Please upload a photo before continuing';
        }
        if (field === 'Caption') {
          errors.caption = 'Please add a caption for your photo';
        }
        if (field === 'sendTime') {
          // Check if user selected custom period/date but didn't provide a date
          if (selectedPeriod === 'custom period') {
            errors.period = 'Please select a time period for delivery';
          } else if (selectedPeriod === 'custom date') {
            errors.period = 'Please select a specific date for delivery';
          } else {
            errors.period = 'Please select when to deliver your memory';
          }
        }
        if (field === 'Delivery_Address') {
          if (deliveryMethod === 'email') {
            errors.deliveryAddress = 'Please enter a valid email address';
          } else {
            errors.deliveryAddress = 'Please enter a valid Telegram username (starting with @)';
          }
        }
      });
      
      setFieldErrors(errors);
      
      // Scroll to first error after state update
      setTimeout(() => {
        if (errors.image && imageRef.current) {
          imageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.caption && captionRef.current) {
          captionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.period && periodRef.current) {
          periodRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (errors.deliveryAddress && deliveryRef.current) {
          deliveryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return;
    }

    // Clear errors and proceed with processing
    setValidationErrors([]);
    setIsProcessing(true);
    try {
      console.log("All inputs are valid. Proceeding with processing...");
      
      // Get the encryption key from auth context
      const encryptionKey = await getEncryptionKey();
      if (!encryptionKey) {
        throw new Error("Encryption key not available. Please sign in again to continue.");
      }

      // Determine which image to use (cropped if available, otherwise original)
      const imageToUpload = (autoCropEnabled && croppedImage) ? croppedImage : originalImage;
      
      // Encrypt the image
      console.log("🔐 Encrypting image...");
      const { encrypted: encryptedImage, iv: imageIv } = await encryptImage(imageToUpload!, encryptionKey);
      console.log("✅ Image encrypted successfully");

      // Encrypt the caption
      console.log("🔐 Encrypting caption...");
      const { encrypted: encryptedCaption, iv: captionIv } = await encryptData(caption, encryptionKey);
      console.log("✅ Caption encrypted successfully");

      // TODO: Upload encrypted data to Supabase
      // - Upload encryptedImage to Supabase Storage
      // - Save snap record with: encryptedCaption, captionIv, imageIv, deliveryMethod, deliveryAddress, scheduledSendTime
      console.log("Processing with period:", selectedPeriod);
      console.log("Scheduled send time:", scheduledSendTime?.toISOString(), `(${scheduledSendTime?.toLocaleString()})`);
      console.log("📦 Encrypted payload ready for upload");
    } catch (error) {
      console.error("Processing failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Processing failed";
      setValidationErrors([errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Generate surprise date on mount since it's the default selection
    handlePeriodSelect("surprise");
  }, []);

  useEffect(() => {
    // Clear validation errors and reset form state when user changes
    // This prevents errors from previous account from persisting
    setValidationErrors([]);
    setFieldErrors({});

    // Check if user has passkey authentication
    checkPasskeyStatus();
    
    // Refresh ScrollTrigger when user auth state changes
    // This ensures scroll animations work properly after auth transition
    // Works for both login and logout transitions
    const timeoutId = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [user, hasEncryptionKey]);

  useEffect(() => {
    // Load UserJot SDK
    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    // Initialize UserJot
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

  return (
    <div className="min-h-screen bg-warm-beige">
      <AnnouncementBanner />
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          {/* Brand */}
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">
            ReStrip
          </h1>
          {/* Headline */}
          <ShinyText
            text="Photo strips that come back to you."
            disabled={false}
            speed={15}
            className="font-display text-3xl md:text-4xl font-semibold text-soft-black mb-4"
          />
          {/* Subheadline */}
          <p className="font-body text-grey mb-6">
            Upload your photo strip, pick a future period, and we'll send you a
            surprise email then. That's it.
          </p>
          <AnnouncementPill />
        </div>

        {/* Auth Gate - Shows upload form only when authenticated */}
        <AuthGate>

          {/* User info bar */}
          {user && (
            <div className="max-w-2xl mx-auto mb-4">
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-sm text-gray-600">
                  Signed in as <span className="font-medium">{user.email}</span>
                </span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}

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
                      Add a password to your account for additional login options. This provides a backup authentication method.
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
              <div className={`border rounded-lg p-4 ${passkeyError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className={`text-sm font-medium mb-1 ${passkeyError ? 'text-red-800' : 'text-blue-800'}`}>
                      {passkeyError ? 'Passkey Setup Failed' : 'Add Passkey Authentication'}
                    </h3>
                    <p className={`text-sm mb-3 ${passkeyError ? 'text-red-700' : 'text-blue-700'}`}>
                      {passkeyError || 'Secure your account with passkey authentication. Passkeys are more secure than passwords and easier to use.'}
                    </p>
                    {!passkeyError && (
                    <button
                      onClick={async () => {
                        try {
                          setPasskeyError(null); // Clear any previous errors
                          // Trigger passkey registration for existing user
                          const response = await fetch('/api/auth/passkey/register-options', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: user?.email }),
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to get registration options');
                          }
                          
                          const { options, salt } = await response.json();
                          
                          // Convert salt from base64 to Uint8Array for PRF extension
                          const saltBytes = salt ? base64ToUint8Array(salt) : new Uint8Array(32);
                          
                          // Update PRF extension with the server-generated salt
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
                          
                          // Import the startRegistration function
                          const { startRegistration } = await import('@simplewebauthn/browser');
                          const registrationResponse = await startRegistration({ optionsJSON: optionsWithSalt });
                          
                          // Complete registration
                          const verifyResponse = await fetch('/api/auth/passkey/register-verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              email: user?.email,
                              response: registrationResponse,
                              salt: salt,
                            }),
                          });
                          
                          if (verifyResponse.ok) {
                            // Refresh passkey status
                            const checkResponse = await fetch('/api/auth/check-account-type', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: user?.email }),
                            });
                            if (checkResponse.ok) {
                              const data = await checkResponse.json();
                              setHasPasskey(data.hasPasskey || false);
                              setShowPasskeySetup(false); // Hide banner on success
                              setPasskeyError(null); // Clear any previous errors
                            }
                          } else {
                            const errorData = await verifyResponse.json().catch(() => ({}));
                            const errorMessage = errorData.error || 'Passkey registration failed';
                            console.error('Passkey registration failed:', errorMessage);
                            setPasskeyError(`Registration failed: ${errorMessage}`);
                          }
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                          console.error('Failed to add passkey:', error);
                          setPasskeyError(`Failed to add passkey: ${errorMessage}`);
                        }
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Add Passkey
                    </button>
                    )}
                    {passkeyError && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            setPasskeyError(null); // Clear error and allow retry
                          }}
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
                    className={`ml-4 ${passkeyError ? 'text-red-400 hover:text-red-600' : 'text-blue-400 hover:text-blue-600'}`}
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
                    // Clear validation errors when user starts typing
                    if (validationErrors.length > 0) {
                      setValidationErrors([]);
                    }
                    setFieldErrors(prev => ({ ...prev, caption: undefined }));
                  }}
                  className={fieldErrors.caption ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
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
                <p className="text-red-700 text-sm">{fieldErrors.deliveryAddress}</p>
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
              {isProcessing ? "Encrypting & Delivering..." : "Deliver to the Future!"}
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
        </AuthGate>

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
      {showPasswordLinking && user?.id && (
        <PasswordLinkingModal
          isOpen={showPasswordLinking}
          onClose={() => setShowPasswordLinking(false)}
          onSuccess={() => {
            setShowPasswordLinking(false);
            setShowPasswordSetup(false);
            // Refresh account type to reflect the change
            checkPasskeyStatus();
          }}
          userId={user.id}
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
