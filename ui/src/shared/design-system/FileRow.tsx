import type { ReactNode } from "react";

export type FileStatus = "M" | "A" | "D";

export function FileRow({
  path,
  status,
  additions,
  deletions,
  current = false,
  onSelect,
  viewed,
  onViewedChange,
  action,
}: {
  path: string;
  status: FileStatus;
  additions?: number;
  deletions?: number;
  current?: boolean;
  onSelect?: () => void;
  viewed?: boolean;
  onViewedChange?: (viewed: boolean) => void;
  action?: ReactNode;
}) {
  const nameStart = path.lastIndexOf("/") + 1;
  const label = (
    <>
      <span className={`file-row__status file-row__status--${status}`}>{status}</span>
      <span className="file-row__path">
        <span className="file-row__dir">{path.slice(0, nameStart)}</span>
        <span className="file-row__name">{path.slice(nameStart)}</span>
      </span>
      {additions !== undefined && <span className="file-row__additions">+{additions}</span>}
      {deletions !== undefined && <span className="file-row__deletions">−{deletions}</span>}
    </>
  );

  return (
    <div className="file-row" data-current={current}>
      {onSelect ? (
        <button type="button" className="file-row__open" aria-current={current} onClick={onSelect}>
          {label}
        </button>
      ) : (
        <span className="file-row__open">{label}</span>
      )}
      {viewed !== undefined && (
        <label className="file-row__viewed">
          <input type="checkbox" checked={viewed} onChange={(event) => onViewedChange?.(event.target.checked)} />
          Visto
        </label>
      )}
      {action}
    </div>
  );
}
