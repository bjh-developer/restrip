import React from "react";
import type { TextEditorStyles } from "../hooks/useTextEditor";

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#34C759",
  "#007AFF",
  "#FFCC00",
  "#FF2D55",
  "#AF52DE",
  "#5856D6",
  "#FF9500",
  "#5AC8FA",
  "#C7C7CC",
];

const BG_COLORS = [
  "#000000",
  "#FFFFFF",
  "#FF3B30",
  "#34C759",
  "#007AFF",
  "#FFCC00",
  "#FF2D55",
  "#AF52DE",
];

interface TextEditorOverlayProps {
  isOpen: boolean;
  textValue: string;
  styles: TextEditorStyles;
  showColorPicker: boolean;
  showBgColorPicker: boolean;
  viewportHeight: number | null;
  fontOptions: { label: string; value: string }[];
  onTextChange: (value: string) => void;
  onDone: () => void;
  onToggleColorPicker: () => void;
  onToggleBgColorPicker: () => void;
  onColorSelect: (color: string) => void;
  onBgColorSelect: (color: string) => void;
  onCycleAlign: () => void;
  onCycleFont: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function TextEditorOverlay({
  isOpen,
  textValue,
  styles,
  showColorPicker,
  showBgColorPicker,
  viewportHeight,
  fontOptions: _fontOptions,
  onTextChange,
  onDone,
  onToggleColorPicker,
  onToggleBgColorPicker,
  onColorSelect,
  onBgColorSelect,
  onCycleAlign,
  onCycleFont,
  onKeyDown,
}: TextEditorOverlayProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300 backdrop-blur-md"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        onClick={onDone}
        aria-hidden="true"
      />

      <button
        onClick={onDone}
        className="fixed top-4 right-4 z-[60] px-5 py-2 bg-white text-black rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
        aria-label="Done editing"
      >
        Done
      </button>

      <div className="fixed top-4 left-4 z-[60] flex items-center gap-3">
        <div className="relative">
          <button
            onClick={onToggleColorPicker}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition hover:bg-white/30"
            aria-label="Text color"
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-white"
              style={{ backgroundColor: styles.fill }}
            />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 max-w-[280px]">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 py-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onColorSelect(color)}
                    className="w-7 h-7 rounded-full border-2 border-transparent hover:border-white transition flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={onToggleBgColorPicker}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition hover:bg-white/30"
            aria-label="Background color"
          >
            <div
              className="w-5 h-5 rounded border-2 border-white flex items-center justify-center"
              style={{
                backgroundColor:
                  styles.backgroundColor === "transparent"
                    ? "transparent"
                    : styles.backgroundColor,
              }}
            >
              {styles.backgroundColor === "transparent" && (
                <span className="text-[10px] text-white">A</span>
              )}
            </div>
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 max-w-[240px]">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 py-2">
                <button
                  onClick={() => onBgColorSelect("transparent")}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0"
                >
                  <span className="text-white text-xs">A</span>
                </button>
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onBgColorSelect(color)}
                    className="w-7 h-7 rounded-full border-2 border-transparent hover:border-white transition flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onCycleAlign}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition hover:bg-white/30 text-white"
          aria-label="Text alignment"
        >
          {styles.textAlign === "left" && (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          )}
          {styles.textAlign === "center" && (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
          {styles.textAlign === "right" && (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="9" y1="12" x2="21" y2="12" />
              <line x1="6" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <button
          onClick={onCycleFont}
          className="h-10 px-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition hover:bg-white/30 text-white text-sm font-medium min-w-[80px]"
          aria-label="Change font"
        >
          <span
            style={{ fontFamily: styles.fontFamily }}
            className="truncate max-w-[100px]"
          >
            {styles.fontFamily}
          </span>
        </button>
      </div>

      <div
        className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none"
        style={{
          height: viewportHeight ? `${viewportHeight}px` : "100vh",
          transition: "height 300ms ease-out",
        }}
      >
        <div className="w-full max-w-[85vw] px-4 pointer-events-auto">
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            className="w-full bg-transparent border-none outline-none placeholder-white/40 transition-all duration-300 overflow-hidden"
            style={{
              fontFamily: styles.fontFamily,
              fontSize: `${styles.fontSize}px`,
              color: styles.fill,
              backgroundColor:
                styles.backgroundColor === "transparent"
                  ? "transparent"
                  : styles.backgroundColor,
              textAlign: styles.textAlign,
              lineHeight: "1.3",
              fontWeight: 500,
              minHeight: "auto",
              maxHeight: "70vh",
              fieldSizing: "content",
              textShadow: "none",
              padding:
                styles.backgroundColor !== "transparent" ? "8px 16px" : 0,
              borderRadius:
                styles.backgroundColor !== "transparent" ? "8px" : 0,
            }}
            placeholder="Tap to type..."
          />
        </div>
      </div>
    </>
  );
}
