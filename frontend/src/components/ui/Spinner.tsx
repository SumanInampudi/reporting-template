import { Loader2 } from "lucide-react";

export default function Spinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="sidebar-info">
      <Loader2 size={14} className="spin" /> {text}
    </div>
  );
}
