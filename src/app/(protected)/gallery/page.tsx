/**
 * Gallery Page
 *
 * Displays the authenticated user's memories in a GSAP-powered
 * masonry grid. Images are loaded via signed URLs from the API.
 *
 * Features:
 * - True masonry layout with measured image heights
 * - Status indicator overlays (✓ Sent · 🗓 Scheduled · ✗ Failed)
 * - Right-click context menu for single delete
 * - "Select" mode with checkmarks for batch delete
 * - Lightbox viewer with keyboard navigation
 *
 * @module app/(protected)/gallery/page
 */

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
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
  ListFilter,
  Menu,
  RefreshCw,
} from "lucide-react";
import Masonry, { type MasonryItem } from "../../../../components/Masonry";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  getCachedImage,
  setCachedImage,
  getCachedIds,
  removeCachedImage,
} from "../../../lib/gallery-cache";

// =============================================================================
// Types
// =============================================================================

/** Snap metadata from the gallery API (no image data) */
interface SnapRecord {
  id: string;
  storage_path: string;
  caption: string;
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

/** Snap ready for display with image URL and measured dimensions */
interface DisplaySnap extends SnapRecord {
  /** Object URL or /api/images/[id] URL for the image */
  image_url: string | null;
  /** Natural width of the image (for masonry aspect ratio) */
  naturalWidth: number;
  /** Natural height of the image (for masonry aspect ratio) */
  naturalHeight: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Number of images to load concurrently to avoid memory pressure */
const LOAD_BATCH_SIZE = 4;

/** SWR fetcher for gallery metadata */
const galleryFetcher = async (url: string): Promise<{ snaps: SnapRecord[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? message;
    } catch {
      try { message = (await res.text()) || message; } catch { /* noop */ }
    }
    throw new Error(message);
  }
  return res.json();
};

// =============================================================================
// Helpers & Components
// =============================================================================

/**
 * Delete confirmation modal component
 * Shows a custom confirmation dialog instead of native confirm()
 */
interface DeleteConfirmModalProps {
  open: boolean;
  snapCount: number;
  isSingleSnap: boolean;
  selectedSnap?: DisplaySnap;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  open,
  snapCount,
  isSingleSnap,
  selectedSnap,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div
        className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-300"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h2 id="delete-title" className="font-display text-lg font-bold text-soft-black text-center mb-2">
          Are you sure you want to delete{" "}
          {isSingleSnap ? "photo strip" : `${snapCount} photo strip${snapCount !== 1 ? "s" : ""}`}?
        </h2>

        {/* Description with warning */}
        <p id="delete-desc" className="text-sm text-grey text-center mb-4">
          This action cannot be undone.
        </p>

        {/* Warning note if snap hasn't been delivered */}
        {isSingleSnap && selectedSnap && selectedSnap.delivery_status !== "sent" && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800 flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">⚠</span>
              <span>This memory will not be delivered anymore.</span>
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-mist-grey text-soft-black hover:bg-mist-grey/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>Delete {isSingleSnap ? "Photo" : "Photos"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function GalleryPage() {
  const router = useRouter();

  // SWR — metadata cache (persists across navigations, shows stale data instantly)
  const {
    data: galleryData,
    isLoading: swrLoading,
    error: swrError,
    mutate: mutateGallery,
  } = useSWR("/api/gallery", galleryFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  });

  // Derived loading/error state
  const isLoading = swrLoading;
  const allLoaded = !swrLoading;
  const error = swrError ? (swrError as Error).message : null;

  // Display snaps (metadata + image URLs merged)
  const [snaps, setSnaps] = useState<DisplaySnap[]>([]);
  const [showMasonry, setShowMasonry] = useState(false);

  // Track which snap IDs have had image loading initiated (avoids double-loading on revalidation)
  const loadedSnapIdsRef = useRef<Set<string>>(new Set());

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSectionSnaps, setLightboxSectionSnaps] = useState<DisplaySnap[]>([]);

  // Delete / selection
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState<"single" | "batch">("single");
  const [deletePendingSnapId, setDeletePendingSnapId] = useState<string | null>(null);

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

  // Track active object URLs for cleanup
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  // =========================================================================
  // Data fetching — metadata first, then images progressively
  // =========================================================================

  /**
   * Load a single snap's image: check IndexedDB cache first, then fetch
   * from /api/images/[id]. Creates an object URL and updates state.
   */
  const loadSnapImage = useCallback(
    async (snapId: string, cachedIds: Set<string>) => {
      try {
        let blob: Blob | null = null;

        // 1. Try IndexedDB cache
        if (cachedIds.has(snapId)) {
          blob = await getCachedImage(snapId);
        }

        // 2. Fall back to network fetch
        if (!blob) {
          const res = await fetch(`/api/images/${snapId}`);
          if (!res.ok) {
            console.error(`[Gallery] Image fetch failed for ${snapId}: ${res.status}`);
            return;
          }
          blob = await res.blob();
          // Cache for next time
          await setCachedImage(snapId, blob);
        }

        // Create object URL
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.set(snapId, url);

        // Measure dimensions inline (avoid callback dependency)
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 300, height: 400 });
          img.src = url;
        });

        // Update this snap in state
        setSnaps((prev) =>
          prev.map((s) =>
            s.id === snapId
              ? { ...s, image_url: url, naturalWidth: dims.width, naturalHeight: dims.height }
              : s,
          ),
        );
      } catch (err) {
        console.error(`[Gallery] Image load error for ${snapId}:`, err);
      }
    },
    [], // No dependencies — all state updates use functional form
  );

  // Sync SWR metadata into snaps state + trigger progressive image loading
  useEffect(() => {
    if (!galleryData) return;
    const rawSnaps = galleryData.snaps;

    // Merge fresh metadata with any already-loaded image URLs / dimensions
    setSnaps((prev) => {
      const existing = new Map(prev.map((s) => [s.id, s]));
      return rawSnaps.map((raw) => {
        const cur = existing.get(raw.id);
        return {
          ...raw,
          image_url: cur?.image_url ?? null,
          naturalWidth: cur?.naturalWidth ?? 300,
          naturalHeight: cur?.naturalHeight ?? 400,
        };
      });
    });

    // Start image loading only for IDs we haven't processed yet
    const newIds = rawSnaps.map((s) => s.id).filter((id) => !loadedSnapIdsRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => loadedSnapIdsRef.current.add(id));

    (async () => {
      const cachedIds = await getCachedIds();
      const cached = newIds.filter((id) => cachedIds.has(id));
      const uncached = newIds.filter((id) => !cachedIds.has(id));

      if (cached.length > 0) {
        await Promise.all(cached.map((id) => loadSnapImage(id, cachedIds)));
      }
      for (let i = 0; i < uncached.length; i += LOAD_BATCH_SIZE) {
        const batch = uncached.slice(i, i + LOAD_BATCH_SIZE);
        await Promise.all(batch.map((id) => loadSnapImage(id, cachedIds)));
      }
    })();
  }, [galleryData, loadSnapImage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
      loadedSnapIdsRef.current.clear();
    };
  }, []);

  // Manual refresh — clear local image state and force SWR revalidation
  const handleRefresh = useCallback(() => {
    for (const url of objectUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
    loadedSnapIdsRef.current.clear();
    setSnaps([]);
    mutateGallery();
  }, [mutateGallery]);

  // Show masonry as soon as metadata is ready (images load progressively)
  useEffect(() => {
    if (!isLoading && snaps.length > 0) {
      setShowMasonry(true);
    } else {
      setShowMasonry(false);
    }
  }, [isLoading, snaps.length]);

  // Count how many images have loaded
  const loadedImageCount = snaps.filter((s) => s.image_url !== null).length;
  const isLoadingImages = !isLoading && snaps.length > 0 && loadedImageCount === 0;

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

  /** Show delete confirmation modal for a single snap */
  const showDeleteConfirmation = (snapId: string) => {
    setDeletePendingSnapId(snapId);
    setDeleteModalMode("single");
    setDeleteModalOpen(true);
  };

  /** Confirm and execute single snap deletion */
  const confirmDeleteSingleSnap = async () => {
    if (!deletePendingSnapId) return;
    const snapId = deletePendingSnapId;

    try {
      setDeletingIds((prev) => new Set(prev).add(snapId));
      const response = await fetch(`/api/gallery/${snapId}`, { method: "DELETE" });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to delete");
      }

      // Remove from IndexedDB cache and revoke object URL
      await removeCachedImage(snapId);
      const objUrl = objectUrlsRef.current.get(snapId);
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
        objectUrlsRef.current.delete(snapId);
      }

      setSnaps((prev) => prev.filter((s) => s.id !== snapId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(snapId);
        return next;
      });

      // Close lightbox if viewing deleted snap
      if (lightboxIndex !== null && snaps[lightboxIndex]?.id === snapId) {
        setLightboxIndex(null);
      }

      setDeleteModalOpen(false);
      setDeletePendingSnapId(null);

      // Remove from SWR cache so it doesn't reappear on next revisit
      mutateGallery(
        (prev) => prev ? { ...prev, snaps: prev.snaps.filter((s) => s.id !== snapId) } : prev,
        false,
      );
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

  /** Wrapper for context menu delete - show confirmation */
  const handleDelete = (snapId: string) => {
    showDeleteConfirmation(snapId);
  };

  /** Show delete confirmation modal for batch delete */
  const showBatchDeleteConfirmation = () => {
    if (selectedIds.size === 0) return;
    setDeleteModalMode("batch");
    setDeleteModalOpen(true);
  };

  /** Confirm and execute batch deletion */
  const confirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;

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

    // Clean up IndexedDB cache and object URLs for deleted snaps
    for (const id of deletedIds) {
      removeCachedImage(id);
      const objUrl = objectUrlsRef.current.get(id);
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
        objectUrlsRef.current.delete(id);
      }
    }

    const failedResults = results
      .map((r, index) => ({ result: r, id: ids[index] }))
      .filter(({ result }) => result.status === "rejected");

    const failedIds = new Set(failedResults.map(({ id }) => id));

    // Remove successfully deleted snaps
    setSnaps((prev) => prev.filter((s) => !deletedIds.has(s.id)));
    
    // Keep only failed IDs selected for retry
    setSelectedIds(failedIds);
    
    // Clear deleting status
    setDeletingIds(new Set());
    
    // Only exit select mode if all succeeded
    if (failedIds.size === 0) {
      setSelectMode(false);
    }
    
    setLightboxIndex(null);

    // Close modal and reset state
    setDeleteModalOpen(false);

    // Remove deleted snaps from SWR cache
    mutateGallery(
      (prev) => prev ? { ...prev, snaps: prev.snaps.filter((s) => !deletedIds.has(s.id)) } : prev,
      false,
    );

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

  /** Wrapper for batch delete button - show confirmation */
  const handleBatchDelete = () => {
    showBatchDeleteConfirmation();
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
  // Masonry item mapping (only include snaps with loaded images)
  // =========================================================================

  const masonryItems: MasonryItem[] = snaps
    .filter((snap) => snap.image_url !== null)
    .map((snap) => ({
      id: snap.id,
      img: snap.image_url!,
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

    const groups = new Map<string, { label: string; snapsList: DisplaySnap[] }>();

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
      items: snapsList
        .filter((snap) => snap.image_url !== null)
        .map((snap) => ({
          id: snap.id,
          img: snap.image_url!,
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

  const handleItemClick = (id: string, sectionSnaps: DisplaySnap[]) => {
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
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/90 text-white text-xs shadow-sm" title="Scheduled">
              🗓
            </span>
          )}
          {snap.delivery_status === "scheduled" && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/90 text-white text-xs shadow-sm" title="Scheduled">
              🗓
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

  const loadedCount = snaps.length;

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
            {loadedCount} {loadedCount === 1 ? "memory" : "memories"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile buttons - shows on small screens */}
          {allLoaded && snaps.length > 0 && (
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
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-soft-black hover:bg-mist-grey/30 transition"
                    >
                      <Plus className="w-4 h-4" />
                      New Memory
                    </button>

                    {/* Refresh option */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefresh();
                        setMobileMenuOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-soft-black hover:bg-mist-grey/30 transition border-b border-mist-grey disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
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
            {allLoaded && snaps.length > 0 && (
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
            {allLoaded && snaps.length > 0 && (
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

            {/* Refresh button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-mist-grey text-soft-black hover:bg-mist-grey/80 transition disabled:opacity-50"
              title="Refresh gallery"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

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

      {/* Loading skeleton (during metadata fetch or initial image load) */}
      {(isLoading || isLoadingImages) && (
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
              {isLoading ? "Loading your memories..." : isLoadingImages ? "Loading images..." : ""}
            </span>
          </div>
        </div>
      )}

      {/* Empty state — only show when SWR has confirmed zero snaps */}
      {!swrLoading && galleryData !== undefined && galleryData.snaps.length === 0 && !error && (
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
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-soft-black"
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
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        snapCount={deleteModalMode === "batch" ? selectedIds.size : 1}
        isSingleSnap={deleteModalMode === "single"}
        selectedSnap={deletePendingSnapId ? snaps.find((s) => s.id === deletePendingSnapId) : undefined}
        onConfirm={deleteModalMode === "single" ? confirmDeleteSingleSnap : confirmBatchDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeletePendingSnapId(null);
        }}
        isDeleting={deletingIds.size > 0}
      />

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
            {lightboxSectionSnaps[lightboxIndex].image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxSectionSnaps[lightboxIndex].image_url!}
                alt={lightboxSectionSnaps[lightboxIndex].caption ?? "Memory"}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}

            {/* Caption overlay */}
            {lightboxSectionSnaps[lightboxIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                <p className="text-white text-sm font-caption">
                  {lightboxSectionSnaps[lightboxIndex].caption}
                </p>
                <p className="text-white/60 text-xs mt-1">
                  Created {formatDate(lightboxSectionSnaps[lightboxIndex].created_at)} ·{" "}
                  {lightboxSectionSnaps[lightboxIndex].delivery_status === "sent"
                    ? "Delivered"
                    : lightboxSectionSnaps[lightboxIndex].delivery_status === "scheduled" ||
                      lightboxSectionSnaps[lightboxIndex].delivery_status === "pending"
                    ? "Scheduled"
                    : lightboxSectionSnaps[lightboxIndex].delivery_status === "failed"
                    ? "Failed"
                    : "Scheduled"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
