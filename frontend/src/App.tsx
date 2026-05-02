import { useEffect, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { fetchCurrentUser, fetchConfig, fetchWorkspaces } from "@/lib/api";
import { useNikeLight } from "@/components/ui/HomeNav";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/Toast";
import HomePage from "@/pages/HomePage";
import SetupWizard from "@/pages/SetupWizard";
import WorkspaceApp from "@/pages/WorkspaceApp";
import DocsPage from "@/pages/DocsPage";
import OnboardingPage from "@/pages/OnboardingPage";

const ALL_THEME_PROPS = [
  "--bg-app", "--bg-sidebar", "--bg-card", "--bg-card-hover", "--bg-input",
  "--border", "--border-focus",
  "--text-primary", "--text-secondary", "--text-muted",
  "--accent", "--accent-hover", "--accent-subtle",
  "--danger", "--success", "--warning",
  "--radius", "--shadow",
] as const;

export default function App() {
  const { currentPage, themeConfig, setCurrentUser, setTeamName, setPlatformTagline } = useStore();
  const nikeLight = useNikeLight();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});

    Promise.all([fetchConfig(), fetchWorkspaces().catch(() => [])])
      .then(([config, workspaces]) => {
        if (config.team_name) {
          setTeamName(config.team_name);
          document.title = config.team_name;
        }
        if (config.platform_tagline) {
          setPlatformTagline(config.platform_tagline);
        }
        const onboarded = String(config.onboarded) === "true";
        setNeedsOnboarding(!onboarded && workspaces.length === 0);
      })
      .catch(() => setNeedsOnboarding(false));
  }, [setCurrentUser, setTeamName, setPlatformTagline]);

  useEffect(() => {
    const scheme = themeConfig.colorScheme;
    const rootTheme = currentPage === "workspace"
      ? (scheme === "custom" ? "dark" : scheme)
      : (nikeLight ? "nike-light" : "nike");
    document.documentElement.setAttribute("data-theme", rootTheme);
    document.documentElement.setAttribute("data-density", themeConfig.density);
    document.documentElement.style.removeProperty("font-size");

    const portal = document.getElementById("themed-portal");
    if (portal) {
      portal.setAttribute("data-theme", scheme === "custom" ? "dark" : scheme);
      if (scheme === "custom" && themeConfig.customColors) {
        const cc = themeConfig.customColors;
        ALL_THEME_PROPS.forEach((p) => {
          const key = p.replace("--", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          const val = (cc as unknown as Record<string, string>)[key];
          if (val) portal.style.setProperty(p, val);
          else portal.style.removeProperty(p);
        });
      } else {
        ALL_THEME_PROPS.forEach((p) => portal.style.removeProperty(p));
      }
    }
  }, [themeConfig, nikeLight, currentPage]);

  if (needsOnboarding === null) {
    return null;
  }

  if (needsOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  const page =
    currentPage === "setup" ? <SetupWizard /> :
    currentPage === "workspace" ? <WorkspaceApp /> :
    currentPage === "docs" ? <DocsPage /> :
    <HomePage />;

  return (
    <ErrorBoundary>
      {page}
      <ToastContainer />
    </ErrorBoundary>
  );
}
