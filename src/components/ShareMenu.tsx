import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Share2, Copy, Check, Download } from "lucide-react";
import { useState } from "react";

export function ShareMenu({
  onExport,
  onGetImageBlob,
}: {
  onExport: () => void;
  onGetImageBlob?: () => Promise<Blob | null>;
}) {
  const [copied, setCopied] = useState(false);
  const isMobile = typeof navigator !== "undefined" && !!navigator.share;

  const getBlob = async (): Promise<Blob | null> => {
    return onGetImageBlob ? onGetImageBlob() : null;
  };

  // opens up ios/android native menu for sharing
  const handleShare = async () => {
    const blob = await getBlob();
    if (!blob) return;
    const file = new File([blob], "scrapbook-page.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Scrapbook Page" });
      } else {
        // Fallback, download instead
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scrapbook-page.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyImage = async () => {
    const blob = await getBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback,  download instead
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scrapbook-page.png";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isMobile) {
    return (
      <button
        onClick={handleShare}
        className="flex shrink-0 items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition whitespace-nowrap"
      >
        <Share2 className="w-4 h-4" /> Share
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex shrink-0 items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition whitespace-nowrap">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        align="end"
        sideOffset={8}
        collisionPadding={12}
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Download</span>
          </button>

          <button
            onClick={handleCopyImage}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="text-sm">{copied ? "Copied!" : "Copy Image"}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
