import { useId, type ComponentProps } from "react";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger" | "ai";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabledReason?: string;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  disabledReason,
  type = "button",
  className,
  children,
  disabled,
  ...buttonAttributes
}: ButtonProps) {
  const reasonId = useId();
  const isIconOnly = children === undefined;
  const classes = [
    "button",
    `button--${variant}`,
    `button--${size}`,
    isIconOnly && "button--icon-only",
    className,
  ].filter(Boolean).join(" ");

  const button = (
    <button
      {...buttonAttributes}
      type={type}
      className={classes}
      disabled={disabled || disabledReason !== undefined}
      aria-describedby={disabledReason === undefined ? undefined : reasonId}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );

  if (disabledReason === undefined) return button;

  return (
    <span className="button-with-reason">
      {button}
      <span id={reasonId} className="button-with-reason__reason">
        {disabledReason}
      </span>
    </span>
  );
}
