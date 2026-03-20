"use client";

import { useState, useEffect } from "react";
import { Share2, Check, X, FileImage, FileText, Loader2 } from "lucide-react";
import type { BookPage } from "../lib/scrapbook-types";

export type ExportFormat = "png" | "pdf" | "share";

/**
 * "download" — shows PNG + PDF only (no native share button)
 * "share"    — shows native Share only (no download buttons)
 * "all"      — shows everything (default, used on desktop)
 */
export type ShareMenuVariant = "download" | "share" | "all";

export interface ShareMenuProps {
  open: boolean;
  onClose: () => void;
  pages: BookPage[];
  thumbnails: Record<string, string>;
  currentPageIdx: number;
  onExportPages: (indices: number[], format: ExportFormat) => Promise<void>;
  /** Controls which action buttons are shown. Defaults to "all". */
  variant?: ShareMenuVariant;
}

export function ShareMenu({
  open,
  onClose,
  pages,
  thumbnails,
  currentPageIdx,
  onExportPages,
  variant = "all",
}: ShareMenuProps) {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    () => new Set([currentPageIdx]),
  );
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );

  useEffect(() => {
    if (open) setSelectedPages(new Set([currentPageIdx]));
  }, [open, currentPageIdx]);

  const closeModal = () => {
    if (exporting) return;
    onClose();
  };

  const togglePage = (idx: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAction = async (format: ExportFormat) => {
    if (selectedPages.size === 0 || exporting) return;
    const indices = Array.from(selectedPages).sort((a, b) => a - b);
    setExporting(true);
    setExportingFormat(format);
    try {
      await onExportPages(indices, format);
    } finally {
      setExporting(false);
      setExportingFormat(null);
      onClose();
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const showDownload = variant === "download" || variant === "all";
  const showShare =
    (variant === "share" || variant === "all") && canNativeShare;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            {variant === "share" ? "Share" : "Download"}
          </h2>
          <button
            type="button"
            onClick={closeModal}
            disabled={exporting}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {/* Quick-select chips */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSelectedPages(new Set([currentPageIdx]))}
            disabled={exporting}
            className="text-xs px-3 py-1.5 rounded-full border border-mist-grey hover:bg-mist-grey/40 transition disabled:opacity-40"
          >
            Current page
          </button>
          <button
            type="button"
            onClick={() => setSelectedPages(new Set(pages.map((_, i) => i)))}
            disabled={exporting}
            className="text-xs px-3 py-1.5 rounded-full border border-mist-grey hover:bg-mist-grey/40 transition disabled:opacity-40"
          >
            All pages
          </button>
        </div>

        {/* Page thumbnail grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 mb-5 pr-0.5">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              onClick={() => togglePage(idx)}
              disabled={exporting}
              className={`relative aspect-[595/842] rounded-lg border-2 transition overflow-hidden ${
                selectedPages.has(idx)
                  ? "border-blush-pink bg-blush-pink/5"
                  : "border-mist-grey hover:border-blush-pink/50"
              } ${exporting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {thumbnails[page.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnails[page.id]}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: page.background.color ?? "#FFF" }}
                />
              )}
              <span className="absolute bottom-1 left-1 text-[10px] font-medium text-soft-black bg-white/80 rounded px-1.5 py-0.5">
                {idx + 1}
              </span>
              {selectedPages.has(idx) && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blush-pink flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="border-t border-mist-grey pt-4">
          <p className="text-xs text-grey mb-3">
            {selectedPages.size} {selectedPages.size === 1 ? "page" : "pages"}{" "}
            selected
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {showDownload && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction("png")}
                  disabled={selectedPages.size === 0 || exporting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-mist-grey hover:bg-mist-grey/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-soft-black"
                >
                  {exportingFormat === "png" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileImage className="w-4 h-4" />
                  )}
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("pdf")}
                  disabled={selectedPages.size === 0 || exporting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-mist-grey hover:bg-mist-grey/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-soft-black"
                >
                  {exportingFormat === "pdf" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Download PDF
                </button>
              </>
            )}

            {showShare && (
              <button
                type="button"
                onClick={() => handleAction("share")}
                disabled={selectedPages.size === 0 || exporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white hover:bg-black/80 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                {exportingFormat === "share" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
