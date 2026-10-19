import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import type { Tone } from "./Status";

export function Dialog({
  open,
  title,
  onClose,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${size}`}
      onClose={onClose}
      onClick={(event) => {
        const clickedBackdrop = event.target === event.currentTarget;
        if (clickedBackdrop) onClose();
      }}
    >
      <h2 className="dialog__title">{title}</h2>
      <div className="dialog__body">{children}</div>
      {footer && <div className="dialog__footer">{footer}</div>}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="dialog__text">{children}</p>
    </Dialog>
  );
}

export function Callout({
  tone = "info",
  title,
  action,
  children,
}: {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      <div className="callout__content">
        {title && <strong className="callout__title">{title}</strong>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = "panel",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "panel" | "dashed";
}) {
  return (
    <div className={`empty-state empty-state--${variant}`}>
      <strong className="empty-state__title">{title}</strong>
      {description && <p className="empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
