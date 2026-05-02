import { create } from "zustand";
import type { DashboardStore } from "./storeTypes";
export type { SidebarTab } from "./storeTypes";
import { createCoreSlice } from "./slices/coreSlice";
import { createThemeSlice } from "./slices/themeSlice";
import { createCatalogSlice } from "./slices/catalogSlice";
import { createDataSlice } from "./slices/dataSlice";
import { createWidgetSlice } from "./slices/widgetSlice";
import { createFilterSlice } from "./slices/filterSlice";
import { createDimensionSlice } from "./slices/dimensionSlice";
import { createPresetSlice } from "./slices/presetSlice";

export const useStore = create<DashboardStore>()((...a) => ({
  ...createCoreSlice(...a),
  ...createThemeSlice(...a),
  ...createCatalogSlice(...a),
  ...createDataSlice(...a),
  ...createWidgetSlice(...a),
  ...createFilterSlice(...a),
  ...createDimensionSlice(...a),
  ...createPresetSlice(...a),
}));
