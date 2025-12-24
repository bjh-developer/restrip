"use client";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "../../components/ui/shadcn-io/dropzone";
import { useState, useEffect } from "react";
import ShinyText from "../../components/ShinyText";
import { PeriodPicker } from "../../components/PeriodPicker";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import ScrollReveal from "../../components/ScrollReveal";
import {
  Banner,
  BannerAction,
  BannerClose,
  BannerIcon,
  BannerTitle,
} from "../../components/ui/shadcn-io/banner";
import { CircleAlert } from "lucide-react";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "../../components/ui/shadcn-io/announcement";
import { ArrowUpRightIcon } from "lucide-react";
import { Brush } from "lucide-react";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";

type PeriodOption = "surprise" | "custom period" | "custom date";

const UploadImage = () => {
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
    >
      <DropzoneEmptyState />
      <DropzoneContent>
        {filePreview && (
          <div className="w-full flex items-center justify-center py-4">
            <img
              alt="Preview"
              className="max-w-full max-h-96 object-contain rounded-md"
              src={filePreview}
            />
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
      Platform under construction
      <ArrowUpRightIcon className="shrink-0 opacity-70" size={16} />
    </AnnouncementTitle>
  </Announcement>
);

const CropEnhanceSwitch = () => (
  <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue">
      <Brush className="size-5 text-soft-black" />
    </div>
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <Label className="font-medium" htmlFor="feature-toggle">
          Enable auto-crop
        </Label>
        <Switch id="feature-toggle" />
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
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePeriodSelect = (period: PeriodOption, date?: Date) => {
    setSelectedPeriod(period);
    if (period === "custom date") {
      setCustomDate(date);
    } else if (period === "custom period" && date) {
      setCustomPeriod(date.toISOString());
    }
    console.log("Selected period:", period, "Date:", date);
  };

  const handleStartProcessing = async () => {
    setIsProcessing(true);
    try {
      // TODO: Implement processing logic
      // - Upload image to Supabase
      // - Call RunPod for processing
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
    // Load UserJot SDK
    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    // Initialize UserJot
    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.uj.init('cmik6o1zx04nt15mqotv6d58d', {
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
            <UploadImage />
            <CropEnhanceSwitch />

            {/* Journal Caption */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              2. write a caption
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <Textarea placeholder="Type caption here for your photo strip." />
            </div>

            {/* Period Picker */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              3. deliver random email in/on
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <PeriodPicker onSelect={handlePeriodSelect} />
            </div>

            {/* Email destination */}
            <h3 className="font-display text-xl font-bold text-soft-black mt-6">
              4. email destination
            </h3>
            <div className="mt-6 flex gap-4 justify-center">
              <Input type="email" placeholder="Email" />
            </div>
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
