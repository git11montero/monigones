import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'>;
type Option = { value: string; label: ReactNode; text: string; disabled: boolean };
function plain(node: ReactNode): string {
  return Children.toArray(node)
    .map((x) => (isValidElement<{ children: ReactNode }>(x) ? plain(x.props.children) : String(x)))
    .join('');
}
/** Native-free listbox with touch targets, keyboard navigation and a viewport-bound portal. */
export function GameSelect({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  required,
  className,
  ...props
}: Props) {
  const generated = useId(),
    controlId = id || generated,
    listId = generated + '-options';
  const options: Option[] = Children.toArray(children).flatMap((child) =>
    isValidElement<{ value?: string | number; children: ReactNode; disabled?: boolean }>(child)
      ? [
          {
            value: String(child.props.value ?? plain(child.props.children)),
            label: child.props.children,
            text: plain(child.props.children),
            disabled: !!child.props.disabled,
          },
        ]
      : [],
  );
  const [own, setOwn] = useState(String(defaultValue ?? options[0]?.value ?? '')),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({ left: 8, top: 8, width: 260, maxHeight: 280 });
  const selected = String(value ?? own),
    index = options.findIndex((o) => o.value === selected),
    button = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    search = useRef({ text: '', at: 0 });
  function place() {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const h = Math.min(300, innerHeight - 24),
      below = innerHeight - r.bottom - 12,
      above = r.top - 12;
    const height = Math.min(h, Math.max(below, above));
    setPosition({
      left: Math.max(8, Math.min(r.left, innerWidth - Math.max(180, r.width) - 8)),
      top:
        below >= Math.min(240, h) || below >= above
          ? r.bottom + 4
          : Math.max(8, r.top - height - 4),
      width: Math.min(innerWidth - 16, Math.max(180, r.width)),
      maxHeight: height,
    });
  }
  function show() {
    if (disabled) return;
    place();
    setActive(Math.max(0, index));
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    setOwn(o.value);
    onChange?.({
      target: { value: o.value, name: name || '', id: controlId },
      currentTarget: { value: o.value },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    button.current?.focus();
  }
  function move(delta: number) {
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) {
        setActive(next);
        break;
      }
    }
  }
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!button.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      popup.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  return (
    <span className={'game-select ' + (className || '')}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        ref={button}
        id={controlId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-required={required}
        aria-invalid={props['aria-invalid']}
        title={props.title}
        disabled={disabled}
        className="game-select-trigger"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'Escape') {
              setOpen(false);
              e.stopPropagation();
            } else if (!open) show();
            else if (e.key === 'Enter' || e.key === ' ') choose(active);
            else if (e.key === 'Home') setActive(options.findIndex((o) => !o.disabled));
            else if (e.key === 'End') setActive(options.findLastIndex((o) => !o.disabled));
            else move(e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === 'Tab') setOpen(false);
          else if (e.key.length === 1) {
            if (!open) show();
            const now = performance.now();
            search.current = {
              text:
                (now - search.current.at < 700 ? search.current.text : '') +
                e.key.toLocaleLowerCase(),
              at: now,
            };
            const found = options.findIndex(
              (o) => !o.disabled && o.text.toLocaleLowerCase().startsWith(search.current.text),
            );
            if (found >= 0) setActive(found);
          }
        }}
      >
        <span>{options[index]?.label || 'Elegir…'}</span>
        <ChevronDown size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={listId}
            role="listbox"
            aria-label={props['aria-label'] || 'Opciones'}
            className="game-select-popup"
            style={{ position: 'fixed', ...position }}
            onPointerDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <button
                type="button"
                tabIndex={-1}
                role="option"
                id={`${listId}-${i}`}
                aria-selected={selected === o.value}
                aria-disabled={o.disabled}
                disabled={o.disabled}
                data-index={i}
                key={o.value}
                className={active === i ? 'focused' : ''}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {selected === o.value && <Check size={17} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
