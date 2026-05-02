import { useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { fetchCurrentUser } from "@/lib/api";
import { useNikeLight } from "@/components/ui/HomeNav";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import HomePage from "@/pages/HomePage";
import SetupWizard from "@/pages/SetupWizard";
import WorkspaceApp from "@/pages/WorkspaceApp";

const CUSTOM_PROPS = [
  "--bg-app", "--bg-sidebar", "--bg-card", "--bg-input",
  "--border", "--text-primary", "--text-secondary", "--text-muted", "--accent",
] as const;

export default function App() {
  const { currentPage, themeConfig, setCurrentUser } = useStore();
  const nikeLight = useNikeLight();

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, [setCurrentUser]);

  // Sync root theme: nike-light/nike for home/setup pages, always nike for workspace
  useEffect(() => {
    const rootTheme = currentPage === "workspace" ? "nike" : (nikeLight ? "nike-light" : "nike");
    document.documentElement.setAttribute("data-theme", rootTheme);
    document.documentElement.setAttribute("data-density", themeConfig.density);

    document.documentElement.style.removeProperty("font-size");

    // Apply custom theme vars to the themed portal container (for popovers)
    const portal = document.getElementById("themed-portal");
    if (portal) {
      portal.setAttribute("data-theme", themeConfig.colorScheme);
      if (themeConfig.colorScheme === "custom" && themeConfig.customColors) {
        const cc = themeConfig.customColors;
        CUSTOM_PROPS.forEach((p) => {
          const key = p.replace("--", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          portal.style.setProperty(p, (cc as unknown as Record<string, string>)[key] ?? "");
        });
      } else {
        CUSTOM_PROPS.forEach((p) => portal.style.removeProperty(p));
      }
    }
  }, [themeConfig, nikeLight, currentPage]);

  const page =
    currentPage === "setup" ? <SetupWizard /> :
    currentPage === "workspace" ? <WorkspaceApp /> :
    <HomePage />;

  return <ErrorBoundary>{page}</ErrorBoundary>;
}
