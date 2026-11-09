import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { seaq } from 'seaq';

/** One choice in a {@link SearchSelect}. */
export interface SearchItem {
  value: string;
  /** Emoji shown before the title; a globe when missing. */
  flag?: string;
  title: string;
  subtitle: string;
  /** Short text at the end of the row, such as a code or an offset. */
  meta?: string;
  /** Other names to search by but not show, such as English names. */
  aliases: string[];
}

/** One searchable name of an item. Each is scored on its own so a long list of names
 * doesn't push a good match down. */
interface Entry {
  item: SearchItem;
  text: string;
  kind: 'main' | 'meta' | 'other';
}

type Ranges = readonly (readonly [number, number])[];
interface Row {
  item: SearchItem;
  marks: Partial<Record<'title' | 'subtitle' | 'meta', Ranges>>;
}

const LIMIT = 60;

const entries = (items: SearchItem[]): Entry[] =>
  items.flatMap((item) => {
    const out: Entry[] = [{ item, text: `${item.title} ${item.subtitle}`, kind: 'main' }];
    if (item.meta) out.push({ item, text: item.meta, kind: 'meta' });
    for (const text of new Set([item.value, ...item.aliases])) {
      if (text && text !== item.meta) out.push({ item, text, kind: 'other' });
    }
    return out;
  });

/** Splits highlight ranges in 'title subtitle' into ranges for each. */
const splitMarks = (ranges: Ranges, at: number): Row['marks'] => ({
  title: ranges.filter(([, e]) => e < at).map(([b, e]) => [b, e] as const),
  subtitle: ranges.filter(([b]) => b > at).map(([b, e]) => [b - at - 1, e - at - 1] as const),
});

/** Wraps the matched characters of `text` in <mark>. */
const highlight = (text: string, ranges: Ranges | undefined): ReactNode => {
  if (!ranges?.length) return text;
  const out: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) out.push(text.slice(at, start));
    out.push(
      <mark key={start} className="rounded-sm bg-accent/20 text-inherit">
        {text.slice(start, end + 1)}
      </mark>,
    );
    at = end + 1;
  }
  out.push(text.slice(at));
  return out;
};

const Flag = ({ flag }: { flag?: string }) => (
  <span
    aria-hidden="true"
    className={`w-6 shrink-0 text-center text-lg ${flag ? '' : 'opacity-40'}`}
  >
    {flag ?? '🌐'}
  </span>
);

/**
 * A select with fuzzy search (seaq): type part of a name, a code or an English name. Arrow
 * keys move, Enter picks, Escape closes.
 */
export const SearchSelect = (props: {
  label: string;
  placeholder: string;
  empty: (query: string) => string;
  value: string;
  onChange: (value: string) => void;
  items: SearchItem[];
  /** More about the highlighted item, shown under the list. */
  detail?: (item: SearchItem) => ReactNode;
  className?: string;
}) => {
  const { items, value, onChange } = props;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.value === value);

  const index = useMemo(() => entries(items), [items]);

  const rows = useMemo((): Row[] => {
    const q = query.trim();
    if (!q) return items.map((item) => ({ item, marks: {} }));
    // Best entry first; keep each item once, at its best.
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const r of seaq(index, q, {
      keys: ['text'],
      limit: LIMIT * 4,
      // Drop weak fuzzy matches once something matches well.
      threshold: 0.5,
      includeMatches: true,
    })) {
      const { item, kind } = r.item;
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      const ranges = r.matches[0]?.indices ?? [];
      const marks: Row['marks'] =
        kind === 'main'
          ? splitMarks(ranges, item.title.length)
          : kind === 'meta'
            ? { meta: ranges }
            : {};
      out.push({ item, marks });
      if (out.length === LIMIT) break;
    }
    return out;
  }, [items, index, query]);

  // Open on the current choice; while typing, the best match.
  useEffect(() => {
    if (!open) return;
    setActive(
      query.trim()
        ? 0
        : Math.max(
            0,
            items.findIndex((i) => i.value === value),
          ),
    );
  }, [open, query, items, value]);

  useEffect(() => {
    if (open)
      list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  });

  const close = (focus: boolean) => {
    setOpen(false);
    setQuery('');
    if (focus) button.current?.focus();
  };
  const pick = (v: string) => {
    onChange(v);
    close(true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const last = rows.length - 1;
    const move: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      PageDown: Math.min(last, active + 8),
      PageUp: Math.max(0, active - 8),
    };
    if (e.key in move) {
      e.preventDefault();
      setActive(move[e.key] ?? 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.item.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const current = rows[active]?.item;

  return (
    <div ref={root} className={`relative flex flex-col gap-1 ${props.className ?? ''}`}>
      <span id={`${id}-label`} className="text-xs font-medium text-muted">
        {props.label}
      </span>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex items-center gap-2 rounded-lg border border-edge bg-page py-1 ps-2 pe-2.5 text-start text-sm shadow-xs focus:border-accent focus:outline-none"
      >
        <Flag flag={selected?.flag} />
        <span id={`${id}-value`} className="min-w-0 flex-1 leading-tight">
          <span className="block truncate">{selected?.title ?? value}</span>
          <span className="block truncate text-xs text-muted">{selected?.subtitle}</span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full start-0 z-20 mt-1 flex w-full flex-col overflow-hidden rounded-xl border border-edge bg-page shadow-lg sm:w-96">
          <input
            // biome-ignore lint/a11y/noAutofocus: the list opened to be searched
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={current ? `${id}-${active}` : undefined}
            aria-label={props.placeholder}
            placeholder={props.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            className="border-b border-edge bg-transparent px-3 py-2.5 text-sm focus:outline-none"
          />
          <div
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="max-h-80 overflow-y-auto overscroll-contain py-1"
          >
            {rows.map(({ item, marks }, i) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the combobox input
              <div
                key={item.value}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                tabIndex={-1}
                aria-selected={item.value === value}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => pick(item.value)}
                className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm ${
                  i === active ? 'bg-accent/10' : ''
                }`}
              >
                <Flag flag={item.flag} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={`block truncate ${item.value === value ? 'font-semibold' : ''}`}>
                    {highlight(item.title, marks.title)}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {highlight(item.subtitle, marks.subtitle)}
                  </span>
                </span>
                {item.meta && (
                  <span dir="ltr" className="shrink-0 font-mono text-xs text-muted">
                    {highlight(item.meta, marks.meta)}
                  </span>
                )}
              </div>
            ))}
            {!rows.length && (
              <div className="px-3 py-6 text-center text-sm text-muted">
                {props.empty(query.trim())}
              </div>
            )}
          </div>
          {current && props.detail && (
            <div className="border-t border-edge bg-surface px-3 py-2 text-xs text-muted">
              {props.detail(current)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
