/**
 * Sticker Pack Manifest
 *
 * Registry of all built-in stickers available in the canvas editor.
 * Each sticker has a unique key, display name, and path to SVG asset.
 *
 * @module lib/stickers
 */

export interface StickerDef {
  /** Unique key for this sticker */
  key: string;
  /** Human-readable label */
  label: string;
  /** Path to SVG file in /public */
  src: string;
  /** Category for grouping in picker */
  category: "characters" | "tags";
}

export const STICKER_PACK: StickerDef[] = [
  // Characters
  { key: "cloud", label: "Cloud", src: "/stickers/cloud.svg", category: "characters" },
  { key: "dog", label: "Dog", src: "/stickers/dog.svg", category: "characters" },

  // Shapes & Decorations

  // Tags
  { key: "memories", label: "Memories", src: "/stickers/memories.svg", category: "tags" },

  // Nature

];
