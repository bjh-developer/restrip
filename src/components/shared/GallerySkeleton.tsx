import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "../../../components/ui/skeleton";

type GallerySkeletonItem = {
  id: string;
  width: number;
  height: number;
};

type GallerySkeletonProps = {
  count?: number;
  items?: GallerySkeletonItem[];
};

const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
  const get = useCallback(
    () => values[queries.findIndex((q) => matchMedia(q).matches)] ?? defaultValue,
    [queries, values, defaultValue],
  );

  const [value, setValue] = useState<number>(get);

  useEffect(() => {
    const handler = () => setValue(get());
    queries.forEach((q) => matchMedia(q).addEventListener("change", handler));
    return () => queries.forEach((q) => matchMedia(q).removeEventListener("change", handler));
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

type GridItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export default function GallerySkeleton({ count = 12, items: providedItems }: GallerySkeletonProps) {
  const columns = useMedia(
    ["(min-width:1500px)", "(min-width:1000px)", "(min-width:600px)", "(min-width:400px)"],
    [4, 4, 3, 2],
    2,
  );

  const gap = 10;
  const [containerRef, { width }] = useMeasure<HTMLDivElement>();

  const items = useMemo(() => {
    if (providedItems && providedItems.length > 0) return providedItems.slice(0, count);
    return Array.from({ length: count }).map((_, i) => ({
      id: String(i),
      width: 300,
      height: 400,
    }));
  }, [count, providedItems]);

  const { grid, containerHeight } = useMemo(() => {
    if (!width) return { grid: [] as GridItem[], containerHeight: 0 };
    const colHeights = new Array(columns).fill(0);
    const totalGaps = (columns - 1) * gap;
    const columnWidth = (width - totalGaps) / columns;

    const gridItems: GridItem[] = items.map((it) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      const w = it.width > 0 ? it.width : 300;
      const h0 = it.height > 0 ? it.height : 400;
      const h = (columnWidth / w) * h0;
      const y = colHeights[col];
      colHeights[col] += h + gap;
      return { id: it.id, x, y, w: columnWidth, h };
    });

    const maxHeight = Math.max(...colHeights, 0);
    return { grid: gridItems, containerHeight: maxHeight };
  }, [columns, gap, items, width]);

  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    hasMounted.current = true;
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: containerHeight > 0 ? containerHeight : "auto" }}
      >
        {grid.map((item) => (
          <div
            key={item.id}
            className="absolute box-content cursor-pointer"
            style={{
              transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
              width: item.w,
              height: item.h,
              willChange: hasMounted.current ? "transform, width, height" : "auto",
            }}
          >
            <div className="relative w-full h-full rounded-lg shadow-[0px_4px_12px_-4px_rgba(0,0,0,0.15)] overflow-hidden border border-mist-grey/50">
              <Skeleton className="w-full h-full rounded-none" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center mt-8">
        <span className="text-grey text-sm">Loading your memories...</span>
      </div>
    </div>
  );
}
