import { useCallback, useRef, useState, useEffect } from "react";

/**
 * Makes a modal dialog draggable by its header.
 *
 * Usage:
 *   const { offset, handleMouseDown } = useDraggableModal();
 *   <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
 *     <div onMouseDown={handleMouseDown} className="drag-handle">Header</div>
 *   </div>
 */
export function useDraggableModal() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    e.preventDefault();
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    origin.current = { ...offset };
  }, [offset]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: origin.current.x + (e.clientX - start.current.x),
        y: origin.current.y + (e.clientY - start.current.y),
      });
    };
    const onUp = () => { dragging.current = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const resetPosition = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return { offset, handleMouseDown, resetPosition };
}
