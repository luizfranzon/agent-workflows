import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Icon } from "./Icon";

export type SelectOption<Value extends string | number> = { value: Value; label: string };

const TYPEAHEAD_RESET_MS = 500;
const PAGE_JUMP = 10;
const NOT_FOUND = -1;

function nextMatchingIndex(labels: string[], typed: string, activeIndex: number) {
  const isRepeatedCharacter = [...typed].every((character) => character === typed[0]);
  const searchText = isRepeatedCharacter ? typed[0]! : typed;
  const firstCandidate = isRepeatedCharacter ? activeIndex + 1 : activeIndex;
  const candidates = labels.map((_, offset) => (firstCandidate + offset) % labels.length);
  return candidates.find((index) => labels[index]!.toLocaleLowerCase().startsWith(searchText)) ?? NOT_FOUND;
}

export function Select<Value extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: {
  label?: string;
  options: readonly SelectOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}) {
  const baseId = useId();
  const listboxId = `${baseId}-opcoes`;
  const optionId = (index: number) => `${baseId}-opcao-${index}`;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
  const typed = useRef({ text: "", resetTimer: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLSpanElement>(null);
  const lastIndex = options.length - 1;

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const listbox = listboxRef.current;
    if (!isOpen || trigger === null || listbox === null) return;
    listbox.showPopover?.();
    const placeNextToTrigger = () => {
      const triggerBox = trigger.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(listbox).marginTop) || 0;
      const spaceBelow = window.innerHeight - triggerBox.bottom;
      const opensUpward = spaceBelow < listbox.offsetHeight + gap && triggerBox.top > spaceBelow;
      listbox.style.left = `${triggerBox.left}px`;
      listbox.style.minWidth = `${triggerBox.width}px`;
      listbox.style.top = `${opensUpward ? triggerBox.top - listbox.offsetHeight - 2 * gap : triggerBox.bottom}px`;
    };
    const closeOnOutsideScroll = (event: Event) => {
      if (!listbox.contains(event.target as Node)) setIsOpen(false);
    };
    placeNextToTrigger();
    window.addEventListener("scroll", closeOnOutsideScroll, true);
    window.addEventListener("resize", placeNextToTrigger);
    return () => {
      window.removeEventListener("scroll", closeOnOutsideScroll, true);
      window.removeEventListener("resize", placeNextToTrigger);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
  });

  const open = (index = Math.max(selectedIndex, 0)) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const choose = (index: number) => {
    setIsOpen(false);
    const option = options[index];
    if (option !== undefined && option.value !== value) onChange(option.value);
  };

  const moveTo = (index: number) => {
    const boundedIndex = Math.min(Math.max(index, 0), lastIndex);
    if (isOpen) setActiveIndex(boundedIndex);
    else open(boundedIndex);
  };

  const typeAhead = (character: string) => {
    window.clearTimeout(typed.current.resetTimer);
    const labels = options.map((option) => option.label);
    const startIndex = isOpen ? activeIndex : Math.max(selectedIndex, 0);
    let text = typed.current.text + character.toLocaleLowerCase();
    let match = nextMatchingIndex(labels, text, startIndex);
    if (match === NOT_FOUND) {
      text = character.toLocaleLowerCase();
      match = nextMatchingIndex(labels, text, startIndex);
    }
    typed.current.text = text;
    typed.current.resetTimer = window.setTimeout(() => (typed.current.text = ""), TYPEAHEAD_RESET_MS);
    if (match !== NOT_FOUND) moveTo(match);
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (isPrintable && event.key !== " ") {
      event.preventDefault();
      typeAhead(event.key);
      return;
    }
    const closedActions: Record<string, () => void> = {
      ArrowDown: () => open(),
      ArrowUp: () => open(),
      Enter: () => open(),
      " ": () => open(),
      Home: () => open(0),
      End: () => open(lastIndex),
    };
    const openActions: Record<string, () => void> = {
      ArrowDown: () => (event.altKey ? undefined : moveTo(activeIndex + 1)),
      ArrowUp: () => (event.altKey ? choose(activeIndex) : moveTo(activeIndex - 1)),
      Home: () => moveTo(0),
      End: () => moveTo(lastIndex),
      PageDown: () => moveTo(activeIndex + PAGE_JUMP),
      PageUp: () => moveTo(activeIndex - PAGE_JUMP),
      Enter: () => choose(activeIndex),
      " ": () => choose(activeIndex),
      Escape: () => setIsOpen(false),
    };
    if (isOpen && event.key === "Tab") {
      choose(activeIndex);
      return;
    }
    const action = (isOpen ? openActions : closedActions)[event.key];
    if (action === undefined) return;
    event.preventDefault();
    action();
  };

  const chooseByClick = (event: MouseEvent, index: number) => {
    event.preventDefault();
    choose(index);
  };

  return (
    <span className={["select", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="select__trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          if (isOpen) setIsOpen(false);
          else open();
        }}
        onKeyDown={handleKey}
        onBlur={() => setIsOpen(false)}
      >
        <span className="select__value">{options[selectedIndex]?.label ?? ""}</span>
        <Icon name="chevron" size={14} />
      </button>
      {isOpen && (
        <span ref={listboxRef} popover="manual" role="listbox" id={listboxId} className="select__listbox" aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <span
              key={option.value}
              id={optionId(index)}
              role="option"
              className="select__option"
              aria-selected={index === selectedIndex}
              data-active={index === activeIndex}
              onMouseMove={() => setActiveIndex(index)}
              onClick={(event) => chooseByClick(event, index)}
            >
              <span className="select__check" aria-hidden="true">
                {index === selectedIndex && <Icon name="check" size={14} />}
              </span>
              {option.label}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
