import { useState } from "react";
import { ArrowLeft, RotateCcw, Search, Settings, Users } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import HomeNav, { useNikeLight } from "@/components/ui/HomeNav";
import { adminSections } from "./docs/adminGuide";
import { userSections } from "./docs/userGuide";
import type { DocSection } from "./docs/adminGuide";

const FONT_SIZES = [13, 14, 15, 16, 18, 20] as const;
const DEFAULT_FONT = 15;

type DocTab = "admin" | "user";

const TAB_META: Record<DocTab, { title: string; subtitle: string; icon: React.ReactNode }> = {
  admin: {
    title: "Administrator Configuration Guide",
    subtitle: "Complete reference for setting up and configuring workspaces",
    icon: <Settings size={24} />,
  },
  user: {
    title: "User Guide",
    subtitle: "How to use the self-service analytics tool — from launch to export",
    icon: <Users size={24} />,
  },
};

export default function DocsPage() {
  const { setCurrentPage } = useStore();
  const nikeLight: boolean = useNikeLight();
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DocTab>("user");
  const [fontSize, setFontSize] = useState(() => {
    try { const s = localStorage.getItem("doc-font-size"); return s ? Number(s) : DEFAULT_FONT; }
    catch { return DEFAULT_FONT; }
  });

  const bumpFont = (dir: 1 | -1) => {
    const idx = FONT_SIZES.indexOf(fontSize as typeof FONT_SIZES[number]);
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, (idx >= 0 ? idx : 2) + dir))];
    setFontSize(next);
    try { localStorage.setItem("doc-font-size", String(next)); } catch { /* noop */ }
  };
  const resetFont = () => { setFontSize(DEFAULT_FONT); try { localStorage.removeItem("doc-font-size"); } catch { /* noop */ } };

  const allSections: DocSection[] = activeTab === "admin" ? adminSections() : userSections();
  const meta = TAB_META[activeTab];

  const filtered = search.trim()
    ? allSections.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (typeof s.content === "string" && s.content.toLowerCase().includes(search.toLowerCase()))
      )
    : allSections;

  const handleTabSwitch = (tab: DocTab) => {
    setActiveTab(tab);
    setSearch("");
    setActiveSection(null);
  };

  return (
    <div className="home-page" data-theme={nikeLight ? "nike-light" : "nike"}>
      <HomeNav
        links={[
          { label: "Workspaces", onClick: () => setCurrentPage("home") },
          { label: "Documentation", active: true },
          { label: "Settings" },
        ]}
      />

      <div className="doc-page">
        {/* Sidebar TOC */}
        <nav className="doc-sidebar">
          <button className="doc-back-btn" onClick={() => setCurrentPage("home")}>
            <ArrowLeft size={14} /> Back to Home
          </button>

          <div className="doc-tab-toggle">
            <button
              className={`doc-tab-btn${activeTab === "user" ? " doc-tab-btn--active" : ""}`}
              onClick={() => handleTabSwitch("user")}
            >
              <Users size={13} /> User Guide
            </button>
            <button
              className={`doc-tab-btn${activeTab === "admin" ? " doc-tab-btn--active" : ""}`}
              onClick={() => handleTabSwitch("admin")}
            >
              <Settings size={13} /> Admin Guide
            </button>
          </div>

          <div className="doc-search">
            <Search size={13} />
            <input
              className="doc-search-input"
              placeholder="Search docs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="doc-toc">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  className={`doc-toc-link${activeSection === s.id ? " doc-toc-link--active" : ""}`}
                  onClick={() => {
                    setActiveSection(s.id);
                    document.getElementById(`doc-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {s.icon}
                  <span>{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="doc-main" style={{ fontSize }}>
          <div className="doc-header">
            {meta.icon}
            <div>
              <h1 className="doc-main-title">{meta.title}</h1>
              <p className="doc-main-sub">{meta.subtitle}</p>
            </div>
            <div className="doc-font-controls" title="Adjust text size">
              <button
                className="doc-font-btn doc-font-btn--sm"
                onClick={() => bumpFont(-1)}
                disabled={fontSize <= FONT_SIZES[0]}
                title="Smaller text"
              >
                A
              </button>
              <button
                className="doc-font-btn doc-font-btn--lg"
                onClick={() => bumpFont(1)}
                disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                title="Larger text"
              >
                A
              </button>
              {fontSize !== DEFAULT_FONT && (
                <button className="doc-font-btn doc-font-btn--reset" onClick={resetFont} title="Reset to default size">
                  <RotateCcw size={11} />
                </button>
              )}
            </div>
          </div>

          {filtered.map((s) => (
            <section key={s.id} id={`doc-${s.id}`} className="doc-section">
              <h2 className="doc-section-title">
                {s.icon}
                <span>{s.title}</span>
              </h2>
              <div className="doc-section-body">
                {s.content}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="doc-empty">
              <Search size={24} />
              <p>No sections match &quot;{search}&quot;</p>
            </div>
          )}

          <footer className="doc-footer">
            <p>
              This documentation is maintained alongside the codebase.
              If a feature is missing, check with your development team or update this page.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
