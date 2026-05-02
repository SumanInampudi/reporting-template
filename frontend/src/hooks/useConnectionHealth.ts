import { useCallback, useEffect, useRef, useState } from "react";
import { testConnection } from "@/lib/api";

export type HealthStatus = "checking" | "connected" | "disconnected";

const POLL_INTERVAL_MS = 60_000;

export function useConnectionHealth() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [message, setMessage] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await testConnection();
      const ms = Math.round(performance.now() - t0);
      setLatencyMs(ms);
      setStatus(res.ok ? "connected" : "disconnected");
      setMessage(res.message);
    } catch {
      setLatencyMs(null);
      setStatus("disconnected");
      setMessage("Cannot reach server");
    }
  }, []);

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [check]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  return { status, message, latencyMs, recheck: check };
}
