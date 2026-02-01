/**
 * Shiny Text Component
 *
 * Displays text with a shimmering, metallic-like gradient animation.
 * The effect creates a sweeping shine across the text, similar to
 * light reflecting off polished metal or foil.
 *
 * @module components/ShinyText
 *
 * @requires Tailwind animation config:
 * ```js
 * // tailwind.config.js
 * module.exports = {
 *   theme: {
 *     extend: {
 *       keyframes: {
 *         shine: {
 *           '0%': { 'background-position': '100%' },
 *           '100%': { 'background-position': '-100%' },
 *         },
 *       },
 *       animation: {
 *         shine: 'shine 5s linear infinite',
 *       },
 *     },
 *   },
 * };
 * ```
 *
 * @example
 * ```tsx
 * <ShinyText text="Premium Feature" speed={3} />
 * <ShinyText text="Static Text" disabled />
 * ```
 */

import React from "react";

/** Props for the ShinyText component */
export interface ShinyTextProps {
  /** Text content to display with the shine effect */
  text: string;

  /**
   * Disables the animation, showing static gradient text.
   * Default: false
   */
  disabled?: boolean;

  /**
   * Animation duration in seconds.
   * Lower values = faster shine sweep.
   * Default: 5
   */
  speed?: number;

  /** Additional CSS classes to apply */
  className?: string;
}

/** Default animation speed in seconds */
const DEFAULT_SPEED_SECONDS = 5;

/**
 * Text component with animated shine/shimmer effect.
 *
 * Uses a horizontally-sweeping gradient background clipped to text,
 * creating a metallic shine appearance. Animation can be disabled
 * for static gradient text.
 */
const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = DEFAULT_SPEED_SECONDS,
  className = "",
}) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-amber-100 to-gray-900 bg-[length:200%_100%] inline-block ${
        disabled ? "" : "animate-shine"
      } ${className}`}
      style={{
        animationDuration,
      }}
    >
      {text}
    </div>
  );
};

export default ShinyText;
