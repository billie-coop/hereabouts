import {
  formatList,
  formatMessage,
  getPluralCardinal,
  type LocaleData,
  type MessageNamedArgs,
  messageFormatter,
} from '@billie-coop/hereabouts';
import { useMemo, useState } from 'react';
import type { T } from '../i18n';
import { attempt, Example, Field, q, Section } from '../ui';

const DEFAULT_MESSAGE =
  '{count, plural, =0 {No invoices are} one {# invoice is} other {# invoices are}} overdue for {customer}.';

export const Messages = ({ cldr, t }: { cldr: LocaleData; t: T }) => {
  const [items, setItems] = useState('Ada, Grace, Katherine');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [args, setArgs] = useState('{ "count": 3, "customer": "Billie Co-op" }');
  const formatter = useMemo(() => messageFormatter(cldr), [cldr]);
  const list = items
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const listCode = `[${list.map(q).join(', ')}]`;
  const rows: [string, () => string][] = [
    [`formatList(locale, ${listCode})`, () => formatList(cldr, list)],
    [`formatList(locale, ${listCode}, 'or')`, () => formatList(cldr, list, 'or')],
    [`formatList(locale, ${listCode}, 'unit-narrow')`, () => formatList(cldr, list, 'unit-narrow')],
  ];
  const plurals = ['0', '1', '2', '5', '11', '1.5'];
  return (
    <Section
      moreLabel={t('More examples')}
      id="messages"
      title={t('Lists, plurals and messages')}
      intro={t(
        "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.",
      )}
      controls={
        <Field label={t('List items')} value={items} onChange={setItems} className="w-72" />
      }
    >
      {rows.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
      <Example
        code={`[${plurals.join(', ')}].map((n) => getPluralCardinal(locale, n))`}
        result={attempt(() =>
          plurals.map((n) => `${n}: ${getPluralCardinal(cldr, n)}`).join(' · '),
        )}
      />
      <div className="grid gap-3 pt-4 pb-2 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t('Message (ICU)')}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="rounded-lg border border-edge bg-page p-2 font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t('Arguments (JSON)')}
          <textarea
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            rows={3}
            className="rounded-lg border border-edge bg-page p-2 font-mono text-xs"
          />
        </label>
      </div>
      <Example
        code="formatMessage(messageFormatter(locale), message, [], args)"
        result={attempt(() =>
          formatMessage(formatter, message, [], JSON.parse(args) as MessageNamedArgs),
        )}
      />
    </Section>
  );
};
