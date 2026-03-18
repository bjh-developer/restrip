// components/ShareMenu.tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Share2,
  Download,
} from "lucide-react";

export function ShareMenu({ onExport }: { onExport: () => void }) {
  const handleNativeShare = async () => {
    if (navigator.share) {
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onExport}
            className="flex flex-col items-center gap-2 p-2 hover:bg-gray-100 rounded"
          >
            <Download className="w-6 h-6" />{" "}
            <span className="text-xs">Download</span>
          </button>
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 p-2 hover:bg-gray-100 rounded"
          >
            <Share2 className="w-6 h-6" />{" "}
            <span className="text-xs">Share Link</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
