import type { StateCreator } from "zustand";
import type {
  ColorScheme,
  CustomThemeColors,
  Density,
  SavedCustomTheme,
  ThemeConfig,
} from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";
import { loadThemeConfig, persistThemeConfig } from "../storeUtils";

const initialTheme = loadThemeConfig();

export interface ThemeSlice {
  themeConfig: ThemeConfig;
  theme: ColorScheme;
  savedCustomThemes: SavedCustomTheme[];
  setColorScheme: (scheme: ColorScheme) => void;
  setDensity: (d: Density) => void;
  setCustomColors: (colors: CustomThemeColors) => void;
  toggleTheme: () => void;
  setSavedCustomThemes: (themes: SavedCustomTheme[]) => void;
}

export const createThemeSlice: StateCreator<DashboardStore, [], [], ThemeSlice> = (set) => ({
  themeConfig: initialTheme,
  theme: initialTheme.colorScheme,

  setColorScheme: (scheme) =>
    set((s) => {
      const cfg = { ...s.themeConfig, colorScheme: scheme };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: scheme };
    }),

  setDensity: (density) =>
    set((s) => {
      const cfg = { ...s.themeConfig, density };
      persistThemeConfig(cfg);
      return { themeConfig: cfg };
    }),

  setCustomColors: (customColors) =>
    set((s) => {
      const cfg = { ...s.themeConfig, colorScheme: "custom" as ColorScheme, customColors };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: "custom" };
    }),

  toggleTheme: () =>
    set((s) => {
      const LIGHT_SCHEMES = new Set(["light", "slate", "minimal"]);
      const isLight = LIGHT_SCHEMES.has(s.themeConfig.colorScheme);
      const next: ColorScheme = isLight ? "dark" : "light";
      const cfg = { ...s.themeConfig, colorScheme: next };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: next };
    }),

  savedCustomThemes: [],
  setSavedCustomThemes: (savedCustomThemes) => set({ savedCustomThemes }),
});
