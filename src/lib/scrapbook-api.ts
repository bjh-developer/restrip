/**
 * Scrapbook API Storage
 *
 * API-backed persistence layer for scrapbook books.
 * Replaces the localStorage-based canvas-storage module.
 *
 * All functions are async and hit the /api/scrapbook/* endpoints.
 *
 * @module lib/scrapbook-api
 */

import type { Book, BookPage, PageBackground, PageElement } from "./scrapbook-types";

// =============================================================================
// Types mapping DB rows → client types
// =============================================================================

interface PageRow {
  id: string;
  book_id: string;
  page_number: number;
  background: PageBackground;
  elements: PageElement[];
  created_at: string;
  updated_at: string;
}

interface BookRow {
  id: string;
  user_id: string;
  title: string;
  cover_color: string;
  created_at: string;
  updated_at: string;
  pages: PageRow[];
}

/** Map a DB book row to the client-side Book type */
function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    coverColor: row.cover_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pages: row.pages.map(mapPage),
  };
}

/** Map a DB page row to the client-side BookPage type */
function mapPage(row: PageRow): BookPage {
  return {
    id: row.id,
    pageNumber: row.page_number,
    background: row.background || { type: "color", color: "#FFFFFF" },
    elements: row.elements || [],
  };
}

// =============================================================================
// API Functions
// =============================================================================

/** Fetch all books for the current user */
export async function fetchBooks(): Promise<Book[]> {
  const res = await fetch("/api/scrapbook/books");
  if (!res.ok) {
    console.error("[Canvas API] Failed to fetch books:", res.status);
    return [];
  }
  const data = await res.json();
  return (data.books || []).map(mapBook);
}

/** Fetch a single book by ID */
export async function fetchBook(bookId: string): Promise<Book | null> {
  const res = await fetch(`/api/scrapbook/books/${bookId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.book ? mapBook(data.book) : null;
}

/** Create a new book */
export async function createBookApi(title: string, coverColor: string): Promise<Book | null> {
  const res = await fetch("/api/scrapbook/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, coverColor }),
  });
  if (!res.ok) {
    console.error("[Canvas API] Failed to create book:", res.status);
    return null;
  }
  const data = await res.json();
  return data.book ? mapBook(data.book) : null;
}

/** Update book metadata (title, coverColor) */
export async function updateBookApi(
  bookId: string,
  updates: { title?: string; coverColor?: string },
): Promise<Book | null> {
  const res = await fetch(`/api/scrapbook/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // The PATCH returns just book metadata, not pages. Return null to signal a refetch.
  return data.book ? { ...mapBook({ ...data.book, pages: [] }), pages: [] } : null;
}

/** Delete a book */
export async function deleteBookApi(bookId: string): Promise<boolean> {
  const res = await fetch(`/api/scrapbook/books/${bookId}`, {
    method: "DELETE",
  });
  return res.ok;
}

/** Add a new blank page to a book */
export async function addPageApi(bookId: string): Promise<BookPage | null> {
  const res = await fetch(`/api/scrapbook/books/${bookId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.page ? mapPage(data.page) : null;
}

/** Delete a page */
export async function deletePageApi(bookId: string, pageId: string): Promise<boolean> {
  const res = await fetch(`/api/scrapbook/books/${bookId}/pages/${pageId}`, {
    method: "DELETE",
  });
  return res.ok;
}

/**
 * Save all pages (auto-save batch).
 * Sends the full page state for each page.
 */
export async function savePagesApi(
  bookId: string,
  pages: BookPage[],
): Promise<boolean> {
  const payload = pages.map((p) => ({
    id: p.id,
    page_number: p.pageNumber,
    background: p.background,
    elements: p.elements,
  }));

  const res = await fetch(`/api/scrapbook/books/${bookId}/pages`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages: payload }),
  });
  return res.ok;
}
