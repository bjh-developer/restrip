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
import { Plus, Trash2, BookOpen, Pencil, X, Loader2 } from "lucide-react";
import type { Book } from "../../../lib/scrapbook-types";
import { COVER_COLORS } from "../../../lib/scrapbook-types";
import {
  fetchBooks,
  createBookApi,
  deleteBookApi,
  updateBookApi,
} from "../../../lib/scrapbook-api";

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
                color === c ? "border-soft-black scale-110" : "border-transparent"
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

  /** Delete a book with confirmation */
  const handleDelete = useCallback(async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this book and all its pages?")) return;
    await deleteBookApi(bookId);
    const refreshed = await fetchBooks();
    setBooks(refreshed);
  }, []);

  /** Edit button handler */
  const handleEdit = useCallback(
    (book: Book, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingBook(book);
    },
    [],
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-soft-black">
            My Scrapbooks
          </h1>
          <p className="text-sm text-grey mt-1">
            Create books, add pages, and decorate with your photo strips &amp; stickers.
          </p>
        </div>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-grey animate-spin" />
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
            onClick={() => router.push(`/scrapbook/${book.id}`)}
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
                {book.pages.length} {book.pages.length === 1 ? "page" : "pages"}
              </p>
            </div>

            {/* Spine decoration */}
            <div
              className="absolute left-0 top-0 bottom-0 w-3 opacity-20"
              style={{
                background: "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 100%)",
              }}
            />

            {/* Hover actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={(e) => handleEdit(book, e)}
                className="p-1.5 rounded-lg bg-white/80 hover:bg-white shadow-sm transition"
              >
                <Pencil className="w-3.5 h-3.5 text-soft-black" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(book.id, e)}
                className="p-1.5 rounded-lg bg-white/80 hover:bg-red-50 shadow-sm transition"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>

            {/* Date footer */}
            <div className="px-3 py-2 bg-white/40 backdrop-blur-sm text-xs text-soft-black/60">
              {new Date(book.updatedAt).toLocaleDateString()}
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
        initial={editingBook ? { title: editingBook.title, coverColor: editingBook.coverColor } : undefined}
      />
    </div>
  );
}
