/**
 * Scrapbook Editor Page
 *
 * Fabric.js-powered scrapbook page editor. Users can:
 * - Add photostrips from their gallery
 * - Place cute stickers
 * - Add text elements
 * - Change the page background
 * - Drag, resize, rotate all elements
 * - Navigate between pages in the book
 *
 * State is auto-saved to localStorage on every change.
 *
 * @module app/(protected)/scrapbook/[bookId]/page
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  Smile,
  Palette,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  Book,
  BookPage,
  PageElement,
  PageBackground,
} from "../../../../lib/scrapbook-types";
import { BACKGROUND_COLORS } from "../../../../lib/scrapbook-types";
import {
  fetchBook,
  addPageApi,
  deletePageApi,
  savePagesApi,
} from "../../../../lib/scrapbook-api";
import { STICKER_PACK, type StickerDef } from "../../../../lib/stickers";
import { fontClassNames } from "../../../../lib/fonts";
import { getCachedImage, setCachedImage } from "../../../../lib/gallery-cache";
import { TextMorph } from "torph/react";
import { ShareMenu } from "../../../../components/ShareMenu";
// =============================================================================
// Thumbnail cache helpers (sessionStorage, keyed by pageId)
// =============================================================================

/** Persist a thumbnail dataURL in sessionStorage. Key includes a content hash
 * so thumbnails are auto-invalidated when the page's element count changes. */
function saveThumbnailCache(
  pageId: string,
  elementCount: number,
  dataUrl: string,
) {
  try {
    sessionStorage.setItem(`thumb:${pageId}:${elementCount}`, dataUrl);
  } catch {
    // Ignore quota errors (sessionStorage is best-effort)
  }
}

/** Read a cached thumbnail. Returns null if missing or stale. */
function readThumbnailCache(
  pageId: string,
  elementCount: number,
): string | null {
  try {
    return sessionStorage.getItem(`thumb:${pageId}:${elementCount}`);
  } catch {
    return null;
  }
}

/** Invalidate a thumbnail cache entry (call after auto-save changes a page). */
function clearThumbnailCache(pageId: string) {
  try {
    // Remove all keys for this pageId (any element count)
    const keys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith(`thumb:${pageId}:`),
    );
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Canvas dimensions (A4 portrait ratio) */
const CANVAS_WIDTH = 595;
const CANVAS_HEIGHT = 842;

/** Auto-save debounce delay in ms */
const AUTO_SAVE_DELAY = 800;

/** Available fonts for the text tool */
const FONT_OPTIONS = [
  { label: "Inter", value: "Inter" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Caveat", value: "Caveat" },
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Pacifico", value: "Pacifico" },
  { label: "Oswald", value: "Oswald" },
  { label: "Roboto Mono", value: "Roboto Mono" },
  { label: "Arimo", value: "Arimo" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "League Spartan", value: "League Spartan" },
  { label: "Anton", value: "Anton" },
  { label: "Lora", value: "Lora" },
  { label: "Shrikhand", value: "Shrikhand" },
  { label: "Pinyon Script", value: "Pinyon Script" },
];

// =============================================================================
// Font Picker Component
// =============================================================================

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
}

function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button — renders the active font in itself */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-mist-grey text-soft-black hover:border-blush-pink focus:outline-none focus:ring-1 focus:ring-blush-pink transition bg-white min-w-[130px] justify-between"
        title="Font"
      >
        <span style={{ fontFamily: value }} className="leading-none">
          {value}
        </span>
        <svg
          className="w-3 h-3 text-grey shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-48 bg-white border border-mist-grey rounded-xl shadow-xl overflow-hidden py-1">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                onChange(f.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blush-pink/10 transition flex items-center justify-between gap-2 ${
                value === f.value ? "bg-blush-pink/20" : ""
              }`}
              style={{ fontFamily: f.value }}
            >
              <span>{f.label}</span>
              {value === f.value && (
                <svg
                  className="w-3.5 h-3.5 text-blush-pink shrink-0"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 7l3.5 3.5L12 3"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Utility: generate unique ID
// =============================================================================

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// =============================================================================
// Gallery Picker Modal
// =============================================================================

interface GallerySnap {
  id: string;
  caption: string;
  created_at: string;
}

interface GalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (snapId: string) => void;
}

function GalleryPicker({ open, onClose, onSelect }: GalleryPickerProps) {
  const [snaps, setSnaps] = useState<GallerySnap[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/gallery?pageSize=50")
      .then((r) => r.json())
      .then((data) => {
        setSnaps(data.snaps ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Load thumbnails — use IndexedDB cache first
  useEffect(() => {
    if (snaps.length === 0) return;
    snaps.forEach((snap) => {
      if (imageUrls[snap.id]) return;
      // Try IndexedDB cache first
      getCachedImage(snap.id)
        .then(async (blob: Blob | null) => {
          if (!blob) {
            const r = await fetch(`/api/images/${snap.id}`);
            if (!r.ok) return;
            blob = await r.blob();
            await setCachedImage(snap.id, blob);
          }
          const url = URL.createObjectURL(blob!);
          setImageUrls((prev) => ({ ...prev, [snap.id]: url }));
        })
        .catch(() => {});
    });
    // Cleanup URLs on unmount
    return () => {
      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snaps]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            Pick a Photo Strip
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-grey animate-spin" />
          </div>
        ) : snaps.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <ImageIcon className="w-12 h-12 text-mist-grey mb-3" />
            <p className="text-sm text-grey">
              No photo strips yet. Upload some in the gallery first!
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3">
            {snaps.map((snap) => (
              <button
                key={snap.id}
                type="button"
                onClick={() => {
                  onSelect(snap.id);
                  onClose();
                }}
                className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-mist-grey/30 hover:ring-2 hover:ring-blush-pink transition"
              >
                {imageUrls[snap.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrls[snap.id]}
                    alt={snap.caption || "Photo strip"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-grey animate-spin" />
                  </div>
                )}
                {snap.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                    <p className="text-[10px] text-white truncate">
                      {snap.caption}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sticker Picker Panel
// =============================================================================

const STICKER_CATEGORIES = [
  { key: "characters" as const, label: "Characters" },
  { key: "tags" as const, label: "Tags" },
  { key: "Shapes & Decorations" as const, label: "Shapes & Decorations" },
];

interface StickerPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sticker: StickerDef) => void;
}

function StickerPicker({ open, onClose, onSelect }: StickerPickerProps) {
  const [category, setCategory] =
    useState<StickerDef["category"]>("characters");

  if (!open) return null;

  const filtered = STICKER_PACK.filter((s) => s.category === category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            Stickers
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {STICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition ${
                category === cat.key
                  ? "bg-blush-pink/20 text-soft-black"
                  : "text-grey hover:text-soft-black hover:bg-mist-grey/50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sticker grid */}
        <div className="grid grid-cols-4 gap-3">
          {filtered.map((sticker) => (
            <button
              key={sticker.key}
              type="button"
              onClick={() => {
                onSelect(sticker);
                onClose();
              }}
              className="aspect-square rounded-lg border border-mist-grey hover:border-blush-pink hover:bg-blush-pink/5 p-2 transition"
              title={sticker.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sticker.src}
                alt={sticker.label}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Background Picker Panel
// =============================================================================

interface BackgroundPickerProps {
  open: boolean;
  onClose: () => void;
  current: PageBackground;
  onChange: (bg: PageBackground) => void;
}

function BackgroundPicker({
  open,
  onClose,
  current,
  onChange,
}: BackgroundPickerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            Page Background
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {/* Colors */}
        <div className="flex flex-wrap gap-2 mb-4">
          {BACKGROUND_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ type: "color", color: c })}
              className={`w-8 h-8 rounded-full border-2 transition ${
                current.type === "color" && current.color === c
                  ? "border-soft-black scale-110"
                  : "border-mist-grey"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 px-4 py-2 text-sm rounded-lg bg-soft-black text-white hover:bg-soft-black/90 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Export Picker Panel
// =============================================================================

interface ExportPickerProps {
  open: boolean;
  onClose: () => void;
  pages: BookPage[];
  thumbnails: Record<string, string>;
  onExport: (pageIndices: number[]) => void;
}

function ExportPicker({
  open,
  onClose,
  pages,
  thumbnails,
  onExport,
}: ExportPickerProps) {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    () => new Set(pages.map((_, i) => i)),
  );
  const [exporting, setExporting] = useState(false);

  // Reset selection when opened
  useEffect(() => {
    if (open) {
      // avoid synchronous setState in effect
      setTimeout(() => {
        setSelectedPages(new Set(pages.map((_, i) => i)));
      }, 0);
    }
  }, [open, pages]);

  if (!open) return null;

  const togglePage = (idx: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPages(new Set(pages.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedPages(new Set());
  };

  const handleExport = async () => {
    if (selectedPages.size === 0) return;
    setExporting(true);
    const indices = Array.from(selectedPages).sort((a, b) => a - b);
    await onExport(indices);
    setExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            Export Pages
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {/* Select all/none buttons */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={selectAll}
            disabled={exporting}
            className="text-xs px-2 py-1 rounded-md border border-mist-grey hover:bg-mist-grey/30 transition disabled:opacity-50"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={selectNone}
            disabled={exporting}
            className="text-xs px-2 py-1 rounded-md border border-mist-grey hover:bg-mist-grey/30 transition disabled:opacity-50"
          >
            Select None
          </button>
        </div>

        {/* Page grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              onClick={() => togglePage(idx)}
              disabled={exporting}
              className={`group relative aspect-[595/842] rounded-lg border-2 transition overflow-hidden ${
                selectedPages.has(idx)
                  ? "border-blush-pink bg-blush-pink/5"
                  : "border-mist-grey"
              } ${exporting ? "opacity-50" : "hover:border-blush-pink/50"}`}
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
                  style={{
                    backgroundColor: page.background.color || "#FFF",
                  }}
                />
              )}
              <span className="absolute bottom-1 left-1 text-xs font-medium text-soft-black bg-white/80 rounded px-1.5 py-0.5">
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

        {/* Export button */}
        <div className="flex items-center justify-between pt-3 border-t border-mist-grey">
          <p className="text-sm text-grey">
            {selectedPages.size} {selectedPages.size === 1 ? "page" : "pages"}{" "}
            selected
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedPages.size === 0 || exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-soft-black text-white hover:bg-soft-black/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Editor Page
// =============================================================================

export default function CanvasEditorPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  // Book state
  const [book, setBook] = useState<Book | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle",
  );

  // Fabric.js refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<import("fabric").Canvas | null>(null);
  const isInitializedRef = useRef(false);

  // Panel states
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Sidebar collapsed state (default collapsed on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set sidebar default based on viewport width on mount
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 640);
  }, []);

  // Selection state for delete button
  const [selectionHasObject, setSelectionHasObject] = useState(false);

  // Font picker state (active when a textbox is selected)
  const [selectedIsText, setSelectedIsText] = useState(false);
  const [activeFont, setActiveFont] = useState("Inter");

  // Zoom level (1.0 = fit-to-container)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const zoomLevelRef = useRef(1.0);

  // Page thumbnails (pageId -> dataURL)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to always point to latest saveCurrentPage
  const saveCurrentPageRef = useRef<() => void>(() => {});

  // Flag to prevent auto-save during page loading
  const isLoadingPageRef = useRef(false);

  // Loading overlay — true while any loadPageToCanvas call is in flight
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Inline error banner (replaces alert())
  const [canvasError, setCanvasError] = useState<{
    user: string;
    detail?: string;
  } | null>(null);

  // Current page shorthand
  const currentPage: BookPage | undefined = book?.pages[currentPageIdx];

  // ============= Load book =============
  useEffect(() => {
    let cancelled = false;
    fetchBook(bookId).then((b) => {
      if (cancelled) return;
      if (!b) {
        router.replace("/canvas");
        return;
      }
      setBook(b);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, router]);

  // ============= Initialize Fabric.js =============
  useEffect(() => {
    if (!book || !canvasElRef.current || isInitializedRef.current) return;

    let cancelled = false;

    async function initFabric() {
      const fabric = await import("fabric");
      if (cancelled) return;

      const canvas = new fabric.Canvas(canvasElRef.current!, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: "#FFFFFF",
        selection: true,
        preserveObjectStacking: true,
      });

      fabricCanvasRef.current = canvas;
      isInitializedRef.current = true;

      // Listen for object changes to trigger auto-save
      const onChange = () => scheduleSave();
      canvas.on("object:modified", onChange);
      canvas.on("object:added", onChange);
      canvas.on("object:removed", onChange);

      // Listen for selection changes
      const updateSelectionState = (
        obj: import("fabric").FabricObject | undefined,
      ) => {
        setSelectionHasObject(true);
        if (obj && obj.type === "textbox") {
          setSelectedIsText(true);
          setActiveFont(
            (obj as import("fabric").Textbox).fontFamily ?? "Inter",
          );
        } else {
          setSelectedIsText(false);
        }
      };
      canvas.on("selection:created", (e) =>
        updateSelectionState(e.selected?.[0]),
      );
      canvas.on("selection:updated", (e) =>
        updateSelectionState(e.selected?.[0]),
      );
      canvas.on("selection:cleared", () => {
        setSelectionHasObject(false);
        setSelectedIsText(false);
      });

      // Load all pages to generate thumbnails, ending on page 0.
      // Skip full canvas load for pages that have a cached thumbnail —
      // this eliminates the entire multi-page waterfall on returning visits.
      const pages = book!.pages;
      if (pages.length > 1) {
        for (let i = pages.length - 1; i >= 1; i--) {
          const pg = pages[i];
          const cached = readThumbnailCache(pg.id, pg.elements.length);
          if (cached) {
            // Thumbnail already up-to-date — restore it directly
            setThumbnails((prev) => ({ ...prev, [pg.id]: cached }));
          } else {
            await loadPageToCanvas(pg);
          }
        }
      }
      // Load page 0 last so it stays on screen
      await loadPageToCanvas(pages[0]);
    }

    initFabric();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  // ============= Schedule auto-save =============
  const apiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persist all pages to the API (debounced) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const persistToApi = useCallback(() => {
    if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);
    apiSaveTimerRef.current = setTimeout(() => {
      // Get latest book state from ref
      const latestSave = saveCurrentPageRef.current;
      // Trigger a local save first so state is up to date
      latestSave();
      // Then read the current state from the component
      setBook((latestBook) => {
        if (latestBook) {
          savePagesApi(bookId, latestBook.pages).catch(() => {});
        }
        return latestBook;
      });
    }, AUTO_SAVE_DELAY);
  }, [bookId]);

  const scheduleSave = useCallback(() => {
    // Don't save if we're currently loading a page
    if (isLoadingPageRef.current) return;

    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveCurrentPageRef.current();
      // Persist to API
      setBook((latest) => {
        if (latest) {
          savePagesApi(bookId, latest.pages)
            .then(() => {
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 1500);
            })
            .catch(() => {
              setSaveStatus("idle");
            });
        }
        return latest;
      });
    }, AUTO_SAVE_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============= Save current page state =============
  const saveCurrentPage = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !book || !currentPage) return;

    const elements: PageElement[] = [];
    canvas.getObjects().forEach((obj, idx) => {
      const customData = (obj as unknown as Record<string, unknown>)
        .__customData as
        | {
            id: string;
            type: PageElement["type"];
            snapId?: string;
            stickerKey?: string;
          }
        | undefined;

      if (!customData) return;

      const el: PageElement = {
        id: customData.id,
        type: customData.type,
        snapId: customData.snapId,
        stickerKey: customData.stickerKey,
        textContent:
          customData.type === "text"
            ? ((obj as import("fabric").Textbox).text ?? "")
            : undefined,
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        width: obj.width ?? 0,
        height: obj.height ?? 0,
        rotation: obj.angle ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        zIndex: idx,
        fontSize:
          customData.type === "text"
            ? ((obj as import("fabric").Textbox).fontSize ?? 24)
            : undefined,
        fontFamily:
          customData.type === "text"
            ? ((obj as import("fabric").Textbox).fontFamily ?? "Inter")
            : undefined,
        fontColor:
          customData.type === "text"
            ? String((obj as import("fabric").Textbox).fill ?? "#000000")
            : undefined,
      };
      elements.push(el);
    });

    // Generate thumbnail and update sessionStorage cache so next visit skips re-render
    canvas.renderAll();
    const thumbUrl = canvas.toDataURL({ format: "png", multiplier: 0.15 });
    clearThumbnailCache(currentPage.id);
    saveThumbnailCache(currentPage.id, elements.length, thumbUrl);
    setThumbnails((prev) => ({ ...prev, [currentPage.id]: thumbUrl }));

    // Update local state
    setBook((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.pages = [...updated.pages];
      updated.pages[currentPageIdx] = {
        ...updated.pages[currentPageIdx],
        elements,
        background: currentPage.background,
      };
      return updated;
    });
  }, [book, currentPage, currentPageIdx]);

  // Keep ref in sync with latest saveCurrentPage
  useEffect(() => {
    saveCurrentPageRef.current = saveCurrentPage;
  }, [saveCurrentPage]);

  // ============= Load a page onto the Fabric canvas =============
  const loadPageToCanvas = useCallback(
    async (page: BookPage) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const fabric = await import("fabric");

      // Set loading flag to prevent auto-save during page load
      isLoadingPageRef.current = true;
      setIsPageLoading(true);

      // Clear canvas
      canvas.clear();

      // Set background
      applyBackground(page.background);

      // Load each element
      for (const el of page.elements) {
        try {
          if (el.type === "sticker" && el.stickerKey) {
            // Check sessionStorage thumbnail cache before loading sticker
            const sticker = STICKER_PACK.find((s) => s.key === el.stickerKey);
            if (!sticker) continue;
            const img = await fabric.FabricImage.fromURL(sticker.src);
            img.set({
              left: el.left,
              top: el.top,
              scaleX: el.scaleX,
              scaleY: el.scaleY,
              angle: el.rotation,
            });
            (img as unknown as Record<string, unknown>).__customData = {
              id: el.id,
              type: "sticker",
              stickerKey: el.stickerKey,
            };
            canvas.add(img);
          } else if (el.type === "photostrip" && el.snapId) {
            await addPhotostripToCanvas(el.snapId, el);
          } else if (el.type === "text") {
            const textbox = new fabric.Textbox(el.textContent || "Text", {
              left: el.left,
              top: el.top,
              width: el.width || 200,
              fontSize: el.fontSize || 24,
              fontFamily: el.fontFamily || "Inter",
              fill: el.fontColor || "#000000",
              scaleX: el.scaleX,
              scaleY: el.scaleY,
              angle: el.rotation,
            });
            (textbox as unknown as Record<string, unknown>).__customData = {
              id: el.id,
              type: "text",
            };
            canvas.add(textbox);
          }
        } catch {
          // Skip elements that fail to load and continue with the rest
        }
      }

      canvas.discardActiveObject();
      canvas.renderAll();

      // Check sessionStorage thumbnail cache before doing an expensive re-render
      const cachedThumb = readThumbnailCache(page.id, page.elements.length);

      // Generate thumbnail after all elements (including images) are loaded
      // Use double-rAF to ensure the canvas bitmap is fully painted
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            let thumbUrl: string;
            if (cachedThumb) {
              // Reuse cached thumbnail — no expensive toDataURL call needed
              thumbUrl = cachedThumb;
            } else {
              canvas.renderAll();
              thumbUrl = canvas.toDataURL({
                format: "png",
                multiplier: 0.15,
              });
              saveThumbnailCache(page.id, page.elements.length, thumbUrl);
            }
            setThumbnails((prev) => ({ ...prev, [page.id]: thumbUrl }));
            // Clear loading flag after page is fully loaded
            isLoadingPageRef.current = false;
            setIsPageLoading(false);
            resolve();
          });
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ============= Apply background to canvas =============
  const applyBackground = useCallback((bg: PageBackground) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.backgroundColor = bg.color || "#FFFFFF";
    canvas.renderAll();
  }, []);

  // ============= Add photostrip from gallery =============
  const addPhotostripToCanvas = useCallback(
    async (snapId: string, transform?: Partial<PageElement>) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      try {
        // Use IndexedDB cache to avoid re-downloading on every page open
        let blob = await getCachedImage(snapId);
        if (!blob) {
          const response = await fetch(`/api/images/${snapId}`);
          if (!response.ok) throw new Error("Failed to load image");
          blob = await response.blob();
          await setCachedImage(snapId, blob);
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob!);
        });

        const fabric = await import("fabric");
        const img = await fabric.FabricImage.fromURL(dataUrl);

        // Scale to fit nicely on canvas (max 20% of canvas width)
        const maxW = CANVAS_WIDTH * 0.2;
        const scale = Math.min(maxW / (img.width ?? 200), 1);

        img.set({
          left: transform?.left ?? CANVAS_WIDTH / 2,
          top: transform?.top ?? CANVAS_HEIGHT / 2,
          scaleX: transform?.scaleX ?? scale,
          scaleY: transform?.scaleY ?? scale,
          angle: transform?.rotation ?? 0,
        });

        (img as unknown as Record<string, unknown>).__customData = {
          id: transform?.id ?? uid(),
          type: "photostrip",
          snapId,
        };

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setCanvasError({
          user: "Oops, couldn't add that photo strip to the canvas.",
          detail,
        });
      }
    },
    [],
  );

  // ============= Add sticker =============
  const handleAddSticker = useCallback(async (sticker: StickerDef) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const fabric = await import("fabric");
    const img = await fabric.FabricImage.fromURL(sticker.src);

    const scale = 0.2;
    img.set({
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      scaleX: scale,
      scaleY: scale,
    });

    (img as unknown as Record<string, unknown>).__customData = {
      id: uid(),
      type: "sticker",
      stickerKey: sticker.key,
    };

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
  }, []);

  // ============= Font change =============
  const handleFontChange = useCallback(
    async (font: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active || active.type !== "textbox") return;

      await document.fonts.load(`16px "${font}"`);

      (active as import("fabric").Textbox).set({ fontFamily: font });
      canvas.requestRenderAll();
      setActiveFont(font);
      scheduleSave();
    },
    [scheduleSave],
  );

  // ============= Add text =============
  const handleAddText = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const fabric = await import("fabric");

    // Make sure the current font is loaded
    await document.fonts.load(`16px "${activeFont}"`);

    const textbox = new fabric.Textbox("Your text here", {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      width: 200,
      fontSize: 24,
      fontFamily: activeFont,
      fill: "#1C1C1C",
      textAlign: "center",
    });

    (textbox as unknown as Record<string, unknown>).__customData = {
      id: uid(),
      type: "text",
    };

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  }, [activeFont]);

  // ============= Delete selected object =============
  const handleDelete = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (!active) return;

    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  // ============= Keyboard shortcuts =============
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't trigger if editing text
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (
          active &&
          active.type === "textbox" &&
          (active as import("fabric").Textbox).isEditing
        )
          return;
        handleDelete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDelete]);

  // ============= Page navigation =============
  const goToPage = useCallback(
    async (idx: number) => {
      if (!book || idx < 0 || idx >= book.pages.length) return;

      setCurrentPageIdx(idx);
      // loadPageToCanvas generates the thumbnail internally after all images load
      await loadPageToCanvas(book.pages[idx]);
    },
    [book, loadPageToCanvas],
  );

  // ============= Add new page =============
  const handleAddPage = useCallback(async () => {
    if (!book) return;
    const page = await addPageApi(bookId);
    if (!page) return;
    const updatedBook = { ...book, pages: [...book.pages, page] };
    setBook(updatedBook);
    const newIdx = updatedBook.pages.length - 1;
    setCurrentPageIdx(newIdx);
    loadPageToCanvas(updatedBook.pages[newIdx]);
  }, [book, bookId, loadPageToCanvas]);

  // ============= Delete current page =============
  const handleDeletePage = useCallback(async () => {
    if (!book || !currentPage) return;
    if (book.pages.length <= 1) {
      setCanvasError({ user: "A book must have at least one page. Duh :P" });
      return;
    }
    if (!confirm("Delete this page?")) return;

    const ok = await deletePageApi(bookId, currentPage.id);
    if (!ok) return;
    const updatedPages = book.pages
      .filter((p) => p.id !== currentPage.id)
      .map((p, i) => ({ ...p, pageNumber: i + 1 }));
    const updatedBook = { ...book, pages: updatedPages };
    setBook(updatedBook);
    const newIdx = Math.min(currentPageIdx, updatedBook.pages.length - 1);
    setCurrentPageIdx(newIdx);
    loadPageToCanvas(updatedBook.pages[newIdx]);
  }, [book, bookId, currentPage, currentPageIdx, loadPageToCanvas]);

  // ============= Background change handler =============
  const handleBgChange = useCallback(
    (bg: PageBackground) => {
      if (!book || !currentPage) return;

      // Update local state
      setBook((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        updated.pages = [...updated.pages];
        updated.pages[currentPageIdx] = {
          ...updated.pages[currentPageIdx],
          background: bg,
        };
        return updated;
      });

      applyBackground(bg);
      scheduleSave();
    },
    [book, currentPage, currentPageIdx, applyBackground, scheduleSave],
  );

  // ============= Export pages as images =============
  const handleExport = useCallback(
    async (pageIndices?: number[]) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !book) return;

      // Save current page first
      saveCurrentPage();

      // Use local book state (already up to date)
      const freshBook = book;

      // Determine which pages to export
      const indicesToExport = pageIndices ?? freshBook.pages.map((_, i) => i);

      // Export selected pages
      for (const i of indicesToExport) {
        const page = freshBook.pages[i];
        if (!page) continue;

        // Always load the page to ensure correct content
        await loadPageToCanvas(page);
        // Wait for rendering
        await new Promise((resolve) => setTimeout(resolve, 100));

        canvas.discardActiveObject();
        canvas.renderAll();

        const dataUrl = canvas.toDataURL({
          format: "png",
          multiplier: 2,
        });

        const link = document.createElement("a");
        link.download = `${freshBook.title}-page-${i + 1}.png`;
        link.href = dataUrl;
        link.click();

        // Add delay between downloads
        if (i !== indicesToExport[indicesToExport.length - 1]) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Restore current page
      if (freshBook.pages[currentPageIdx]) {
        await loadPageToCanvas(freshBook.pages[currentPageIdx]);
      }
    },
    [book, currentPageIdx, saveCurrentPage, loadPageToCanvas],
  );

  // ============= Zoom helpers =============
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3.0;
  const ZOOM_STEP = 0.25;

  /** Compute the base scale that fits the canvas in the container */
  const getBaseScale = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return 1;
    // Match the actual CSS padding: p-2 (8px) on mobile, p-6 (24px) on desktop
    // Add extra margin to prevent cutoff: 2x padding + 8px extra
    const isMobile = window.innerWidth < 640;
    const pad = isMobile ? 24 : 56; // Extra safe margin for mobile
    const scaleX = (container.clientWidth - pad) / CANVAS_WIDTH;
    const scaleY = (container.clientHeight - pad) / CANVAS_HEIGHT;
    return Math.min(scaleX, scaleY, 1.0);
  }, []);

  /** Apply the current zoom to the canvas wrapper */
  const applyZoom = useCallback(
    (zoom: number) => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const base = getBaseScale();
      const canvasWrapper = container.querySelector(
        ".canvas-wrapper",
      ) as HTMLElement;
      if (canvasWrapper) {
        canvasWrapper.style.transform = `scale(${base * zoom})`;
        canvasWrapper.style.transformOrigin = "top center";
      }
    },
    [getBaseScale],
  );

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.min(prev + ZOOM_STEP, ZOOM_MAX);
      zoomLevelRef.current = next;
      applyZoom(next);
      return next;
    });
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - ZOOM_STEP, ZOOM_MIN);
      zoomLevelRef.current = next;
      applyZoom(next);
      return next;
    });
  }, [applyZoom]);

  const zoomReset = useCallback(() => {
    zoomLevelRef.current = 1.0;
    setZoomLevel(1.0);
    applyZoom(1.0);
  }, [applyZoom]);

  // ============= Responsive canvas scaling =============
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      applyZoom(zoomLevelRef.current);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [applyZoom]);

  // Re-apply zoom once the initial page load finishes so the canvas fits
  // correctly on mobile. The ResizeObserver fires too early (before toolbar
  // and nav have settled their final heights), so getBaseScale() returns a
  // wrong value on first render. By the time isPageLoading → false, layout
  // is fully committed and the scale calculation will be accurate.
  useEffect(() => {
    if (!isPageLoading) {
      applyZoom(zoomLevelRef.current);
    }
  }, [isPageLoading, applyZoom]);

  // ============= Wheel zoom =============
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoomIn, zoomOut]);

  // ============= Render =============
  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-grey animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden ${fontClassNames}`}
    >
      {/* Inline error banner */}
      {canvasError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm text-red-800">{canvasError.user}</p>
            {canvasError.detail && (
              <p className="font-mono text-xs text-red-400 break-all">
                Error: {canvasError.detail}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCanvasError(null)}
            className="shrink-0 p-0.5 rounded hover:bg-red-100 transition"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
      {/* Top Toolbar */}
      <div className="bg-white border-b border-mist-grey px-3 py-3 flex items-center justify-between">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              saveCurrentPage();
              router.push("/scrapbook");
            }}
            className="p-1.5 rounded-lg hover:bg-mist-grey/50 transition"
          >
            <ArrowLeft className="w-5 h-5 text-soft-black" />
          </button>
          <h1 className="font-display text-sm font-bold text-soft-black truncate max-w-[200px]">
            {book.title}
          </h1>
          <div className="w-16 flex items-center justify-start">
            <TextMorph
              as="span"
              className={`text-xs whitespace-nowrap transition-colors ${
                saveStatus === "saved" ? "text-green-600" : "text-grey"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Saved"
                  : ""}
            </TextMorph>
          </div>
        </div>

        {/* Center: Tools */}
        <div className="flex items-center gap-1">
          {selectedIsText ? (
            <FontPicker value={activeFont} onChange={handleFontChange} />
          ) : !selectionHasObject ? (
            <>
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
                title="Add Photo Strip"
                aria-label="Add Photo Strip"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setStickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
                title="Add Sticker"
                aria-label="Add Sticker"
              >
                <Smile className="w-4 h-4" />
                <span className="hidden sm:inline">Sticker</span>
              </button>
              <button
                type="button"
                onClick={handleAddText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
                title="Add Text"
                aria-label="Add Text"
              >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">Text</span>
              </button>
              <div className="w-px h-6 bg-mist-grey mx-1" />
              <button
                type="button"
                onClick={() => setBgOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
                title="Page Background"
                aria-label="Page Background"
              >
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Background</span>
              </button>
            </>
          ) : null}
        </div>

        {/* Right: Export + Delete */}
        <div className="flex items-center gap-2">
          {selectionHasObject && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-red-500 hover:bg-red-50 transition"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ShareMenu onExport={() => setExportOpen(true)} />{" "}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden relative mt-1">
        {/* Page Sidebar */}
        <div
          className={`bg-white border-r border-mist-grey flex flex-col transition-all duration-200 ease-in-out ${
            sidebarOpen
              ? "w-36 sm:w-48 min-w-[9rem] sm:min-w-[12rem]"
              : "w-0 min-w-0 overflow-hidden border-r-0"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-mist-grey">
            <span className="text-xs font-medium text-soft-black whitespace-nowrap">
              Pages
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAddPage}
                className="p-1 rounded hover:bg-mist-grey/50 transition"
                title="Add Page"
              >
                <Plus className="w-4 h-4 text-grey" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded hover:bg-mist-grey/50 transition"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4 text-grey" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {book.pages.map((page, idx) => (
              <div
                key={page.id}
                onClick={() => goToPage(idx)}
                className={`w-full group relative aspect-[595/842] rounded-lg border-2 transition overflow-hidden cursor-pointer ${
                  idx === currentPageIdx
                    ? "border-blush-pink shadow-sm"
                    : "border-mist-grey hover:border-blush-pink/50"
                }`}
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
                    style={{
                      backgroundColor: page.background.color || "#FFF",
                    }}
                  />
                )}
                <span className="absolute bottom-1 left-1 text-[10px] font-medium text-soft-black/50 bg-white/60 rounded px-1">
                  {idx + 1}
                </span>
                {/* Delete page button */}
                {book.pages.length > 1 && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (idx === currentPageIdx) {
                        handleDeletePage();
                      } else {
                        if (!confirm("Delete this page?")) return;
                        const ok = await deletePageApi(bookId, page.id);
                        if (!ok) return;
                        const updatedPages = book.pages
                          .filter((p) => p.id !== page.id)
                          .map((p, i) => ({ ...p, pageNumber: i + 1 }));
                        setBook({ ...book, pages: updatedPages });
                        if (currentPageIdx >= updatedPages.length) {
                          setCurrentPageIdx(updatedPages.length - 1);
                        }
                      }
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded bg-white/60 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar toggle (when collapsed) */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white border border-mist-grey shadow-sm hover:bg-mist-grey/50 transition"
            title="Show pages"
          >
            <PanelLeftOpen className="w-4 h-4 text-grey" />
          </button>
        )}

        {/* Canvas Area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 min-h-0 bg-mist-grey/30 flex items-start sm:items-center justify-center overflow-hidden p-2 sm:p-6 relative"
        >
          <div
            className="canvas-wrapper shadow-xl rounded-sm relative"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            <canvas ref={canvasElRef} />
            {isPageLoading && (
              <div className="absolute inset-0 bg-white flex items-center justify-center rounded-sm z-10">
                <Loader2 className="w-8 h-8 text-grey animate-spin" />
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-mist-grey rounded-lg shadow-sm px-1 py-0.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomLevel <= ZOOM_MIN}
              className="p-1.5 rounded hover:bg-mist-grey/50 disabled:opacity-30 transition"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5 text-soft-black" />
            </button>
            <button
              type="button"
              onClick={zoomReset}
              className="px-1.5 py-1 text-[11px] font-medium text-soft-black hover:bg-mist-grey/50 rounded transition min-w-[3rem] text-center"
              title="Reset zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomLevel >= ZOOM_MAX}
              className="p-1.5 rounded hover:bg-mist-grey/50 disabled:opacity-30 transition"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5 text-soft-black" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Page Navigation (mobile) */}
      <div className="sm:hidden bg-white border-t border-mist-grey px-4 py-2 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => goToPage(currentPageIdx - 1)}
          disabled={currentPageIdx <= 0}
          className="p-1.5 rounded-lg hover:bg-mist-grey/50 disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-soft-black font-medium">
          {currentPageIdx + 1} / {book.pages.length}
        </span>
        <button
          type="button"
          onClick={() => goToPage(currentPageIdx + 1)}
          disabled={currentPageIdx >= book.pages.length - 1}
          className="p-1.5 rounded-lg hover:bg-mist-grey/50 disabled:opacity-30 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Modals */}
      <GalleryPicker
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(snapId) => addPhotostripToCanvas(snapId)}
      />
      <StickerPicker
        open={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onSelect={handleAddSticker}
      />
      <BackgroundPicker
        open={bgOpen}
        onClose={() => setBgOpen(false)}
        current={currentPage?.background ?? { type: "color", color: "#FFFFFF" }}
        onChange={handleBgChange}
      />
      <ExportPicker
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pages={book.pages}
        thumbnails={thumbnails}
        onExport={handleExport}
      />
    </div>
  );
}
