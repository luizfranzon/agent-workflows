import type { ReactNode } from "react";

export type Tone = "warning" | "info" | "ai" | "success" | "danger" | "neutral";
export type ActivityState = "waiting" | "running" | "done" | "queued" | "interrupted" | "error";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StatusDot({
  state,
  hideLabel = false,
  children,
}: {
  state: ActivityState;
  hideLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`status-dot status-dot--${state}`} title={hideLabel ? String(children) : undefined}>
      <span className="status-dot__dot" aria-hidden="true" />
      <span className={hideLabel ? "visually-hidden" : undefined}>{children}</span>
    </span>
  );
}

export function Spinner({ label }: { label: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}
