/**
 * Reusable skeleton / shimmer placeholder components for loading states.
 */

export function SkeletonLine({ width = "100%", height = 12 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 4 }} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <SkeletonLine width="60%" height={16} />
        <SkeletonLine width={24} height={24} />
      </div>
      <SkeletonLine width="90%" height={11} />
      <SkeletonLine width="70%" height={11} />
      <div className="skeleton-card-footer">
        <SkeletonLine width={60} height={20} />
        <SkeletonLine width={60} height={20} />
        <SkeletonLine width={60} height={20} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  const colWidths = Array.from({ length: cols }, (_, i) => {
    const base = [100, 140, 80, 120, 90];
    return base[i % base.length];
  });
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {colWidths.map((w, i) => (
          <SkeletonLine key={i} width={w} height={14} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skeleton-table-row">
          {colWidths.map((w, c) => (
            <SkeletonLine key={c} width={w * (0.6 + Math.random() * 0.4)} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonSidebarColumns({ groups = 3, itemsPerGroup = 4 }: { groups?: number; itemsPerGroup?: number }) {
  return (
    <div className="skeleton-sidebar-cols">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="skeleton-sidebar-group">
          <div className="skeleton-sidebar-group-header">
            <SkeletonLine width={14} height={14} />
            <SkeletonLine width={`${50 + g * 15}%`} height={13} />
            <SkeletonLine width={20} height={13} />
          </div>
          {Array.from({ length: itemsPerGroup }, (_, i) => (
            <div key={i} className="skeleton-sidebar-item">
              <SkeletonLine width={10} height={10} />
              <SkeletonLine width={`${55 + Math.random() * 35}%`} height={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonFilterChips({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-filter-chips">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-filter-chip">
          <SkeletonLine width={`${60 + i * 20}px`} height={26} />
        </div>
      ))}
    </div>
  );
}
