/**
 * Canvas Types
 *
 * Shared type definitions for the scrapbook canvas feature.
 * Used across the books list page, editor, and local storage layer.
 *
 * @module lib/canvas-types
 */

/** A single element placed on a page (sticker, photostrip, or text) */
export interface PageElement {
  id: string;
  type: "photostrip" | "sticker" | "text";
  /** For photostrips: the snap ID from gallery */
  snapId?: string;
  /** For stickers: the sticker key from the pack */
  stickerKey?: string;
  /** For text: the text content */
  textContent?: string;
  /** Position & transform */
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  /** Fabric.js-specific: text font settings */
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
}

/** Background configuration for a page */
export interface PageBackground {
  type: "color" | "gradient" | "pattern";
  /** Solid color value, e.g. "#fff" */
  color?: string;
  /** CSS gradient string */
  gradient?: string;
  /** Pattern key (for future built-in patterns) */
  patternKey?: string;
}

/** A single page inside a book */
export interface BookPage {
  id: string;
  pageNumber: number;
  background: PageBackground;
  elements: PageElement[];
}

/** A book (collection of pages) */
export interface Book {
  id: string;
  title: string;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
  pages: BookPage[];
}

/** Available cover color options */
export const COVER_COLORS = [
  "#FFC9D1", // blush-pink
  "#CFE7FF", // pastel-blue
  "#C4A6FF", // lavender
  "#90D4A3", // mint-green
  "#FFD93D", // sunny-yellow
  "#FFA07A", // peach
  "#FFE4B5", // cream
  "#E1BEE7", // lilac
  "#A8D8FF", // sky-blue
  "#F3E8D8", // warm-beige
] as const;

/** Default background for new pages */
export const DEFAULT_PAGE_BACKGROUND: PageBackground = {
  type: "color",
  color: "#FFFFFF",
};

/** Background color presets */
export const BACKGROUND_COLORS = [
  "#FFFFFF",
  "#F3E8D8",
  "#FFF8DC",
  "#FFE0EC",
  "#E8F5E9",
  "#E3F2FD",
  "#F3E5F5",
  "#FFF3E0",
  "#FCE4EC",
  "#E0F2F1",
  "#ECEFF1",
  "#1C1C1C",
] as const;
