import { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Render only the visible cards; the scroll range still represents every row. */
export function useWindowedList(items: { id: string }[], enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const offsets = useMemo(() => {
    const values = [0];
    for (const item of items) values.push(values[values.length - 1] + (heights.get(item.id) ?? 100));
    return values;
  }, [items, heights]);
  const firstAt = (position: number) => {
    let low = 0, high = items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (offsets[mid + 1] <= position) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const start = enabled ? Math.max(0, firstAt(viewport.top) - 5) : 0;
  const end = enabled ? Math.min(items.length, firstAt(viewport.top + viewport.height) + 6) : items.length;
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const update = () => setViewport({ top: host.scrollTop, height: host.clientHeight });
    update();
    host.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => { host.removeEventListener("scroll", update); observer.disconnect(); };
  }, [enabled, items.length]);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || !enabled) return;
    const observer = new ResizeObserver(entries => {
      setHeights(prev => {
        let next = prev;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.clinicRow;
          const height = Math.ceil(entry.target.getBoundingClientRect().height) + 8;
          if (id && prev.get(id) !== height) {
            if (next === prev) next = new Map(prev);
            next.set(id, height);
          }
        }
        return next;
      });
    });
    host.querySelectorAll('[data-clinic-row]').forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [enabled, start, end, items]);
  return { ref, start, end, top: offsets[start], bottom: offsets[items.length] - offsets[end] };
}
