import { useEffect, useState, useCallback, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "error" | "success" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function emit(type: ToastType, message: string) {
  const item: ToastItem = { id: nextId++, type, message };
  listeners.forEach((fn) => fn(item));
}

export const toast = {
  error: (msg: string) => emit("error", msg),
  success: (msg: string) => emit("success", msg),
  info: (msg: string) => emit("info", msg),
};

const ICON: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const AUTO_DISMISS_MS = 4000;

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const handler: Listener = (item) => {
      setItems((prev) => [...prev, item]);
      const timer = setTimeout(() => remove(item.id), AUTO_DISMISS_MS);
      timers.current.set(item.id, timer);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [remove]);

  if (items.length === 0) return null;

  return (
    <div className="toast-container">
      {items.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div key={t.id} className={`toast-item toast-item--${t.type}`}>
            <Icon size={16} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
