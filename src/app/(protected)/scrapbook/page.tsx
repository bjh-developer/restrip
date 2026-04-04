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
import useSWR from "swr";
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

const booksFetcher = () => fetchBooks();

interface DeleteConfirmModalProps {
  open: boolean;
  bookCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  open,
  bookCount,
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
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
        </div>

        <h2
          id="delete-title"
          className="font-display text-lg font-bold text-soft-black text-center mb-2"
        >
          Delete {bookCount} {bookCount === 1 ? "book" : "books"}?
        </h2>

        <p id="delete-desc" className="text-sm text-grey text-center mb-6">
          All pages and content will be permanently deleted. This cannot be
          undone.
        </p>

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
              <>Delete {bookCount === 1 ? "Book" : "Books"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      setTimeout(() => {
        setTitle(initial?.title ?? "");
        setColor(initial?.coverColor ?? COVER_COLORS[0]);
      }, 0);
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

        <label className="block text-sm font-medium text-soft-black mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Scrapbooks"
          maxLength={50}
          className="w-full rounded-lg border border-mist-grey px-3 py-2 text-[16px] sm:text-sm focus:border-blush-pink focus:ring-1 focus:ring-blush-pink outline-none transition mb-4"
          autoFocus
        />

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

export default function CanvasPage() {
  const router = useRouter();

  const {
    data: books = [],
    isLoading: loading,
    mutate: mutateBooks,
  } = useSWR("books", booksFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [actionError, setActionError] = useState<{
    user: string;
    detail?: string;
  } | null>(null);

  const handleCreate = useCallback(
    async (title: string, color: string) => {
      const book = await createBookApi(title, color);
      if (!book) return;
      setModalOpen(false);
      mutateBooks((prev = []) => [book, ...prev], false);
      router.push(`/scrapbook/${book.id}`);
    },
    [router, mutateBooks],
  );

  const handleUpdate = useCallback(
    async (title: string, color: string) => {
      if (!editingBook) return;
      await updateBookApi(editingBook.id, { title, coverColor: color });
      mutateBooks(
        (prev = []) =>
          prev.map((b) =>
            b.id === editingBook.id ? { ...b, title, coverColor: color } : b,
          ),
        false,
      );
      setEditingBook(null);
    },
    [editingBook, mutateBooks],
  );

  const showDeleteConfirmation = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteModalOpen(true);
  }, [selectedIds.size]);

  const confirmBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

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

    mutateBooks(
      (prev = []) => prev.filter((b) => !deletedIds.has(b.id)),
      false,
    );

    setSelectedIds(failedIds);

    setDeletingIds(new Set());

    setDeleteModalOpen(false);

    if (failedIds.size === 0) {
      setSelectMode(false);
    }

    if (failedIds.size > 0) {
      setActionError({
        user: `Ohno! ${failedIds.size} ${failedIds.size === 1 ? "scrapbook" : "scrapbooks"} couldn't be deleted. The failed items remain selected for retry.`,
      });
    }
  }, [selectedIds, mutateBooks]);

  const handleBatchDelete = useCallback(() => {
    showDeleteConfirmation();
  }, [showDeleteConfirmation]);

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
      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="text-red-800">{actionError.user}</p>
          {actionError.detail && (
            <p className="mt-1 font-mono text-xs text-red-400 break-all">
              Error: {actionError.detail}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-soft-black">
            My Scrapbooks
          </h1>
          <p className="text-sm text-grey mt-1">
            Create books, add pages, and decorate with your photo strips &amp;
            stickers.
          </p>
        </div>

        {!loading && books.length > 0 && (
          <div className="flex items-center gap-2">
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

              <div
                className="absolute left-0 top-0 bottom-0 w-3 opacity-20"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 100%)",
                }}
              />

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

              {deletingIds.has(book.id) && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-20">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}

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
      <DeleteConfirmModal
        open={deleteModalOpen}
        bookCount={selectedIds.size}
        onConfirm={confirmBatchDelete}
        onCancel={() => setDeleteModalOpen(false)}
        isDeleting={deletingIds.size > 0}
      />
    </div>
  );
}
