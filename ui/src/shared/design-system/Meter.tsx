import type { CSSProperties } from "react";

const WARNING_PERCENT = 60;
const LIMIT_PERCENT = 100;

export function meterTone(percent: number) {
  if (percent >= LIMIT_PERCENT) return "danger";
  if (percent >= WARNING_PERCENT) return "warning";
  return "success";
}

function meterAttributes(percent: number, label: string) {
  const clampedPercent = Math.min(Math.max(percent, 0), LIMIT_PERCENT);
  return {
    role: "meter",
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": LIMIT_PERCENT,
    "aria-valuenow": Math.round(clampedPercent),
    style: { "--meter-percent": `${clampedPercent}%` } as CSSProperties,
  };
}

export function RingMeter({ percent, label, size = "md" }: { percent: number; label: string; size?: "xs" | "sm" | "md" }) {
  return (
    <span className={`ring-meter ring-meter--${size} meter--${meterTone(percent)}`} {...meterAttributes(percent, label)}>
      <span className="ring-meter__value">{Math.round(percent)}%</span>
    </span>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <span className={`progress-bar meter--${meterTone(percent)}`} {...meterAttributes(percent, label)}>
      <span className="progress-bar__fill" />
    </span>
  );
}
