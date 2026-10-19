import type { ReactNode } from "react";
import { Icon } from "./Icon";

type ChipVariant = "toggle" | "filter" | "token";

export function Chip({
  variant = "toggle",
  selected = false,
  onClick,
  onRemove,
  children,
}: {
  variant?: ChipVariant;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children: string;
}) {
  const className = `chip chip--${variant}`;

  if (onRemove) {
    return (
      <span className={className}>
        {children}
        <button type="button" className="chip__remove" aria-label={`Remover ${children}`} onClick={onRemove}>
          <Icon name="close" size={14} />
        </button>
      </span>
    );
  }

  if (!onClick) return <span className={className}>{children}</span>;

  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: Value; label: ReactNode }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <span className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  mono = false,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  mono?: boolean;
  children: ReactNode;
}) {
  const classes = ["field", mono && "field--mono", error && "field--error"].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  );
}
