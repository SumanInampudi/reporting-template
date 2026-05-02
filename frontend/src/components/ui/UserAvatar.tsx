import type { CurrentUser } from "@/types/dashboard";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  user: CurrentUser;
  showName?: boolean;
  size?: "sm" | "md";
}

export default function UserAvatar({ user, showName = true, size = "md" }: Props) {
  const initials = getInitials(user.display_name || user.username);

  return (
    <div className={`user-avatar-wrap user-avatar-wrap--${size}`}>
      <div className={`user-avatar-circle user-avatar-circle--${size}`} title={user.email || user.display_name}>
        {initials}
      </div>
      {showName && (
        <div className="user-avatar-info">
          <span className="user-avatar-name">{user.display_name}</span>
          {user.email && <span className="user-avatar-email">{user.email}</span>}
        </div>
      )}
    </div>
  );
}
