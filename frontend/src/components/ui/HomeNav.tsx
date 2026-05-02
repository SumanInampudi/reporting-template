import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import UserAvatar from "./UserAvatar";

interface NavLink {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface Props {
  links: NavLink[];
}

const STORAGE_KEY = "nike-mode";
let listeners: (() => void)[] = [];
function subscribe(cb: () => void) { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; }
function getSnapshot() { return localStorage.getItem(STORAGE_KEY) === "light"; }
function toggle() {
  localStorage.setItem(STORAGE_KEY, getSnapshot() ? "dark" : "light");
  listeners.forEach((l) => l());
}

export function useNikeLight() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default function HomeNav({ links }: Props) {
  const { currentUser } = useStore();
  const nikeLight = useNikeLight();

  return (
    <nav className="home-nav" data-theme={nikeLight ? "nike-light" : "nike"}>
      <div className="home-nav-left">
        <img src="/brand-logo.png" alt="Brand" className="home-nav-brand-img" />
      </div>
      <div className="home-nav-links">
        {links.map((link) => (
          <button
            key={link.label}
            className={`home-nav-link${link.active ? " home-nav-link--active" : ""}`}
            onClick={link.onClick}
            style={{ background: "none", border: "none", cursor: link.onClick ? "pointer" : "default", fontFamily: "inherit" }}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div className="home-nav-right">
        <button
          className="home-theme-toggle"
          onClick={toggle}
          title={nikeLight ? "Switch to dark mode" : "Switch to light mode"}
        >
          {nikeLight ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {currentUser && <UserAvatar user={currentUser} showName size="sm" />}
      </div>
    </nav>
  );
}
