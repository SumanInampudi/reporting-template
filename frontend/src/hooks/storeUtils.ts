import type { ColorScheme, ThemeConfig, Density } from "@/types/dashboard";

let _nextId = 1;
export function uid(): string { return `widget-${_nextId++}`; }

let _filterId = 1;
export function filterUid(): string { return `filter-${_filterId++}`; }

export function isDateType(dataType: string): boolean {
  return /date|timestamp/i.test(dataType);
}

const STORAGE_KEY = "bi-dashboard-theme";

export function persistThemeConfig(cfg: ThemeConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.colorScheme && parsed.density) return parsed as ThemeConfig;
    }
  } catch { /* corrupt */ }
  return { colorScheme: "nike" as ColorScheme, density: "spacious" as Density };
}
