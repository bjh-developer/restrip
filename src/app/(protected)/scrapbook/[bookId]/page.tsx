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

 * - Download or share their scrapbook

 *

 * State is auto-saved to localStorage on every change.

 *

 * @module app/(protected)/scrapbook/[bookId]/page

 */


/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */

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

  Share2,

  Loader2,

  X,

  PanelLeftClose,

  PanelLeftOpen,

  ZoomIn,

  ZoomOut,

  // Copy,
  // MousePointer2,
  // Check,

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

import { ShareMenu, type ExportFormat } from "../../../../components/ShareMenu";
import { useTextEditor } from "../../../../hooks/useTextEditor";
import { TextEditorOverlay } from "../../../../components/TextEditorOverlay";



function saveThumbnailCache(

  pageId: string,

  elementCount: number,

  dataUrl: string,

) {

  try {

    sessionStorage.setItem(`thumb:${pageId}:${elementCount}`, dataUrl);

  } catch {
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

    const keys = Object.keys(sessionStorage).filter((k) =>

      k.startsWith(`thumb:${pageId}:`),

    );

    keys.forEach((k) => sessionStorage.removeItem(k));

  } catch {
  }

}



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



function uid(): string {

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



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

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/gallery?pageSize=50");
        const data = await response.json();
        setSnaps(data.snaps ?? []);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open]);



  useEffect(() => {

    if (snaps.length === 0) return;

    snaps.forEach((snap) => {

      if (imageUrls[snap.id]) return;

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

    return () => {

      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));

    };

     

  }, [snaps, imageUrls]);



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

              { }

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



export default function CanvasEditorPage() {

  const params = useParams();

  const router = useRouter();

  const bookId = params.bookId as string;



  const [book, setBook] = useState<Book | null>(null);

  const [currentPageIdx, setCurrentPageIdx] = useState(0);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(

    "idle",

  );



  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const canvasElRef = useRef<HTMLCanvasElement>(null);

  const fabricCanvasRef = useRef<import("fabric").Canvas | null>(null);

  const isInitializedRef = useRef(false);



  const [galleryOpen, setGalleryOpen] = useState(false);

  const [stickerOpen, setStickerOpen] = useState(false);

  const [bgOpen, setBgOpen] = useState(false);

  const [downloadOpen, setDownloadOpen] = useState(false);

  const [mobileShareOpen, setMobileShareOpen] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);



  const [sidebarOpen, setSidebarOpen] = useState(false);



  useEffect(() => {

    setSidebarOpen(window.innerWidth >= 640);

  }, []);



  const [selectionHasObject, setSelectionHasObject] = useState(false);



  const [_selectedIsText, setSelectedIsText] = useState(false);

  const [activeFont, setActiveFont] = useState("Inter");



  const [_selectedText, setSelectedText] = useState<import("fabric").FabricObject | null>(null);

  const textEditor = useTextEditor();





  const [zoomLevel, setZoomLevel] = useState(1.0);

  const zoomLevelRef = useRef(1.0);



  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});



  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const saveCurrentPageRef = useRef<() => void>(() => {});



  const isLoadingPageRef = useRef(false);



  const [isPageLoading, setIsPageLoading] = useState(true);



  const [canvasError, setCanvasError] = useState<{

    user: string;

    detail?: string;

  } | null>(null);



  const currentPage: BookPage | undefined = book?.pages[currentPageIdx];



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



  useEffect(() => {

    if (!book || !canvasElRef.current || isInitializedRef.current) return;



    let cancelled = false;



    async function initFabric() {

      const fabric = await import("fabric");

      if (cancelled) return;



      fabric.FabricObject.prototype.set({

        cornerSize: 16,

        cornerStrokeColor: "#a855f7",

        cornerColor: "#ffffff",

        transparentCorners: false,

        borderScaleFactor: 4,

        padding: 4,

      });



      const canvas = new fabric.Canvas(canvasElRef.current!, {

        width: CANVAS_WIDTH,

        height: CANVAS_HEIGHT,

        backgroundColor: "#FFFFFF",

        selection: true,

        preserveObjectStacking: true,

        selectionBorderColor: "transparent",

        selectionColor: "rgba(168, 85, 247, 0.15)",

        selectionLineWidth: 0,

      });



      fabricCanvasRef.current = canvas;

      isInitializedRef.current = true;



      const _enableNativeTextSelection = () => {

        const hiddenTextarea = document.querySelector('.fabric-textarea-hidden') as HTMLTextAreaElement;

        if (hiddenTextarea) {

          hiddenTextarea.style.cssText += `

            -webkit-user-select: text !important;

            -webkit-touch-callout: default !important;

            user-select: text !important;

            pointer-events: auto !important;

            opacity: 0.01;

          `;

        }

      };



      canvas.on("mouse:down:before", (e) => {
        if (e.target && e.target.type === "textbox") {
          (e.target as import("fabric").Textbox).set({ editable: false });
        }
      });

      let touchStartTime = 0;
      let touchTarget: import("fabric").FabricObject | null = null;
      let longPressTriggered = false;
      const LONG_PRESS_DURATION = 400;

      canvas.on("mouse:down", (e) => {
        if (e.target && e.target.type === "textbox") {
          touchStartTime = Date.now();
          touchTarget = e.target;
          longPressTriggered = false;

          setTimeout(() => {
            if (touchTarget === e.target && !longPressTriggered) {
              longPressTriggered = true;
              canvas.setActiveObject(e.target);
            }
          }, LONG_PRESS_DURATION);
        }
      });

      canvas.on("mouse:up", (e) => {
        const pressDuration = Date.now() - touchStartTime;

        if (e.target && e.target.type === "textbox" && touchTarget === e.target) {
          if (pressDuration < LONG_PRESS_DURATION && !longPressTriggered) {
            const textbox = e.target as import("fabric").Textbox;

            const textContent = textbox.text || "";
            const isPlaceholder = textContent === "Your text here";
            const originalFontSize = textbox.fontSize || 24;
            const instagramFontSize = Math.max(originalFontSize * 1.5, 32);

            textEditor.openEditor({
              text: textContent,
              fontFamily: textbox.fontFamily || "Inter",
              fontSize: instagramFontSize,
              fill: String(textbox.fill) || "#FFFFFF",
              textAlign: (textbox.textAlign as "left" | "center" | "right") || "center",
              backgroundColor: "transparent",
              isPlaceholder,
            });
          }
        }

        touchTarget = null;
        longPressTriggered = false;
      });

      canvas.on("mouse:dblclick", (e) => {
        if (e.target && e.target.type === "textbox") {
          const textbox = e.target as import("fabric").Textbox;

          const textContent = textbox.text || "";
          const isPlaceholder = textContent === "Your text here";
          const originalFontSize = textbox.fontSize || 24;
          const instagramFontSize = Math.max(originalFontSize * 1.5, 32);

          textEditor.openEditor({
            text: textContent,
            fontFamily: textbox.fontFamily || "Inter",
            fontSize: instagramFontSize,
            fill: String(textbox.fill) || "#FFFFFF",
            textAlign: (textbox.textAlign as "left" | "center" | "right") || "center",
            backgroundColor: "transparent",
            isPlaceholder,
          });
        }
      });

      canvas.on("text:editing:entered", (e) => {
        const textbox = e.target as import("fabric").Textbox;
        textbox.exitEditing();

        const textContent = textbox.text || "";
        const isPlaceholder = textContent === "Your text here";
        const originalFontSize = textbox.fontSize || 24;
        const instagramFontSize = Math.max(originalFontSize * 1.5, 32);

        textEditor.openEditor({
          text: textContent,
          fontFamily: textbox.fontFamily || "Inter",
          fontSize: instagramFontSize,
          fill: String(textbox.fill) || "#FFFFFF",
          textAlign: (textbox.textAlign as "left" | "center" | "right") || "center",
          backgroundColor: "transparent",
          isPlaceholder,
        });
      });

      const onChange = () => scheduleSave();

      canvas.on("object:modified", onChange);

      canvas.on("object:added", onChange);

      canvas.on("object:removed", onChange);



      canvas.on("selection:created", (e) => {

        const obj = e.selected?.[0];

        setSelectionHasObject(!!obj);

        if (obj?.type === "textbox") {

          setSelectedIsText(true);

          setActiveFont((obj as import("fabric").Textbox).fontFamily ?? "Inter");

          setSelectedText(obj);

        } else {

          setSelectedIsText(false);

          setSelectedText(null);

        }

      });

      canvas.on("selection:updated", (e) => {

        const obj = e.selected?.[0];

        setSelectionHasObject(!!obj);

        if (obj?.type === "textbox") {

          setSelectedIsText(true);

          setActiveFont((obj as import("fabric").Textbox).fontFamily ?? "Inter");

          setSelectedText(obj);

        } else {

          setSelectedIsText(false);

          setSelectedText(null);

        }

      });

      canvas.on("selection:cleared", () => {

        setSelectionHasObject(false);

        setSelectedIsText(false);

        setSelectedText(null);

      });



      const pages = book!.pages;

      if (pages.length > 1) {

        for (let i = pages.length - 1; i >= 1; i--) {

          const pg = pages[i];

          const cached = readThumbnailCache(pg.id, pg.elements.length);

          if (cached) {

            setThumbnails((prev) => ({ ...prev, [pg.id]: cached }));

          } else {

            await loadPageToCanvas(pg);

          }

        }

      }

      await loadPageToCanvas(pages[0]);

    }



    initFabric();



    return () => {

      cancelled = true;

    };

     

  }, [book]);



  const scheduleSave = useCallback(() => {

    if (isLoadingPageRef.current) return;



    setSaveStatus("saving");

    saveTimerRef.current = setTimeout(() => {

      saveCurrentPageRef.current();

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

     

  }, [bookId]);



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

        textAlign:

          customData.type === "text"

            ? (() => {

                const align = (obj as import("fabric").Textbox).textAlign;

                if (align === "left" || align === "center" || align === "right") return align;

                return "left";

              })()

            : undefined,

      };

      elements.push(el);

    });



    canvas.renderAll();

    const thumbUrl = canvas.toDataURL({ format: "png", multiplier: 0.15 });

    clearThumbnailCache(currentPage.id);

    saveThumbnailCache(currentPage.id, elements.length, thumbUrl);

    setThumbnails((prev) => ({ ...prev, [currentPage.id]: thumbUrl }));



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



  useEffect(() => {

    saveCurrentPageRef.current = saveCurrentPage;

  }, [saveCurrentPage]);



  const loadPageToCanvas = useCallback(

    async (page: BookPage) => {

      const canvas = fabricCanvasRef.current;

      if (!canvas) return;



      const fabric = await import("fabric");



      isLoadingPageRef.current = true;

      setIsPageLoading(true);



      canvas.clear();



      applyBackground(page.background);



      for (const el of page.elements) {

        try {

          if (el.type === "sticker" && el.stickerKey) {

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

              textAlign: el.textAlign || "left",

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

        }

      }



      canvas.discardActiveObject();

      canvas.renderAll();



      const cachedThumb = readThumbnailCache(page.id, page.elements.length);



      await new Promise<void>((resolve) => {

        requestAnimationFrame(() => {

          requestAnimationFrame(() => {

            let thumbUrl: string;

            if (cachedThumb) {

              thumbUrl = cachedThumb;

            } else {

              canvas.renderAll();

              thumbUrl = canvas.toDataURL({ format: "png", multiplier: 0.15 });

              saveThumbnailCache(page.id, page.elements.length, thumbUrl);

            }

            setThumbnails((prev) => ({ ...prev, [page.id]: thumbUrl }));

            isLoadingPageRef.current = false;

            setIsPageLoading(false);

            // Re-apply zoom to maintain consistent zoom level when switching pages
            applyZoom(zoomLevelRef.current);

            resolve();

          });

        });

      });

    },

    []

  );
  const applyBackground = useCallback((bg: PageBackground) => {

    const canvas = fabricCanvasRef.current;

    if (!canvas) return;



    canvas.backgroundColor = bg.color || "#FFFFFF";

    canvas.renderAll();

  }, []);





  const addPhotostripToCanvas = useCallback(

    async (snapId: string, transform?: Partial<PageElement>) => {

      const canvas = fabricCanvasRef.current;

      if (!canvas) return;



      try {

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

    []

  );



  const handleAddSticker = useCallback(async (sticker: StickerDef) => {

    const canvas = fabricCanvasRef.current;

    if (!canvas) return;



    const fabric = await import("fabric");

    const img = await fabric.FabricImage.fromURL(sticker.src);



    img.set({

      left: CANVAS_WIDTH / 2,

      top: CANVAS_HEIGHT / 2,

      scaleX: 0.2,

      scaleY: 0.2,

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





  const _handleFontChange = useCallback(

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

    [scheduleSave]

  );



  const handleAddText = useCallback(async () => {

    const canvas = fabricCanvasRef.current;

    if (!canvas) return;



    const fabric = await import("fabric");



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

    textEditor.openEditor({

      text: "",

      fontFamily: activeFont,

      fontSize: Math.max(24 * 1.5, 32),

      fill: "#FFFFFF",

      textAlign: "center",

      backgroundColor: "transparent",

      isPlaceholder: true,

    });

  }, [activeFont, textEditor]);



  const handleDelete = useCallback(() => {

    const canvas = fabricCanvasRef.current;

    if (!canvas) return;

    const active = canvas.getActiveObject();

    if (!active) return;

    canvas.remove(active);

    canvas.discardActiveObject();

    setSelectedText(null);

    canvas.renderAll();

  }, []);





  useEffect(() => {

    const handler = (e: KeyboardEvent) => {

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {

        const canvas = fabricCanvasRef.current;

        if (!canvas) return;

        const active = canvas.getActiveObject();

        if (

          active &&

          active.type === "textbox" &&

          (active as import("fabric").Textbox).isEditing

        ) {

          e.preventDefault();

          (active as import("fabric").Textbox).selectAll();

          canvas.renderAll();

        }

        return;

      }



      if (e.key === "Delete" || e.key === "Backspace") {

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



  const goToPage = useCallback(

    async (idx: number) => {

      if (!book || idx < 0 || idx >= book.pages.length) return;

      setCurrentPageIdx(idx);

      await loadPageToCanvas(book.pages[idx]);

    },

    [book, loadPageToCanvas]

  );



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



  const handleBgChange = useCallback(

    (bg: PageBackground) => {

      if (!book || !currentPage) return;



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



  const handleExport = useCallback(

    async (pageIndices: number[], format: ExportFormat = "png") => {

      const canvas = fabricCanvasRef.current;

      if (!canvas || !book) return;



      saveCurrentPage();



      const freshBook = book;



      const renderPageDataUrl = async (idx: number): Promise<string | null> => {

        const page = freshBook.pages[idx];

        if (!page) return null;

        await loadPageToCanvas(page);

        await new Promise((resolve) => setTimeout(resolve, 100));

        canvas.discardActiveObject();

        canvas.renderAll();

        return canvas.toDataURL({ format: "png", multiplier: 2 });

      };



      const dataUrlToBlob = (dataUrl: string): Blob => {

        const base64 = dataUrl.split(",")[1];

        const binary = atob(base64);

        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        return new Blob([bytes], { type: "image/png" });

      };



      if (format === "png") {

        for (let i = 0; i < pageIndices.length; i++) {

          const dataUrl = await renderPageDataUrl(pageIndices[i]);

          if (!dataUrl) continue;

          const link = document.createElement("a");

          link.download = `${freshBook.title}-page-${pageIndices[i] + 1}.png`;

          link.href = dataUrl;

          link.click();

          if (i < pageIndices.length - 1)

            await new Promise((resolve) => setTimeout(resolve, 300));

        }

      } else if (format === "pdf") {

        try {

          const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");

          const pdf = new jsPDF({

            orientation: "portrait",

            unit: "px",

            format: [CANVAS_WIDTH, CANVAS_HEIGHT],

            hotfixes: ["px_scaling"],

          });

          for (let i = 0; i < pageIndices.length; i++) {

            const dataUrl = await renderPageDataUrl(pageIndices[i]);

            if (!dataUrl) continue;

            if (i > 0) pdf.addPage();

            pdf.addImage(dataUrl, "PNG", 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          }

          pdf.save(`${freshBook.title}.pdf`);

        } catch (err) {

          console.error("PDF export failed:", err);

          setCanvasError({

            user: "PDF export failed. Falling back to PNG download.",

            detail:

              err instanceof Error ? err.message : "jspdf may not be installed",

          });

          for (const idx of pageIndices) {

            const dataUrl = await renderPageDataUrl(idx);

            if (!dataUrl) continue;

            const link = document.createElement("a");

            link.download = `${freshBook.title}-page-${idx + 1}.png`;

            link.href = dataUrl;

            link.click();

            await new Promise((resolve) => setTimeout(resolve, 300));

          }

        }

      } else if (format === "share") {

        const files: File[] = [];

        for (const idx of pageIndices) {

          const dataUrl = await renderPageDataUrl(idx);

          if (!dataUrl) continue;

          files.push(

            new File(

              [dataUrlToBlob(dataUrl)],

              `${freshBook.title}-page-${idx + 1}.png`,

              { type: "image/png" },

            ),

          );

        }



        if (files.length > 0 && navigator.canShare?.({ files })) {

          navigator

            .share({ files, title: freshBook.title })

            .catch((err: unknown) => {

              if (err instanceof Error && err.name === "InvalidStateError") {

                window.location.reload();

              }


            });

          // Return immediately — do NOT await. iOS freezes the JS event loop

          // while the sheet is visible, so awaiting here hangs the UI.

        } else {

          for (const file of files) {

            const url = URL.createObjectURL(file);

            const a = document.createElement("a");

            a.href = url;

            a.download = file.name;

            a.click();

            URL.revokeObjectURL(url);

            await new Promise((resolve) => setTimeout(resolve, 300));

          }

        }

      }



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



  const getBaseScale = useCallback(() => {

    const container = canvasContainerRef.current;

    if (!container) return 1;

    const isMobile = window.innerWidth < 640;

    const pad = isMobile ? 24 : 56;

    const scaleX = (container.clientWidth - pad) / CANVAS_WIDTH;

    const scaleY = (container.clientHeight - pad) / CANVAS_HEIGHT;

    return Math.min(scaleX, scaleY, 1.0);

  }, []);



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

    const base = getBaseScale();

    const targetZoom = base < 1.0 ? 1.0 / base : 1.0;

    zoomLevelRef.current = targetZoom;

    setZoomLevel(targetZoom);

    applyZoom(targetZoom);

  }, [applyZoom, getBaseScale]);



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

    if (!isPageLoading) applyZoom(zoomLevelRef.current);

  }, [isPageLoading, applyZoom]);



  // ============= Wheel zoom =============

  useEffect(() => {

    const container = canvasContainerRef.current;

    if (!container) return;

    const handleWheel = (e: WheelEvent) => {

      if (e.ctrlKey || e.metaKey) {

        e.preventDefault();

        if (e.deltaY < 0) zoomIn();

        else zoomOut();

      }

    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => container.removeEventListener("wheel", handleWheel);

  }, [zoomIn, zoomOut]);

  useEffect(() => {
    const timer = setTimeout(() => {
      applyZoom(zoomLevelRef.current);
    }, 350);
    return () => clearTimeout(timer);
  }, [sidebarOpen, applyZoom]);

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

      {/* Global styles for native text selection on mobile */}

      <style jsx global>{`

        .fabric-textarea-hidden,

        textarea[class*="fabric"] {

          -webkit-user-select: text !important;

          -webkit-touch-callout: default !important;

          user-select: text !important;

          pointer-events: auto !important;

        }

      `}</style>



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



      {/* ── Top Toolbar ───────────────────────────────────────────────────── */}

      <div className="bg-white border-b border-mist-grey px-3 py-2 flex items-center justify-between gap-1 min-w-0">

        {/* Left: Back + Title + save status */}

        <div className="flex items-center gap-3 min-w-0">

          <button

            type="button"

            onClick={() => {

              saveCurrentPage();

              router.push("/scrapbook");

            }}

            className="p-1.5 rounded-lg hover:bg-mist-grey/50 transition shrink-0"

          >

            <ArrowLeft className="w-5 h-5 text-soft-black" />

          </button>

          <div className="flex items-baseline gap-2 min-w-0">

            <h1 className="font-display text-sm font-bold text-soft-black truncate max-w-[100px] sm:max-w-[180px]">

              {book.title}

            </h1>

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



        {/* Center: editing tools */}

        <div className="flex items-center gap-0.5 min-w-0 shrink">

          <>

            <button

              type="button"

              onClick={() => setGalleryOpen(true)}

              className="flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Add Photo Strip"

            >

              <ImageIcon className="w-4 h-4" />

              <span className="hidden sm:inline">Photo</span>

            </button>

            <button

              type="button"

              onClick={() => setStickerOpen(true)}

              className="flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Add Sticker"

            >

              <Smile className="w-4 h-4" />

              <span className="hidden sm:inline">Sticker</span>

            </button>

            <button

              type="button"

              onClick={handleAddText}

              className="flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Add Text"

            >

              <Type className="w-4 h-4" />

              <span className="hidden sm:inline">Text</span>

            </button>

            <div className="w-px h-6 bg-mist-grey mx-0.5 sm:mx-1" />

            <button

              type="button"

              onClick={() => setBgOpen(true)}

              className="flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Page Background"

            >

              <Palette className="w-4 h-4" />

              <span className="hidden sm:inline">Background</span>

            </button>

            <div className="w-px h-6 bg-mist-grey mx-0.5 sm:hidden" />

            <button

              type="button"

              onClick={() => setDownloadOpen(true)}

              className="sm:hidden p-1.5 rounded-lg text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Download"

              aria-label="Download"

            >

              <Download className="w-4 h-4" />

            </button>

            <button

              type="button"

              onClick={() => setMobileShareOpen(true)}

              className="sm:hidden p-1.5 rounded-lg text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

              title="Share"

              aria-label="Share"

            >

              <Share2 className="w-4 h-4" />

            </button>

          </>

        </div>



        {/* Right: desktop Share + delete only */}

        <div className="flex items-center gap-1 shrink-0">

          {selectionHasObject && (

            <button

              type="button"

              onClick={handleDelete}

              className="p-1.5 rounded-lg text-grey hover:text-red-500 hover:bg-red-50 transition"

              title="Delete Selected"

            >

              <Trash2 className="w-4 h-4" />

            </button>

          )}

          <button

            type="button"

            onClick={() => setShareOpen(true)}

            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"

            title="Share"

          >

            <Share2 className="w-4 h-4" />

            Share

          </button>

        </div>

      </div>



      {/* Main Editor Area */}

      <div className="flex-1 flex overflow-hidden relative mt-1">

        {/* Page Sidebar */}

        <div

          className={`bg-white border-r border-mist-grey flex flex-col transition-all duration-300 ease-out ${

            sidebarOpen

              ? "w-36 sm:w-48 min-w-[9rem] sm:min-w-[12rem]"

              : "w-0 min-w-0 overflow-hidden border-r-0"

          }`}

        >

          <div className="flex items-center justify-between px-3 py-2 border-b border-mist-grey">

            <span className="text-xs font-medium text-soft-black whitespace-nowrap">

              Pages

            </span>

            <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">

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

                onClick={() => {

                  if (idx !== currentPageIdx) {

                    goToPage(idx);

                  }

                }}

                className={`w-full group relative aspect-[595/842] rounded-lg border-2 transition overflow-hidden cursor-pointer ${

                  idx === currentPageIdx

                    ? "border-soft-black shadow-sm"

                    : "border-mist-grey hover:border-soft-black/50"

                }`}

              >

                {thumbnails[page.id] ? (

                   

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

                {book.pages.length > 1 && idx === currentPageIdx && (

                  <button

                    type="button"

                    onClick={async (e) => {

                      e.stopPropagation();

                      handleDeletePage();

                    }}

                    className="absolute top-1 right-1 p-0.5 rounded bg-white/60 hover:bg-red-50 transition"

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

          onClick={(e) => {

            const target = e.target as HTMLElement;

            if (!target.closest('[class*="text-toolbar"]') && !target.closest('button')) {

              setSelectedText(null);

            }

          }}

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



      {/* ── Bottom nav (mobile only) — chevrons + page counter only ───────── */}

      <div className="sm:hidden bg-white border-t border-mist-grey px-4 py-2 flex items-center justify-between">

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



      {/* ── Modals ────────────────────────────────────────────────────────── */}

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



      {/* Mobile: Download button → PNG + PDF only */}

      <ShareMenu

        open={downloadOpen}

        onClose={() => setDownloadOpen(false)}

        pages={book.pages}

        thumbnails={thumbnails}

        currentPageIdx={currentPageIdx}

        onExportPages={handleExport}

        variant="download"

      />



      {/* Mobile: Share button → native share only */}

      <ShareMenu

        open={mobileShareOpen}

        onClose={() => setMobileShareOpen(false)}

        pages={book.pages}

        thumbnails={thumbnails}

        currentPageIdx={currentPageIdx}

        onExportPages={handleExport}

        variant="share"

      />



      {/* Desktop: Share button → PNG + PDF + native share (if available) */}

      <ShareMenu

        open={shareOpen}

        onClose={() => setShareOpen(false)}

        pages={book.pages}

        thumbnails={thumbnails}

        currentPageIdx={currentPageIdx}

        onExportPages={handleExport}

        variant="all"

      />



      <TextEditorOverlay
        isOpen={textEditor.isOpen}
        textValue={textEditor.textValue}
        styles={textEditor.styles}
        showColorPicker={textEditor.showColorPicker}
        showBgColorPicker={textEditor.showBgColorPicker}
        viewportHeight={textEditor.viewportHeight}
        fontOptions={FONT_OPTIONS}
        onTextChange={textEditor.setTextValue}
        onDone={() => {
          const result = textEditor.closeEditor();
          if (result && fabricCanvasRef.current) {
            const textbox = fabricCanvasRef.current.getActiveObject();
            if (textbox && textbox.type === "textbox") {
              (textbox as import("fabric").Textbox).set({
                text: result.text,
                fontFamily: result.styles.fontFamily,
                fill: result.styles.fill,
                textAlign: result.styles.textAlign,
                backgroundColor: result.styles.backgroundColor,
              });
              fabricCanvasRef.current.renderAll();
              scheduleSave();
            }
          }
        }}
        onToggleColorPicker={textEditor.toggleColorPicker}
        onToggleBgColorPicker={textEditor.toggleBgColorPicker}
        onColorSelect={(color) => textEditor.setStyles({ fill: color })}
        onBgColorSelect={(color) => textEditor.setStyles({ backgroundColor: color })}
        onCycleAlign={textEditor.cycleTextAlign}
        onCycleFont={() => textEditor.cycleFont(FONT_OPTIONS)}
        onKeyDown={textEditor.handleKeyDown}
      />

    </div>

  );

}
