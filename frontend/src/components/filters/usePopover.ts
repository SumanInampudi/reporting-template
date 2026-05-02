import { useEffect, useRef, useState, useCallback } from "react";
import type React from "react";

interface PopoverState {
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  chipRef: React.RefObject<HTMLDivElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  getPosition: (popW?: number, popH?: number) => React.CSSProperties;
  portalTarget: HTMLElement;
}

export function usePopover(popW = 352, popH = 448): PopoverState {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const popoverRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        chipRef.current && !chipRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getPosition = useCallback((w = popW, h = popH): React.CSSProperties => {
    if (!chipRef.current) return { top: 0, left: 0 };
    const rect = chipRef.current.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + h > window.innerHeight - 8) {
      top = rect.top - h - 6;
      if (top < 8) top = 8;
    }
    return { top, left };
  }, [popW, popH]);

  const portalTarget = document.getElementById("themed-portal") ?? document.body;

  return { open, setOpen, chipRef, popoverRef, getPosition, portalTarget };
}
