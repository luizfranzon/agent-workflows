import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean; tone?: "danger" };

export type MenuPosition = { x: number; y: number };

const VIEWPORT_MARGIN = 8;

export function menuPositionOf(event: MouseEvent<HTMLElement>): MenuPosition {
  const openedFromKeyboard = event.clientX === 0 && event.clientY === 0;
  if (!openedFromKeyboard) return { x: event.clientX, y: event.clientY };
  const anchor = event.currentTarget.getBoundingClientRect();
  return { x: anchor.left, y: anchor.bottom };
}

export function Menu({
  label,
  position,
  items,
  onClose,
}: {
  label: string;
  position: MenuPosition;
  items: MenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLUListElement>(null);
  const [placement, setPlacement] = useState(position);
  const enabledIndexes = items.flatMap((item, index) => (item.disabled ? [] : [index]));

  useLayoutEffect(() => {
    const menu = menuRef.current!;
    const { width, height } = menu.getBoundingClientRect();
    setPlacement({
      x: Math.max(VIEWPORT_MARGIN, Math.min(position.x, window.innerWidth - width - VIEWPORT_MARGIN)),
      y: Math.max(VIEWPORT_MARGIN, Math.min(position.y, window.innerHeight - height - VIEWPORT_MARGIN)),
    });
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [position]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const focusItem = (index: number) => menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[index]?.focus();
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    const focusedIndex = [...menuRef.current!.querySelectorAll("[role=menuitem]")].indexOf(document.activeElement!);
    const enabledPosition = enabledIndexes.indexOf(focusedIndex);
    const nextByKey: Record<string, number | undefined> = {
      ArrowDown: enabledIndexes[(enabledPosition + 1) % enabledIndexes.length],
      ArrowUp: enabledIndexes[(enabledPosition - 1 + enabledIndexes.length) % enabledIndexes.length],
      Home: enabledIndexes[0],
      End: enabledIndexes.at(-1),
    };
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
      return;
    }
    const next = nextByKey[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusItem(next);
  };

  return (
    <ul
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="menu"
      style={{ left: placement.x, top: placement.y }}
      onKeyDown={moveFocus}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            className="menu__item"
            data-tone={item.tone}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
