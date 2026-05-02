import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sidebar-width";
const MIN_W = 200;
const MAX_W = 520;
const DEFAULT_W = 320; // matches --sidebar-w: 20rem

export function useResizableSidebar() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (n >= MIN_W && n <= MAX_W) return n;
      }
    } catch { /* noop */ }
    return DEFAULT_W;
  });

  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(DEFAULT_W);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem(STORAGE_KEY, String(width)); } catch { /* noop */ }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  return { width, onMouseDown };
}
