/**
 * Scroll Reveal Component
 *
 * A text reveal animation component that animates words as they scroll into view.
 * Uses GSAP ScrollTrigger to create smooth, scroll-driven animations including:
 * - Word-by-word opacity fade-in
 * - Optional blur-to-sharp transition
 * - Container rotation correction
 *
 * @module components/ScrollReveal
 *
 * @example
 * ```tsx
 * <ScrollReveal
 *   enableBlur={true}
 *   baseOpacity={0.1}
 *   blurStrength={4}
 * >
 *   This text will animate word by word as you scroll.
 * </ScrollReveal>
 * ```
 */

import React, { useEffect, useRef, useMemo, ReactNode, RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin with GSAP
gsap.registerPlugin(ScrollTrigger);

/** Props for the ScrollReveal component */
interface ScrollRevealProps {
  /** Text content to animate (should be a string or string-convertible) */
  children: ReactNode;

  /**
   * Optional ref to a custom scroll container.
   * Defaults to window if not provided.
   */
  scrollContainerRef?: RefObject<HTMLElement>;

  /** Whether to animate blur effect. Default: true */
  enableBlur?: boolean;

  /** Starting opacity for words. Range: 0-1. Default: 0.1 */
  baseOpacity?: number;

  /** Starting rotation in degrees. Default: 3 */
  baseRotation?: number;

  /** Blur amount in pixels at start. Default: 4 */
  blurStrength?: number;

  /** Additional CSS classes for the container */
  containerClassName?: string;

  /** Additional CSS classes for the text paragraph */
  textClassName?: string;

  /**
   * ScrollTrigger end position for rotation animation.
   * Default: "bottom bottom"
   */
  rotationEnd?: string;

  /**
   * ScrollTrigger end position for word animations.
   * Default: "bottom bottom"
   */
  wordAnimationEnd?: string;

  /**
   * Called once when the scroll-reveal animation first enters view
   * (i.e. the user has scrolled enough to start revealing text).
   */
  onRevealStart?: () => void;
}
const DEFAULTS = {
  opacity: 0.1,
  rotation: 3,
  blurStrength: 4,
  rotationEnd: "bottom bottom",
  wordAnimationEnd: "bottom bottom",
  staggerDelay: 0.05,
} as const;

/**
 * Splits text content into individually animated word spans.
 *
 * @param children - React children to convert to text
 * @returns Array of span elements for words, or null if empty
 */
function useWordSplit(children: ReactNode): React.ReactNode[] | null {
  return useMemo(() => {
    const text =
      typeof children === "string" ? children : String(children ?? "");

    if (!text.trim()) return null;

    // Split on whitespace but preserve it
    return text.split(/(\s+)/).map((segment, index) => {
      // Return whitespace as-is
      if (segment.match(/^\s+$/)) return segment;

      // Wrap words in spans for animation targeting
      return (
        <span className="inline-block word" key={`word-${index}`}>
          {segment}
        </span>
      );
    });
  }, [children]);
}

/**
 * Scroll-triggered text reveal animation component.
 *
 * Animates text content word-by-word as the user scrolls, creating
 * a smooth reveal effect. Supports opacity, blur, and rotation animations.
 */
const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = DEFAULTS.opacity,
  baseRotation = DEFAULTS.rotation,
  blurStrength = DEFAULTS.blurStrength,
  containerClassName = "",
  textClassName = "",
  rotationEnd = DEFAULTS.rotationEnd,
  wordAnimationEnd = DEFAULTS.wordAnimationEnd,
  onRevealStart,
}) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const splitText = useWordSplit(children);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !splitText) return;

    // Determine scroll container (custom ref or window)
    const scroller = scrollContainerRef?.current ?? window;

    // Track ScrollTrigger instances for cleanup
    const triggers: ScrollTrigger[] = [];

    // Animation 1: Container rotation correction
    const rotationAnimation = gsap.fromTo(
      container,
      { transformOrigin: "0% 50%", rotate: baseRotation },
      {
        ease: "none",
        rotate: 0,
        scrollTrigger: {
          trigger: container,
          scroller,
          start: "top bottom",
          end: rotationEnd,
          scrub: true,
        },
      },
    );
    if (rotationAnimation.scrollTrigger) {
      triggers.push(rotationAnimation.scrollTrigger);
    }

    // Get all word elements for animation
    const wordElements = container.querySelectorAll<HTMLElement>(".word");

    // Animation 2: Word opacity fade-in
    const opacityAnimation = gsap.fromTo(
      wordElements,
      { opacity: baseOpacity, willChange: "opacity" },
      {
        ease: "none",
        opacity: 1,
        stagger: DEFAULTS.staggerDelay,
        scrollTrigger: {
          trigger: container,
          scroller,
          start: "top bottom-=20%",
          end: wordAnimationEnd,
          scrub: true,
          onEnter: () => onRevealStart?.(),
        },
      },
    );
    if (opacityAnimation.scrollTrigger) {
      triggers.push(opacityAnimation.scrollTrigger);
    }

    // Animation 3: Optional blur-to-sharp effect
    if (enableBlur) {
      const blurAnimation = gsap.fromTo(
        wordElements,
        { filter: `blur(${blurStrength}px)` },
        {
          ease: "none",
          filter: "blur(0px)",
          stagger: DEFAULTS.staggerDelay,
          scrollTrigger: {
            trigger: container,
            scroller,
            start: "top bottom-=20%",
            end: wordAnimationEnd,
            scrub: true,
          },
        },
      );
      if (blurAnimation.scrollTrigger) {
        triggers.push(blurAnimation.scrollTrigger);
      }
    }

    // Recalculate scroll positions after setup — deferred so a running
    // scroll gesture is not interrupted by the temporary position reset.
    requestAnimationFrame(() => ScrollTrigger.refresh());

    // Cleanup: kill only this component's triggers
    return () => {
      triggers.forEach((trigger) => trigger.kill());
    };
  }, [
    scrollContainerRef,
    enableBlur,
    baseRotation,
    baseOpacity,
    rotationEnd,
    wordAnimationEnd,
    blurStrength,
    splitText,
    onRevealStart,
  ]);

  return (
    <h2 ref={containerRef} className={`my-5 ${containerClassName}`}>
      <p
        className={`text-[clamp(1.6rem,4vw,3rem)] leading-[1.5] font-semibold font-body text-soft-black ${textClassName}`}
      >
        {splitText ?? children}
      </p>
    </h2>
  );
};

export default ScrollReveal;
