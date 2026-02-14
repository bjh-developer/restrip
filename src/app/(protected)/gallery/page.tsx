/**
 * Gallery Page
 *
 * Displays the authenticated user's encrypted memories in a GSAP-powered
 * masonry grid. Images are decrypted client-side then measured for natural
 * height before the masonry layout renders.
 *
 * Features:
 * - True masonry layout with measured image heights
 * - Status indicator overlays (✓ Sent · ⏱ Pending · ✗ Failed)
 * - Right-click context menu for single delete
 * - "Select" mode with checkmarks for batch delete
 * - Lightbox viewer with keyboard navigation
 *
 * @module app/(protected)/gallery/page
 */

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
  CheckCircle2,
  Circle,
  SquareMousePointer,
  CalendarDays,
  ListFilter,
  Menu,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import {
  getEncryptionKey,
  decryptImage,
  decryptDataAsString,
} from "../../../lib/encryption";
import { createClient } from "../../../lib/supabase/client";
import {
  getCachedSnaps,
  setCachedSnaps,
  removeCachedSnap,
  removeCachedSnaps,
  purgeStaleCachedSnaps,
  type CachedSnap,
} from "../../../lib/gallery-cache";
import Masonry, { type MasonryItem } from "../../../../components/Masonry";
import { Skeleton } from "../../../../components/ui/skeleton";

// =============================================================================
// Types
// =============================================================================

/** Raw snap record from the API */
interface SnapRecord {
  id: string;
  storage_path: string;
  encrypted_caption: string;
  caption_iv: string;
  image_iv: string;
  send_date: string;
  send_time: string;
  delivery_method: string;
  delivery_address: string;
  period_type: string;
  delivery_status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/** Snap with decrypted data for display */
interface DecryptedSnap extends SnapRecord {
  decryptedImageUrl: string | null;
  decryptedCaption: string | null;
  /** Natural width of the decoded image (for masonry aspect ratio) */
  naturalWidth: number;
  /** Natural height of the decoded image (for masonry aspect ratio) */
  naturalHeight: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Number of snaps to decrypt concurrently to avoid memory pressure */
const DECRYPT_BATCH_SIZE = 4;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Load a data-URL into an Image to measure its natural dimensions.
 * Returns { width, height } or a fallback on error.
 */
const measureImage = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 300, height: 400 }); // fallback 3:4
    img.src = dataUrl;
  });

// =============================================================================
// Component
// =============================================================================

export default function GalleryPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Data states
  const [snaps, setSnaps] = useState<DecryptedSnap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allDecrypted, setAllDecrypted] = useState(false);
  const [showMasonry, setShowMasonry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSectionSnaps, setLightboxSectionSnaps] = useState<DecryptedSnap[]>([]);

  // Delete / selection
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    snapId: string;
    x: number;
    y: number;
  } | null>(null);

  // Group-by filter
  type GroupBy = "all" | "year" | "month" | "day";
  const [groupBy, setGroupBy] = useState<GroupBy>("all");
  const [groupByOpen, setGroupByOpen] = useState(false);
  
  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lightbox focus trap
  const lightboxRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // Data fetching & decryption
  // =========================================================================

  const fetchAndDecryptGallery = useCallback(async () => {
    try {
      setIsLoading(true);
      setAllDecrypted(false);
      setError(null);

      const response = await fetch("/api/gallery");
      if (!response.ok) {
        let errorMessage = "Failed to fetch gallery";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error ?? errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}`;
          } catch {
            errorMessage = `HTTP ${response.status}`;
          }
        }
        throw new Error(errorMessage);
      }

      const { snaps: rawSnaps } = (await response.json()) as {
        snaps: SnapRecord[];
      };

      if (rawSnaps.length === 0) {
        setSnaps([]);
        setIsLoading(false);
        setAllDecrypted(true);
        return;
      }

      // ----- Cache-first strategy -----
      const allIds = rawSnaps.map((s) => s.id);
      const cached = await getCachedSnaps(allIds);

      // Separate cached vs uncached snaps
      const cachedResults: DecryptedSnap[] = [];
      const uncachedSnaps: SnapRecord[] = [];

      for (const snap of rawSnaps) {
        const hit = cached.get(snap.id);
        if (hit) {
          cachedResults.push({
            ...snap,
            decryptedImageUrl: hit.decryptedImageUrl,
            decryptedCaption: hit.decryptedCaption,
            naturalWidth: hit.naturalWidth,
            naturalHeight: hit.naturalHeight,
          });
        } else {
          uncachedSnaps.push(snap);
        }
      }

      // If everything was cached, we're done instantly
      if (uncachedSnaps.length === 0) {
        setSnaps(cachedResults);
        setIsLoading(false);
        setAllDecrypted(true);
        // Purge stale entries in background
        purgeStaleCachedSnaps(new Set(allIds));
        return;
      }

      setIsLoading(false);

      // Get encryption key (only needed for uncached snaps)
      const encryptionKey = await getEncryptionKey();
      if (!encryptionKey) {
        setError("Encryption key not available. Please sign in again.");
        return;
      }

      const supabase = createClient();
      const freshlyDecrypted: DecryptedSnap[] = [];
      const newCacheEntries: CachedSnap[] = [];

      // Decrypt uncached snaps in batches
      for (let i = 0; i < uncachedSnaps.length; i += DECRYPT_BATCH_SIZE) {
        const batch = uncachedSnaps.slice(i, i + DECRYPT_BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (snap) => {
            // Download encrypted image blob
            const { data: imageBlob, error: dlError } =
              await supabase.storage
                .from("encrypted-images")
                .download(snap.storage_path);

            if (dlError || !imageBlob) {
              throw new Error("Failed to download image");
            }

            // Convert blob to base64
            const arrayBuffer = await imageBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            const chunkSize = 8192;
            for (let j = 0; j < bytes.length; j += chunkSize) {
              const chunk = bytes.subarray(j, Math.min(j + chunkSize, bytes.length));
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64 = btoa(binary);

            // Decrypt image and caption
            const decryptedImageUrl = await decryptImage(base64, snap.image_iv, encryptionKey);
            const decryptedCaption = await decryptDataAsString(
              snap.encrypted_caption,
              snap.caption_iv,
              encryptionKey
            );

            // Measure natural image dimensions
            const { width: naturalWidth, height: naturalHeight } = await measureImage(decryptedImageUrl);

            return {
              ...snap,
              decryptedImageUrl,
              decryptedCaption,
              naturalWidth,
              naturalHeight,
            } satisfies DecryptedSnap;
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            freshlyDecrypted.push(result.value);
            // Queue for cache write
            newCacheEntries.push({
              id: result.value.id,
              decryptedImageUrl: result.value.decryptedImageUrl!,
              decryptedCaption: result.value.decryptedCaption,
              naturalWidth: result.value.naturalWidth,
              naturalHeight: result.value.naturalHeight,
            });
          } else {
            console.error("Decryption failed:", result.reason);
          }
        }
      }

      // Merge cached + freshly decrypted, preserving original API order
      const allDecryptedMap = new Map<string, DecryptedSnap>();
      for (const snap of [...cachedResults, ...freshlyDecrypted]) {
        allDecryptedMap.set(snap.id, snap);
      }
      const orderedResults = rawSnaps
        .map((s) => allDecryptedMap.get(s.id))
        .filter((s): s is DecryptedSnap => s != null);

      setSnaps(orderedResults);
      setAllDecrypted(true);

      // Write new entries to cache and purge stale ones in background
      setCachedSnaps(newCacheEntries);
      purgeStaleCachedSnaps(new Set(allIds));
    } catch (err) {
      console.error("Gallery fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load gallery");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndDecryptGallery();
  }, [fetchAndDecryptGallery]);

  // Show masonry immediately when data is ready (no delay needed with cache)
  useEffect(() => {
    if (allDecrypted && snaps.length > 0) {
      setShowMasonry(true);
    } else {
      setShowMasonry(false);
    }
  }, [allDecrypted, snaps.length]);

  // =========================================================================
  // Context menu & dropdown dismiss
  // =========================================================================

  useEffect(() => {
    if (!contextMenu && !groupByOpen && !mobileMenuOpen) return;
    const dismiss = () => {
      setContextMenu(null);
      setGroupByOpen(false);
      setMobileMenuOpen(false);
    };
    window.addEventListener("click", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [contextMenu, groupByOpen, mobileMenuOpen]);

  // =========================================================================
  // Focus trap for lightbox
  // =========================================================================

  useEffect(() => {
    if (lightboxIndex === null || !lightboxSectionSnaps[lightboxIndex]) return;

    // Save the previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Mark background as inert for screen readers only (not blocking interactions)
    const mainContent = document.getElementById("gallery-content");
    if (mainContent) {
      mainContent.setAttribute("aria-hidden", "true");
    }

    // Focus the close button when lightbox opens
    setTimeout(() => {
      const closeButton = lightboxRef.current?.querySelector('button[aria-label="Close viewer"]') as HTMLElement;
      if (closeButton) {
        closeButton.focus();
      }
    }, 0);

    // Cleanup
    return () => {
      if (mainContent) {
        mainContent.removeAttribute("aria-hidden");
      }
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [lightboxIndex, lightboxSectionSnaps]);

  // =========================================================================
  // Actions
  // =========================================================================

  /** Delete a single snap by ID */
  const handleDelete = async (snapId: string) => {
    if (!confirm("Delete this memory? This action cannot be undone.")) return;

    try {
      setDeletingIds((prev) => new Set(prev).add(snapId));
      const response = await fetch(`/api/gallery/${snapId}`, { method: "DELETE" });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to delete");
      }

      setSnaps((prev) => prev.filter((s) => s.id !== snapId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(snapId);
        return next;
      });

      // Remove from IndexedDB cache
      removeCachedSnap(snapId);

      // Close lightbox if viewing deleted snap
      if (lightboxIndex !== null && snaps[lightboxIndex]?.id === snapId) {
        setLightboxIndex(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete snap");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(snapId);
        return next;
      });
    }
  };

  /** Batch-delete selected snaps */
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} ${count === 1 ? "memory" : "memories"}? This cannot be undone.`))
      return;

    const ids = Array.from(selectedIds);
    setDeletingIds(new Set(ids));

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed");
        return id;
      })
    );

    const deletedIds = new Set(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<string>).value)
    );

    const failedResults = results
      .map((r, index) => ({ result: r, id: ids[index] }))
      .filter(({ result }) => result.status === "rejected");

    const failedIds = new Set(failedResults.map(({ id }) => id));

    // Remove successfully deleted snaps
    setSnaps((prev) => prev.filter((s) => !deletedIds.has(s.id)));

    // Remove from IndexedDB cache
    removeCachedSnaps(Array.from(deletedIds));
    
    // Keep only failed IDs selected for retry
    setSelectedIds(failedIds);
    
    // Clear deleting status
    setDeletingIds(new Set());
    
    // Only exit select mode if all succeeded
    if (failedIds.size === 0) {
      setSelectMode(false);
    }
    
    setLightboxIndex(null);

    // Show error message if any deletions failed
    if (failedIds.size > 0) {
      const failedMessages = failedResults
        .map(({ id, result }) => {
          const reason = (result as PromiseRejectedResult).reason;
          return `${id}: ${reason instanceof Error ? reason.message : String(reason)}`;
        })
        .join(", ");
      alert(
        `Failed to delete ${failedIds.size} ${failedIds.size === 1 ? "memory" : "memories"}. ` +
        `The failed items remain selected for retry. Details: ${failedMessages}`
      );
    }
  };

  /** Toggle selection of a snap */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // =========================================================================
  // Masonry item mapping
  // =========================================================================

  const masonryItems: MasonryItem[] = snaps.map((snap) => ({
    id: snap.id,
    img: snap.decryptedImageUrl ?? "",
    width: snap.naturalWidth,
    height: snap.naturalHeight,
  }));

  // =========================================================================
  // Grouped masonry sections
  // =========================================================================

  const groupedSections = useMemo(() => {
    if (groupBy === "all") return [{ label: null, items: masonryItems, snaps }];

    // Sort snaps by created_at descending
    const sorted = [...snaps].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const groups = new Map<string, { label: string; snapsList: DecryptedSnap[] }>();

    for (const snap of sorted) {
      const date = new Date(snap.created_at);
      let key: string;
      let label: string;

      if (groupBy === "year") {
        key = `${date.getFullYear()}`;
        label = key;
      } else if (groupBy === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } else {
        // day
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        label = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }

      if (!groups.has(key)) {
        groups.set(key, { label, snapsList: [] });
      }
      groups.get(key)!.snapsList.push(snap);
    }

    return Array.from(groups.values()).map(({ label, snapsList }) => ({
      label,
      snaps: snapsList,
      items: snapsList.map((snap) => ({
        id: snap.id,
        img: snap.decryptedImageUrl ?? "",
        width: snap.naturalWidth,
        height: snap.naturalHeight,
      })),
    }));
  }, [snaps, groupBy, masonryItems]);

  const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "all", label: "All Photostrips" },
    { value: "year", label: "Years" },
    { value: "month", label: "Months" },
    { value: "day", label: "Days" },
  ];

  // =========================================================================
  // Masonry callbacks
  // =========================================================================

  const handleItemClick = (id: string, sectionSnaps: DecryptedSnap[]) => {
    if (selectMode) {
      toggleSelect(id);
      return;
    }
    const index = sectionSnaps.findIndex((s) => s.id === id);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxSectionSnaps(sectionSnaps);
    }
  };

  const handleContextMenu = (id: string, event: { clientX: number; clientY: number }) => {
    setContextMenu({ snapId: id, x: event.clientX, y: event.clientY });
  };

  // =========================================================================
  // Masonry overlay renderer
  // =========================================================================

  const renderOverlay = (id: string) => {
    const snap = snaps.find((s) => s.id === id);
    if (!snap) return null;

    return (
      <>
        {/* Status indicator — top-right corner */}
        <div className="absolute top-2 right-2 z-10">
          {snap.delivery_status === "sent" && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/90 text-white text-xs shadow-sm" title="Delivered">
              ✓
            </span>
          )}
          {snap.delivery_status === "pending" && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/90 text-white text-xs shadow-sm" title="Pending">
              ⏱
            </span>
          )}
          {snap.delivery_status === "failed" && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/90 text-white text-xs shadow-sm" title="Failed">
              ✗
            </span>
          )}
        </div>

        {/* Selection checkmark — top-left corner */}
        {selectMode && (
          <div className="absolute top-2 left-2 z-10">
            {selectedIds.has(id) ? (
              <CheckCircle2 className="w-6 h-6 text-white drop-shadow-md" fill="rgba(59,130,246,0.9)" />
            ) : (
              <Circle className="w-6 h-6 text-white/70 drop-shadow-md" />
            )}
          </div>
        )}

        {/* Deleting spinner overlay */}
        {deletingIds.has(id) && (
          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-20">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // Lightbox navigation
  // =========================================================================

  const openLightbox = (index: number) => setLightboxIndex(index);

  const navigateLightbox = (direction: -1 | 1) => {
    if (lightboxIndex === null) return;
    const newIndex = lightboxIndex + direction;
    if (newIndex >= 0 && newIndex < lightboxSectionSnaps.length) {
      setLightboxIndex(newIndex);
    }
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, lightboxSectionSnaps.length]);

  // =========================================================================
  // Render helpers
  // =========================================================================

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const decryptedCount = snaps.length;
  const isDecryptionInProgress = !isLoading && !allDecrypted;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div id="gallery-content" className="container mx-auto px-4 py-8">{/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-soft-black">
            My Gallery
          </h1>
          <p className="text-sm text-grey mt-1">
            {decryptedCount} {decryptedCount === 1 ? "memory" : "memories"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile buttons - shows on small screens */}
          {allDecrypted && snaps.length > 0 && (
            <div className="flex items-center gap-2 sm:hidden">
              {/* Delete mode toggle button */}
              <button
                type="button"
                onClick={() => {
                  setSelectMode((prev) => !prev);
                  setSelectedIds(new Set());
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectMode
                    ? "bg-red-100 text-red-700"
                    : "bg-mist-grey text-soft-black hover:bg-mist-grey/80"
                }`}
                aria-label={selectMode ? "Cancel delete" : "Delete memories"}
              >
                {selectMode ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel
                  </>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>

              {/* Menu button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMobileMenuOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-soft-black text-warm-beige hover:bg-soft-black/90 transition"
                >
                  <Menu className="w-4 h-4" />
                </button>
                {mobileMenuOpen && (
                  <div 
                    className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-mist-grey py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* New Memory option */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/new");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-soft-black hover:bg-mist-grey/30 transition border-b border-mist-grey"
                    >
                      <Plus className="w-4 h-4" />
                      New Memory
                    </button>

                    {/* Group by label */}
                    <div className="px-4 py-1.5 text-xs text-grey font-medium uppercase tracking-wider">
                      Group By
                    </div>

                    {/* Group by options */}
                    {GROUP_BY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupBy(option.value);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                          groupBy === option.value
                            ? "bg-mist-grey/60 text-soft-black font-medium"
                            : "text-soft-black hover:bg-mist-grey/30"
                        }`}
                      >
                        {groupBy === option.value && <span className="text-xs">✓</span>}
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desktop buttons - hidden on small screens */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Group-by dropdown */}
            {allDecrypted && snaps.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupByOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-mist-grey text-soft-black hover:bg-mist-grey/80 transition"
                >
                  <ListFilter className="w-4 h-4" />
                  {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
                </button>
                {groupByOpen && (
                  <div 
                    className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-mist-grey py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {GROUP_BY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupBy(option.value);
                          setGroupByOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                          groupBy === option.value
                            ? "bg-mist-grey/60 text-soft-black font-medium"
                            : "text-soft-black hover:bg-mist-grey/30"
                        }`}
                      >
                        {groupBy === option.value && <span className="text-xs">✓</span>}
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Select mode toggle */}
            {allDecrypted && snaps.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectMode((prev) => !prev);
                  setSelectedIds(new Set());
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectMode
                    ? "bg-blue-100 text-blue-700"
                    : "bg-mist-grey text-soft-black hover:bg-mist-grey/80"
                }`}
              >
                <SquareMousePointer className="w-4 h-4" />
                {selectMode ? "Cancel" : "Select"}
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/new")}
              className="flex items-center gap-2 px-4 py-2 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>
      </div>

      {/* Batch delete bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-800 font-medium">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={handleBatchDelete}
            disabled={deletingIds.size > 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Loading / decrypting state with skeleton masonry */}
      {(isLoading || isDecryptionInProgress || (allDecrypted && !showMasonry && snaps.length > 0)) && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {/* Generate skeleton items with varying heights to mimic masonry */}
            {Array.from({ length: 12 }).map((_, i) => {
              // Create varying heights for a masonry-like appearance
              const heights = ["h-48", "h-64", "h-56", "h-72", "h-60", "h-52"];
              const height = heights[i % heights.length];
              return (
                <Skeleton 
                  key={i} 
                  className={`w-full ${height} rounded-xl`}
                  style={{ 
                    animationDelay: `${i * 50}ms`,
                    animationDuration: '1.5s'
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-center mt-8">
            <span className="text-grey text-sm">
              {isLoading ? "Loading your memories..." : isDecryptionInProgress ? "Decrypting memories..." : ""}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {allDecrypted && snaps.length === 0 && !error && (
        <div className="text-center py-20">
          <ImageOff className="w-12 h-12 text-grey/40 mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold text-soft-black mb-2">
            No photo strips yet
          </h2>
          <p className="text-grey text-sm mb-6">
            Create your first memory to see it here.
          </p>
          <button
            type="button"
            onClick={() => router.push("/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Memory
          </button>
        </div>
      )}

      {/* Masonry Gallery — grouped sections */}
      {showMasonry && snaps.length > 0 && (
        <div className="animate-in fade-in duration-300">
          {groupedSections.map((section, sectionIdx) => (
          <div key={section.label ?? "all"} className={sectionIdx > 0 ? "mt-10" : ""}>
            {/* Section header */}
            {section.label && (
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-display text-xl font-semibold text-soft-black">
                  {section.label}
                </h2>
                <span className="text-xs text-grey ml-1 mt-1">
                  {section.items.length} {section.items.length === 1 ? "strip" : "strips"}
                </span>
              </div>
            )}

            <Masonry
              items={section.items}
              skipPreload
              columnBreakpoints={[4, 4, 3, 3]}
              gap={10}
              scaleOnHover
              hoverScale={0.99}
              duration={0.3}
              onItemClick={(id) => handleItemClick(id, section.snaps)}
              onItemContextMenu={handleContextMenu}
              renderOverlay={renderOverlay}
            />
          </div>
          ))}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-white rounded-xl shadow-xl border border-mist-grey py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const snap = snaps.find((s) => s.id === contextMenu.snapId);
              if (snap) {
                // Find which section this snap belongs to
                const section = groupedSections.find((sec) =>
                  sec.snaps.some((s) => s.id === snap.id)
                );
                if (section) {
                  const idx = section.snaps.findIndex((s) => s.id === snap.id);
                  setLightboxIndex(idx);
                  setLightboxSectionSnaps(section.snaps);
                }
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-soft-black hover:bg-mist-grey/50 transition"
          >
            View
          </button>
          <div className="border-t border-mist-grey my-1" />
          <button
            type="button"
            onClick={() => {
              handleDelete(contextMenu.snapId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxIndex !== null && lightboxSectionSnaps[lightboxIndex] && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition z-10"
            aria-label="Close viewer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous button */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition z-10"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Next button */}
          {lightboxIndex < lightboxSectionSnaps.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition z-10"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-4xl max-h-[85vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxSectionSnaps[lightboxIndex].decryptedImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxSectionSnaps[lightboxIndex].decryptedImageUrl!}
                alt={lightboxSectionSnaps[lightboxIndex].decryptedCaption ?? "Encrypted memory"}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}

            {/* Caption overlay */}
            {lightboxSectionSnaps[lightboxIndex].decryptedCaption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                <p className="text-white text-sm font-caption">
                  {lightboxSectionSnaps[lightboxIndex].decryptedCaption}
                </p>
                <p className="text-white/60 text-xs mt-1">
                  Created {formatDate(lightboxSectionSnaps[lightboxIndex].created_at)} ·{" "}
                  {lightboxSectionSnaps[lightboxIndex].delivery_status === "sent"
                    ? "Delivered"
                    : lightboxSectionSnaps[lightboxIndex].delivery_status === "failed"
                    ? "Failed"
                    : "Pending delivery"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
