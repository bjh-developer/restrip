/**
 * Gallery Page
 *
 * Displays the authenticated user's encrypted memories in a responsive grid.
 * Each snap card shows a thumbnail (client-side decrypted) with metadata.
 * Supports deletion and a lightbox viewer.
 *
 * @module app/(protected)/gallery/page
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import {
  getEncryptionKey,
  decryptImage,
  decryptDataAsString,
} from "../../../lib/encryption";
import { createClient } from "../../../lib/supabase/client";

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
  isDecrypting: boolean;
  decryptError: string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Number of snaps to decrypt concurrently to avoid memory pressure */
const DECRYPT_BATCH_SIZE = 4;

// =============================================================================
// Component
// =============================================================================

export default function GalleryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [snaps, setSnaps] = useState<DecryptedSnap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // =========================================================================
  // Data fetching & decryption
  // =========================================================================

  /**
   * Fetches gallery snaps from the API, then decrypts each one client-side.
   */
  const fetchAndDecryptGallery = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch snap records from API
      const response = await fetch("/api/gallery");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to fetch gallery");
      }

      const { snaps: rawSnaps } = (await response.json()) as {
        snaps: SnapRecord[];
      };

      // Initialize snaps in "decrypting" state
      const initialSnaps: DecryptedSnap[] = rawSnaps.map((snap) => ({
        ...snap,
        decryptedImageUrl: null,
        decryptedCaption: null,
        isDecrypting: true,
        decryptError: null,
      }));

      setSnaps(initialSnaps);
      setIsLoading(false);

      // Get encryption key
      const encryptionKey = await getEncryptionKey();
      if (!encryptionKey) {
        setError("Encryption key not available. Please sign in again.");
        return;
      }

      // Decrypt snaps in batches to manage memory
      const supabase = createClient();

      for (let i = 0; i < initialSnaps.length; i += DECRYPT_BATCH_SIZE) {
        const batch = initialSnaps.slice(i, i + DECRYPT_BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (snap) => {
            try {
              // Download encrypted image blob
              const { data: imageBlob, error: dlError } =
                await supabase.storage
                  .from("encrypted-images")
                  .download(snap.storage_path);

              if (dlError || !imageBlob) {
                throw new Error("Failed to download image");
              }

              // Convert blob to base64 (chunked for large files)
              const arrayBuffer = await imageBlob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              let binary = "";
              const chunkSize = 8192;
              for (let j = 0; j < bytes.length; j += chunkSize) {
                const chunk = bytes.subarray(
                  j,
                  Math.min(j + chunkSize, bytes.length),
                );
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              const base64 = btoa(binary);

              // Decrypt image and caption
              const decryptedImageUrl = await decryptImage(
                base64,
                snap.image_iv,
                encryptionKey,
              );
              const decryptedCaption = await decryptDataAsString(
                snap.encrypted_caption,
                snap.caption_iv,
                encryptionKey,
              );

              return {
                id: snap.id,
                decryptedImageUrl,
                decryptedCaption,
              };
            } catch (err) {
              return {
                id: snap.id,
                error:
                  err instanceof Error ? err.message : "Decryption failed",
              };
            }
          }),
        );

        // Update state with decrypted results
        setSnaps((prev) =>
          prev.map((snap) => {
            const result = results.find((r) => {
              if (r.status === "fulfilled") return r.value.id === snap.id;
              return false;
            });

            if (!result || result.status === "rejected") return snap;

            const value = result.value;
            if ("error" in value) {
              return {
                ...snap,
                isDecrypting: false,
                decryptError: value.error as string,
              };
            }

            return {
              ...snap,
              decryptedImageUrl: value.decryptedImageUrl,
              decryptedCaption: value.decryptedCaption,
              isDecrypting: false,
              decryptError: null,
            };
          }),
        );
      }
    } catch (err) {
      console.error("Gallery fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load gallery");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndDecryptGallery();
  }, [fetchAndDecryptGallery]);

  // =========================================================================
  // Actions
  // =========================================================================

  /** Delete a snap by ID */
  const handleDelete = async (snapId: string) => {
    if (!confirm("Delete this memory? This action cannot be undone.")) return;

    try {
      setDeletingId(snapId);

      const response = await fetch(`/api/gallery/${snapId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to delete");
      }

      // Remove from local state
      setSnaps((prev) => prev.filter((s) => s.id !== snapId));

      // Close lightbox if viewing deleted snap
      if (lightboxIndex !== null && snaps[lightboxIndex]?.id === snapId) {
        setLightboxIndex(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete snap");
    } finally {
      setDeletingId(null);
    }
  };

  /** Open lightbox at index */
  const openLightbox = (index: number) => setLightboxIndex(index);

  /** Navigate lightbox */
  const navigateLightbox = (direction: -1 | 1) => {
    if (lightboxIndex === null) return;
    const newIndex = lightboxIndex + direction;
    if (newIndex >= 0 && newIndex < snaps.length) {
      setLightboxIndex(newIndex);
    }
  };

  // =========================================================================
  // Keyboard navigation for lightbox
  // =========================================================================

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
  }, [lightboxIndex, snaps.length]);

  // =========================================================================
  // Render helpers
  // =========================================================================

  /** Format a date string for display */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /** Get delivery status badge */
  const getStatusBadge = (snap: DecryptedSnap) => {
    if (snap.delivery_status === 'sent') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Delivered
        </span>
      );
    }
    if (snap.delivery_status === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ✗ Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-soft-black">
            My Gallery
          </h1>
          <p className="text-sm text-grey mt-1">
            {snaps.length} {snaps.length === 1 ? "photo strip memory" : "photo strip memories"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/new")}
          className="flex items-center gap-2 px-4 py-2 bg-soft-black text-warm-beige rounded-lg hover:bg-soft-black/90 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Memory
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-grey" />
          <span className="ml-2 text-grey">Loading your memories...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && snaps.length === 0 && !error && (
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

      {/* Gallery Grid */}
      {!isLoading && snaps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {snaps.map((snap, index) => (
            <div
              key={snap.id}
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden group"
            >
              {/* Image area */}
              <button
                type="button"
                onClick={() => {
                  if (snap.decryptedImageUrl) openLightbox(index);
                }}
                className="w-full aspect-[3/4] relative bg-mist-grey overflow-hidden"
                disabled={!snap.decryptedImageUrl}
              >
                {snap.isDecrypting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-grey" />
                  </div>
                )}
                {snap.decryptError && (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <p className="text-xs text-red-500 text-center">
                      {snap.decryptError}
                    </p>
                  </div>
                )}
                {snap.decryptedImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={snap.decryptedImageUrl}
                    alt={snap.decryptedCaption ?? "Encrypted memory"}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                )}
              </button>

              {/* Metadata area */}
              <div className="p-3">
                {/* Caption */}
                <p className="text-sm text-soft-black font-caption line-clamp-2 mb-2">
                  {snap.decryptedCaption ?? (
                    <span className="text-grey italic">Decrypting...</span>
                  )}
                </p>

                {/* Date & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-grey">
                    <Calendar className="w-3 h-3" />
                    {formatDate(snap.created_at)}
                  </div>
                  {getStatusBadge(snap)}
                </div>

                {/* Delete button */}
                <div className="mt-2 pt-2 border-t border-mist-grey">
                  <button
                    type="button"
                    onClick={() => handleDelete(snap.id)}
                    disabled={deletingId === snap.id}
                    className="flex items-center gap-1 text-xs text-grey hover:text-red-600 transition disabled:opacity-50"
                  >
                    {deletingId === snap.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxIndex !== null && snaps[lightboxIndex] && (
        <div
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
          {lightboxIndex < snaps.length - 1 && (
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
            {snaps[lightboxIndex].decryptedImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snaps[lightboxIndex].decryptedImageUrl!}
                alt={
                  snaps[lightboxIndex].decryptedCaption ?? "Encrypted memory"
                }
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}

            {/* Caption overlay */}
            {snaps[lightboxIndex].decryptedCaption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                <p className="text-white text-sm font-caption">
                  {snaps[lightboxIndex].decryptedCaption}
                </p>
                <p className="text-white/60 text-xs mt-1">
                  {formatDate(snaps[lightboxIndex].send_date)} ·{" "}
                  {snaps[lightboxIndex].delivery_status === 'sent'
                    ? "Delivered"
                    : snaps[lightboxIndex].delivery_status === 'failed'
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
