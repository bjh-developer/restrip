// components/ShareMenu.tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Share2, Copy, Check, Download } from "lucide-react";
import { FaWhatsapp, FaTelegram } from "react-icons/fa";
import { useState } from "react";

export function ShareMenu({ onExport }: { onExport: () => void }) {
  const [copied, setCopied] = useState(false);
  const isMobile = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    if (isMobile) {
      try {
        await navigator.share({
          title: "My Scrapbook",
          url: window.location.href,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleWhatsApp = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${url}`, "_blank", "noopener,noreferrer");
  };

  const handleTelegram = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://t.me/share/url?url=${url}&text=Check+out+my+scrapbook!`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isMobile) {
    return (
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
      >
        <Share2 className="w-4 h-4" /> Share
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onExport}
            className="flex flex-col items-center gap-2 p-3 hover:bg-gray-100 rounded-lg transition"
          >
            <Download className="w-6 h-6" />
            <span className="text-xs">Download</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 p-3 hover:bg-gray-100 rounded-lg transition"
          >
            <FaWhatsapp size={24} className="text-[#25D366]" />
            <span className="text-xs">WhatsApp</span>
          </button>

          <button
            onClick={handleTelegram}
            className="flex flex-col items-center gap-2 p-3 hover:bg-gray-100 rounded-lg transition"
          >
            <FaTelegram size={24} className="text-[#229ED9]" />
            <span className="text-xs">Telegram</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-2 p-3 hover:bg-gray-100 rounded-lg transition"
          >
            {copied ? (
              <Check className="w-6 h-6 text-green-500" />
            ) : (
              <Copy className="w-6 h-6" />
            )}
            <span className="text-xs">{copied ? "Copied!" : "Copy Link"}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
