import ThemePicker from "@/components/ui/ThemePicker";
import UserAvatar from "@/components/ui/UserAvatar";
import { useStore } from "@/hooks/useStore";

export default function AppHeader({ children }: { children?: React.ReactNode }) {
  const { currentUser } = useStore();

  return (
    <header className="app-header">
      <div className="app-header-left">
        <img src="/brand-logo.png" alt="Brand" className="app-header-logo" />
        <div className="app-header-title">
          <span className="app-header-brand">BI Excellence</span>
          <span className="app-header-subtitle">Suite</span>
        </div>
        {children}
      </div>
      <div className="app-header-right">
        <ThemePicker />
        {currentUser && <UserAvatar user={currentUser} showName size="sm" />}
      </div>
    </header>
  );
}
