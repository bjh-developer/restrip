/**
 * Scrapbook — Books Page
 *
 * Lists all the user's scrapbooks in a grid. Users can create a
 * new book (with title + cover color) or click an existing one
 * to open the page editor.
 *
 * Data is persisted in Supabase via the Scrapbook API.
 *
 * @module app/(protected)/scrapbook/page
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  BookOpen,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { Book } from "../../../lib/scrapbook-types";
import { COVER_COLORS } from "../../../lib/scrapbook-types";
import {
  fetchBooks,
  createBookApi,
  deleteBookApi,
  updateBookApi,
} from "../../../lib/scrapbook-api";
import { Skeleton } from "../../../../components/ui/skeleton";

// =============================================================================
// Create / Edit Book Modal
// =============================================================================

interface BookModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
  initial?: { title: string; coverColor: string };
}

function BookModal({ open, onClose, onSave, initial }: BookModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.coverColor ?? COVER_COLORS[0]);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setColor(initial?.coverColor ?? COVER_COLORS[0]);
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-soft-black">
            {initial ? "Edit Book" : "New Book"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-mist-grey/50 transition"
          >
            <X className="w-5 h-5 text-grey" />
          </button>
        </div>

        {/* Title */}
        <label className="block text-sm font-medium text-soft-black mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Scrapbooks"
          maxLength={50}
          className="w-full rounded-lg border border-mist-grey px-3 py-2 text-sm focus:border-blush-pink focus:ring-1 focus:ring-blush-pink outline-none transition mb-4"
          autoFocus
        />

        {/* Cover Color */}
        <label className="block text-sm font-medium text-soft-black mb-2">
          Cover Color
        </label>
        <div className="flex flex-wrap gap-2 mb-6">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition ${
                color === c
                  ? "border-soft-black scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (title.trim()) {
                onSave(title.trim(), color);
              }
            }}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-soft-black text-white hover:bg-soft-black/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {initial ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Books Page
// =============================================================================

export default function CanvasPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Delete / selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Load books from API
  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .finally(() => setLoading(false));
  }, []);

  /** Create a new book and navigate to the editor */
  const handleCreate = useCallback(
    async (title: string, color: string) => {
      const book = await createBookApi(title, color);
      if (!book) return;
      setModalOpen(false);
      router.push(`/scrapbook/${book.id}`);
    },
    [router],
  );

  /** Update existing book */
  const handleUpdate = useCallback(
    async (title: string, color: string) => {
      if (!editingBook) return;
      await updateBookApi(editingBook.id, { title, coverColor: color });
      const refreshed = await fetchBooks();
      setBooks(refreshed);
      setEditingBook(null);
    },
    [editingBook],
  );

  /** Batch-delete selected books */
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        `Delete ${count} ${count === 1 ? "book" : "books"} and all their pages? This cannot be undone.`,
      )
    )
      return;

    const ids = Array.from(selectedIds);
    setDeletingIds(new Set(ids));

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        await deleteBookApi(id);
        return id;
      }),
    );

    const deletedIds = new Set(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<string>).value),
    );

    const failedResults = results
      .map((r, index) => ({ result: r, id: ids[index] }))
      .filter(({ result }) => result.status === "rejected");

    const failedIds = new Set(failedResults.map(({ id }) => id));

    // Remove successfully deleted books
    setBooks((prev) => prev.filter((b) => !deletedIds.has(b.id)));

    // Keep only failed IDs selected for retry
    setSelectedIds(failedIds);

    // Clear deleting status
    setDeletingIds(new Set());

    // Only exit select mode if all succeeded
    if (failedIds.size === 0) {
      setSelectMode(false);
    }

    // Show error message if any deletions failed
    if (failedIds.size > 0) {
      alert(
        `Failed to delete ${failedIds.size} ${failedIds.size === 1 ? "book" : "books"}. ` +
          `The failed items remain selected for retry.`,
      );
    }
  }, [selectedIds]);

  /** Toggle selection of a book */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-soft-black">
            My Scrapbooks
          </h1>
          <p className="text-sm text-grey mt-1">
            Create books, add pages, and decorate with your photo strips &amp;
            stickers.
          </p>
        </div>

        {/* Delete mode controls */}
        {!loading && books.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Batch delete button (shows when items selected) */}
            {selectMode && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={deletingIds.size > 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {deletingIds.size > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedIds.size})
                  </>
                )}
              </button>
            )}

            {/* Delete mode toggle */}
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
              aria-label={selectMode ? "Cancel delete" : "Delete books"}
            >
              {selectMode ? (
                <>
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* New Book Card */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group flex flex-col items-center justify-center aspect-[3/4] rounded-xl border-2 border-dashed border-mist-grey hover:border-blush-pink bg-white/50 hover:bg-blush-pink/5 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-mist-grey/50 group-hover:bg-blush-pink/20 flex items-center justify-center transition mb-2">
              <Plus className="w-6 h-6 text-grey group-hover:text-soft-black transition" />
            </div>
            <span className="text-sm font-medium text-grey group-hover:text-soft-black transition">
              New Book
            </span>
          </button>

          {/* Existing Books */}
          {books.map((book) => (
            <div
              key={book.id}
              onClick={() => {
                if (selectMode) {
                  toggleSelect(book.id);
                } else {
                  router.push(`/scrapbook/${book.id}`);
                }
              }}
              className="group relative flex flex-col aspect-[3/4] rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden hover:-translate-y-0.5 cursor-pointer"
              style={{ backgroundColor: book.coverColor }}
            >
              {/* Book decoration */}
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <BookOpen className="w-10 h-10 text-soft-black/30 mb-2" />
                <h3 className="font-display text-sm font-bold text-soft-black text-center line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-xs text-soft-black/50 mt-1">
                  {book.pages.length}{" "}
                  {book.pages.length === 1 ? "page" : "pages"}
                </p>
              </div>

              {/* Spine decoration */}
              <div
                className="absolute left-0 top-0 bottom-0 w-3 opacity-20"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 100%)",
                }}
              />

              {/* Edit button (desktop hover only) */}
              {!selectMode && (
                <div className="absolute top-2 right-2 opacity-0 sm:group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBook(book);
                    }}
                    className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-soft-black" />
                  </button>
                </div>
              )}

              {/* Selection checkmark (select mode) */}
              {selectMode && (
                <div className="absolute top-2 left-2 z-10">
                  {selectedIds.has(book.id) ? (
                    <CheckCircle2
                      className="w-6 h-6 text-white drop-shadow-md"
                      fill="rgba(59,130,246,0.9)"
                    />
                  ) : (
                    <Circle className="w-6 h-6 text-white/70 drop-shadow-md" />
                  )}
                </div>
              )}

              {/* Deleting spinner overlay */}
              {deletingIds.has(book.id) && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-20">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}

              {/* Date footer */}
              <div className="px-3 py-2 bg-white/40 backdrop-blur-sm text-xs text-soft-black/60 flex items-center justify-between">
                <span>{new Date(book.updatedAt).toLocaleDateString()}</span>
                {!selectMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBook(book);
                    }}
                    className="sm:hidden p-1 rounded hover:bg-white/50 transition"
                    aria-label="Edit book"
                  >
                    <Pencil className="w-3 h-3 text-soft-black" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <BookModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
      <BookModal
        open={!!editingBook}
        onClose={() => setEditingBook(null)}
        onSave={handleUpdate}
        initial={
          editingBook
            ? { title: editingBook.title, coverColor: editingBook.coverColor }
            : undefined
        }
      />
    </div>
  );
}
