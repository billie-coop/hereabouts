import { Children, type ReactNode } from 'react';

/** Runs `f`, showing the error message instead of throwing so one bad input can't break a page. */
export const attempt = (f: () => string): string => {
  try {
    return f();
  } catch (e) {
    return `⚠ ${e instanceof Error ? e.message : String(e)}`;
  }
};

export const Section = (props: {
  id: string;
  title: string;
  intro: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  moreLabel: string;
  previewIndex?: number;
}) => (
  <details id={props.id} className="feature-card scroll-mt-6">
    <summary className="card-preview" aria-label={`${props.title} · ${props.moreLabel}`}>
      <h2>{props.title}</h2>
      <div className="card-preview-result">
        {Children.toArray(props.children)[props.previewIndex ?? 0]}
      </div>
    </summary>
    <div className="card-body">
      <p className="card-intro">{props.intro}</p>
      {props.controls && (
        <div className="mt-4 flex flex-wrap items-end gap-3">{props.controls}</div>
      )}
      <div className="card-examples">{props.children}</div>
    </div>
  </details>
);

/** One example: the call on the left, its result on the right. */
export const Example = (props: { code: string; result: ReactNode; note?: string }) => (
  <div className="example-row grid grid-cols-[minmax(0,1fr)] gap-1 py-2.5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-4">
    <code dir="ltr" className="overflow-x-auto whitespace-pre font-mono text-xs text-muted">
      {props.code}
    </code>
    <div className="min-w-0 text-[15px]">
      {/* Results follow their own text direction (Arabic, Hebrew) inside the English page. */}
      <span dir="auto" className="break-words">
        {props.result}
      </span>
      {props.note && <span className="ml-2 text-xs text-muted">{props.note}</span>}
    </div>
  </div>
);

const fieldClass =
  'rounded-lg border border-edge bg-page px-2.5 py-1.5 text-sm shadow-xs focus:border-accent focus:outline-none';

export const Field = (props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
    {props.label}
    <input
      type={props.type ?? 'text'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className={`${fieldClass} ${props.className ?? 'w-44'}`}
    />
  </label>
);

export const Select = (props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
    {props.label}
    {/* The browser's own arrow sits against the edge; hide it and draw one with room around it. */}
    <span className="relative">
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`${fieldClass} w-full appearance-none pr-9 ${props.className ?? ''}`}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  </label>
);

/** JSON string literal for code samples. */
export const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
