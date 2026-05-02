import type { PaletteKey } from "@/types/dashboard";
import { COLOR_PALETTES, PALETTE_LABELS } from "@/lib/constants";

interface PalettePickerProps {
  value: PaletteKey;
  onChange: (v: PaletteKey) => void;
}

const KEYS = Object.keys(COLOR_PALETTES) as PaletteKey[];

export default function PalettePicker({ value, onChange }: PalettePickerProps) {
  return (
    <div className="palette-picker">
      {KEYS.map((key) => (
        <button
          key={key}
          className={`palette-option${key === value ? " palette-option--active" : ""}`}
          onClick={() => onChange(key)}
          title={PALETTE_LABELS[key]}
        >
          <div className="palette-swatches">
            {COLOR_PALETTES[key].slice(0, 5).map((c, i) => (
              <span key={i} className="palette-dot" style={{ background: c }} />
            ))}
          </div>
          <span className="palette-name">{PALETTE_LABELS[key]}</span>
        </button>
      ))}
    </div>
  );
}
