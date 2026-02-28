"use client";

import React, { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';

// =============================================================================
// Hooks
// =============================================================================

const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
  const get = useCallback(
    () => values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue,
    [queries, values, defaultValue]
  );

  const [value, setValue] = useState<number>(get);

  useEffect(() => {
    const handler = () => setValue(get());
    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
  }, [queries, get]);

  return value;
};

const useMeasure = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
};

// =============================================================================
// Types
// =============================================================================

export interface MasonryItem {
  id: string;
  img: string;
  /** Natural width of the image (used with height to calculate aspect ratio) */
  width: number;
  height: number;
}

interface GridItem extends MasonryItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MasonryProps {
  items: MasonryItem[];
  /** Skip preloading images (useful for data URLs that are already loaded) */
  skipPreload?: boolean;
  /** Column breakpoints: [xl, lg, md, sm] – defaults to [3, 3, 2, 2] */
  columnBreakpoints?: [number, number, number, number];
  ease?: string;
  duration?: number;
  scaleOnHover?: boolean;
  hoverScale?: number;
  /** Called when an item is clicked */
  onItemClick?: (id: string) => void;
  /** Called when an item is right-clicked or long-pressed (contextmenu) */
  onItemContextMenu?: (id: string, event: { clientX: number; clientY: number }) => void;
  /** Render an overlay on top of each item (e.g. status icons, selection checkmarks) */
  renderOverlay?: (id: string) => ReactNode;
  /** Gap between items in px (default 10) */
  gap?: number;
}

// =============================================================================
// Component
// =============================================================================

const Masonry: React.FC<MasonryProps> = ({
  items,
  skipPreload = false,
  columnBreakpoints = [3, 3, 2, 2],
  ease = 'power3.out',
  duration = 0.3,
  scaleOnHover = true,
  hoverScale = 0.97,
  onItemClick,
  onItemContextMenu,
  renderOverlay,
  gap = 10,
}) => {
  const columns = useMedia(
    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],
    columnBreakpoints,
    1
  );

  const [containerRef, { width }] = useMeasure<HTMLDivElement>();
  const [imagesReady, setImagesReady] = useState(skipPreload);

  // Preload images (skipped for data URLs)
  useEffect(() => {
    if (skipPreload) return; // already ready if skipping
    const urls = items.map(i => i.img);
    Promise.all(
      urls.map(
        src =>
          new Promise<void>(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = img.onerror = () => resolve();
          })
      )
    ).then(() => setImagesReady(true));
  }, [items, skipPreload]);

  // Calculate grid positions and container height
  const { grid, containerHeight } = useMemo(() => {
    if (!width) return { grid: [] as GridItem[], containerHeight: 0 };
    const colHeights = new Array(columns).fill(0);
    const totalGaps = (columns - 1) * gap;
    const columnWidth = (width - totalGaps) / columns;

    const gridItems = items.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      // Calculate height from aspect ratio so the full image is shown uncropped
      const h = child.width > 0
        ? (columnWidth / child.width) * child.height
        : child.height / 2;
      const y = colHeights[col];

      colHeights[col] += h + gap;
      return { ...child, x, y, w: columnWidth, h };
    });

    const maxHeight = Math.max(...colHeights, 0);
    return { grid: gridItems, containerHeight: maxHeight };
  }, [columns, items, width, gap]);

  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    if (!imagesReady || grid.length === 0) return;

    grid.forEach(item => {
      const selector = `[data-key="${item.id}"]`;
      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };

      if (!hasMounted.current) {
        // Simple fade-in animation for snappier feel
        gsap.fromTo(
          selector,
          {
            opacity: 0,
            ...animProps
          },
          {
            opacity: 1,
            duration: 0.3,
            ease: 'power2.out'
          }
        );
      } else {
        gsap.to(selector, {
          ...animProps,
          duration,
          ease,
          overwrite: 'auto'
        });
      }
    });

    hasMounted.current = true;
  }, [grid, imagesReady, duration, ease]);

  // Reset hasMounted when items change (e.g. after deletion)
  useEffect(() => {
    hasMounted.current = false;
  }, [items.length]);

  const handleMouseEnter = (id: string) => {
    if (scaleOnHover) {
      gsap.to(`[data-key="${id}"]`, {
        scale: hoverScale,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  };

  const handleMouseLeave = (id: string) => {
    if (scaleOnHover) {
      gsap.to(`[data-key="${id}"]`, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: containerHeight > 0 ? containerHeight : 'auto' }}
    >
      {grid.map(item => (
        <div
          key={item.id}
          data-key={item.id}
          className="absolute box-content cursor-pointer"
          style={{ willChange: 'transform, width, height, opacity' }}
          onClick={() => {
            onItemClick?.(item.id);
          }}
          onContextMenu={(e) => {
            if (onItemContextMenu) {
              e.preventDefault();
              onItemContextMenu(item.id, e);
            }
          }}
          onMouseEnter={() => handleMouseEnter(item.id)}
          onMouseLeave={() => handleMouseLeave(item.id)}
        >
          <div className="relative w-full h-full rounded-xl shadow-[0px_8px_30px_-8px_rgba(0,0,0,0.15)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.img}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
            {/* Custom overlay (status icons, selection checkmarks, etc.) */}
            {renderOverlay?.(item.id)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Masonry;
