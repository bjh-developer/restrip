"use client";
import { ArrowUpRightIcon, Brush, CircleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { PeriodPicker } from "../../components/PeriodPicker";
import { DeliveryMethodPicker } from "../../components/DeliveryMethodPicker";
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

type PeriodOption = "surprise" | "custom period" | "custom date";
type DeliveryMethod = "email" | "telegram";

const UploadImage = ({
  displayImage,
  onImageUpload,
  isLoading,
}: {
  displayImage?: string;
  onImageUpload?: (base64Image: string) => void;
  isLoading?: boolean;
}) => {
  const [files, setFiles] = useState<File[] | undefined>();
  const [filePreview, setFilePreview] = useState<string | undefined>();
  const handleDrop = (files: File[]) => {
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
  };
  return (
    <Dropzone
      accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
      onDrop={handleDrop}
      onError={console.error}
      src={files}
      multiple={false}
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
};

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

const AutoCropSwitch = ({
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
);

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
  const [password, setPassword] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handle image upload
  const handleImageUpload = (base64Image: string) => {
    setOriginalImage(base64Image);
    // Reset cropped image when new image is uploaded
    setCroppedImage(undefined);
    setAutoCropEnabled(false);

    // Refresh ScrollTrigger after DOM changes from image upload
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
  };

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
  const handleAutoCropToggle = async (checked: boolean) => {
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
  };

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
    } else if (period === "surprise") {
      // For surprise, generate a random date between 1-6 months from now
      const now = new Date();
      const randomDays = Math.floor(Math.random() * (180 - 30 + 1)) + 30; // Random days between 30-180 (1-6 months)
      sendTime = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);

      // Set time to 6pm
      sendTime.setHours(18, 0, 0, 0);

      setScheduledSendTime(sendTime);
    }

    // Single console log for all cases
    if (sendTime!) {
      console.log(
        `📅 Memory will be delivered on: ${sendTime.toISOString()} (${sendTime.toLocaleString()})`
      );
    }
  }, []);

  const handleDeliveryMethodSelect = (
    method: DeliveryMethod,
    value?: string
  ) => {
    setDeliveryMethod(method);
    setDeliveryAddress(value || "");
  };

  const handleStartProcessing = async () => {
    // Check if image is uploaded
    if (!originalImage) {
      setValidationErrors(["Please upload an image first"]);
      return;
    }

    // Define validation schema
    const SnapSchema = z
      .object({
        Caption: z.string().min(1),
        sendTime: z.date(),
        deliveryMethod: z.enum(["email", "telegram"]),
        Delivery_Address: z.string().min(1),
        Password: z.string().min(1),
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
      Caption: caption,
      sendTime: scheduledSendTime!,
      deliveryMethod: deliveryMethod,
      Delivery_Address: deliveryAddress,
      Password: password,
    });

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      const errorMessages = validationResult.error?.issues?.map((e) => {
        const field = e.path.join(".");
        return field ? `${field}: ${e.message}` : e.message;
      }) || ["Validation failed. Please check your inputs."];
      setValidationErrors(errorMessages);
      return;
    }

    // Clear errors and proceed with processing
    setValidationErrors([]);
    setIsProcessing(true);
    try {
      console.log("All inputs are valid. Proceeding with processing...");
      // TODO: Implement processing logic
      // - Upload image to Supabase
      // - Save to database
      // - Show success message
      console.log("Processing with period:", selectedPeriod, customDate);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Generate surprise date on mount since it's the default selection
    handlePeriodSelect("surprise");
  }, []);

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

        {/* Upload Card */}
        <div className="max-w-2xl mx-auto">
          <div className="text-center bg-white rounded-lg shadow-card hover:shadow-card-hover p-8 transition-shadow">
            {/* Upload Area */}
            <h3 className="font-display text-xl font-bold text-soft-black mb-1">
              1. take photo/upload your photo strip
            </h3>
            <div className="mt-6 flex gap-4 justify center">
              <UploadImage
                displayImage={
                  autoCropEnabled && croppedImage ? croppedImage : undefined
                }
                onImageUpload={handleImageUpload}
                isLoading={isCropping}
              />
            </div>
            <AutoCropSwitch
              autoCropEnabled={autoCropEnabled}
              onToggle={handleAutoCropToggle}
              isProcessing={isCropping}
              imageUploaded={!!originalImage || !!croppedImage}
            />

            {/* Journal Caption */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              2. write a caption
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <Textarea 
                placeholder="Type caption here for your photo strip." 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            {/* Period Picker */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              3. deliver random email in/on
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <PeriodPicker onSelect={handlePeriodSelect} />
            </div>

            {/* Delivery Method */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              4. where to send your memory
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <DeliveryMethodPicker onSelect={handleDeliveryMethodSelect} />
            </div>

            {/* Password Field */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              5. create password
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <Input
                type="password"
                placeholder="Remember your password to unlock your memory in the future!"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CircleAlert className="size-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 mb-2">Please fix the following errors:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="w-full mt-8 bg-blush-pink text-soft-black rounded-md min-h-button font-body font-semibold hover:bg-yellow-cream transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Delivering..." : "Deliver to the Future!"}
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
