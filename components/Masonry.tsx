import React, { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

// =============================================================================
// Hooks
// =============================================================================

const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
  const get = () => values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;

  const [value, setValue] = useState<number>(get);

  useEffect(() => {
    const handler = () => setValue(get);
    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
  }, [queries]);

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
  stagger?: number;
  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random';
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
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
  duration = 0.6,
  stagger = 0.05,
  animateFrom = 'bottom',
  scaleOnHover = true,
  hoverScale = 0.97,
  blurToFocus = true,
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

  const getInitialPosition = (item: GridItem) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return { x: item.x, y: item.y };

    let direction = animateFrom;
    if (animateFrom === 'random') {
      const dirs = ['top', 'bottom', 'left', 'right'];
      direction = dirs[Math.floor(Math.random() * dirs.length)] as typeof animateFrom;
    }

    switch (direction) {
      case 'top':
        return { x: item.x, y: -200 };
      case 'bottom':
        return { x: item.x, y: window.innerHeight + 200 };
      case 'left':
        return { x: -200, y: item.y };
      case 'right':
        return { x: window.innerWidth + 200, y: item.y };
      case 'center':
        return {
          x: containerRect.width / 2 - item.w / 2,
          y: containerRect.height / 2 - item.h / 2
        };
      default:
        return { x: item.x, y: item.y + 100 };
    }
  };

  // Preload images (skipped for data URLs)
  useEffect(() => {
    if (skipPreload) {
      setImagesReady(true);
      return;
    }
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

    grid.forEach((item, index) => {
      const selector = `[data-key="${item.id}"]`;
      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };

      if (!hasMounted.current) {
        const start = getInitialPosition(item);
        gsap.fromTo(
          selector,
          {
            opacity: 0,
            x: start.x,
            y: start.y,
            width: item.w,
            height: item.h,
            ...(blurToFocus && { filter: 'blur(10px)' })
          },
          {
            opacity: 1,
            ...animProps,
            ...(blurToFocus && { filter: 'blur(0px)' }),
            duration: 0.8,
            ease: 'power3.out',
            delay: index * stagger
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
  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);

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

  // Long-press support for mobile context menu
  const LONG_PRESS_MS = 500;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handleTouchStart = useCallback(
    (id: string, e: React.TouchEvent) => {
      if (!onItemContextMenu) return;
      longPressFiredRef.current = false;
      const touch = e.touches[0];
      const { clientX, clientY } = touch;
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onItemContextMenu(id, { clientX, clientY });
      }, LONG_PRESS_MS);
    },
    [onItemContextMenu],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      cancelLongPress();
      // Prevent the tap from also firing onClick after a long press
      if (longPressFiredRef.current) {
        e.preventDefault();
      }
    },
    [cancelLongPress],
  );

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
            if (!longPressFiredRef.current) onItemClick?.(item.id);
          }}
          onContextMenu={(e) => {
            if (onItemContextMenu) {
              e.preventDefault();
              onItemContextMenu(item.id, e);
            }
          }}
          onTouchStart={(e) => handleTouchStart(item.id, e)}
          onTouchMove={cancelLongPress}
          onTouchEnd={handleTouchEnd}
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
