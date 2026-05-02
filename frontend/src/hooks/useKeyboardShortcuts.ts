import { useEffect } from "react";
import { useStore } from "./useStore";

const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag && IGNORED_TAGS.has(tag)) return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const handlers = useStore.getState().shortcutHandlers;

      if (key === "enter" && !e.shiftKey) {
        const fn = handlers["load-data"];
        if (fn) { e.preventDefault(); fn(); }
        return;
      }

      if (isTyping(e)) return;

      if (key === "e" && !e.shiftKey) {
        const fn = handlers["export"];
        if (fn) { e.preventDefault(); fn(); }
        return;
      }

      if (key === "s") {
        e.preventDefault();
        const fn = handlers["save-preset"];
        if (fn) fn();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
