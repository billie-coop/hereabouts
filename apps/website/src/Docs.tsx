const GUIDE = 'https://github.com/billie-coop/hereabouts/blob/main/README.md';
const topics = [
  ['install', 'Install'],
  ['locale-data', 'Load locale data'],
  ['formatting', 'Numbers and currencies'],
  ['decimal', 'Decimal math'],
  ['days', 'Days and time zones'],
  ['translations', 'App translations'],
  ['entry-points', 'Entry points'],
] as const;

const Code = ({ children }: { children: string }) => (
  <pre>
    <code>{children}</code>
  </pre>
);

export const Docs = () => (
  <main id="docs-main" tabIndex={-1} className="site-container docs-page">
    <div className="docs-heading">
      <p className="eyebrow">hereabouts</p>
      <h1>Documentation</h1>
      <p>Plain functions, plain data, and the locale data you need.</p>
    </div>
    <div className="docs-layout">
      <aside className="docs-toc">
        <nav aria-label="Documentation sections">
          <p className="eyebrow">On this page</p>
          {topics.map(([id, title]) => (
            <a key={id} href={`#docs/${id}`}>
              {title}
            </a>
          ))}
          <a href={GUIDE}>Full reference on GitHub ↗</a>
        </nav>
      </aside>
      <article className="docs-content">
        <section id="docs-install">
          <h2>Install</h2>
          <Code>{'npm install @billie-coop/hereabouts'}</Code>
          <p>
            One package for JavaScript and TypeScript. Node loads CommonJS; bundlers get ES modules
            and keep the functions you import. TypeScript types are included.
          </p>
          <p>
            Hereabouts is in its early releases (0.x). Until 1.0, a minor version may change the
            API.
          </p>
        </section>
        <section id="docs-locale-data">
          <h2>Load locale data</h2>
          <p>
            Each language has a resource pack covering its scripts and regions. Create a framework
            with a loader, then pass the loaded locale to your formatters.
          </p>
          <Code>{`import { createFramework, loadLocaleAsync, formatDecimal } from '@billie-coop/hereabouts';

// Browser: serve the package's packs/*.json with your static files.
const framework = createFramework({
  asyncLoader: (language) => fetch(\`/packs/\${language}.json\`).then((r) => {
    if (!r.ok) throw new Error(\`Couldn't load \${language}: \${r.status}\`);
    return r.text();
  }),
});
const de = await loadLocaleAsync(framework, 'de-DE');
formatDecimal(de, '1234.567', { maximumFractionDigits: 2 });
// '1.234,57'`}</Code>
          <p>
            Copy the packs you need from <code>@billie-coop/hereabouts/packs</code>. Packs must
            match the library’s major.minor version; a checksum catches mismatches. Loaded locales
            are cached per framework.
          </p>
          <p>
            For Node, use a synchronous loader with <code>readFileSync</code> and{' '}
            <code>loadLocale</code>.{' '}
            <a href={`${GUIDE}#locale-data`}>See the Node example and loading details ↗</a>
          </p>
        </section>
        <section id="docs-formatting">
          <h2>Numbers and currencies</h2>
          <p>
            Pass exact decimal digits as strings, or use numbers or decimals. Currency formatting
            applies each currency’s rounding rules. The <code>…ToParts</code> variants return typed
            parts for your own markup.
          </p>
          <Code>{`import { formatDecimal, formatCurrency, formatQuantity } from '@billie-coop/hereabouts';

formatDecimal(de, '1234567.891', { style: 'short' });
formatCurrency(de, '1234.5', 'EUR'); // '1.234,50 €'
formatQuantity(de, { value: '42.195', unit: 'kilometer' }, { length: 'short' });`}</Code>
          <a href="#numbers">Try the live number examples →</a>
        </section>
        <section id="docs-decimal">
          <h2>Decimal math</h2>
          <p>
            Immutable decimal values keep arithmetic exact and survive JSON serialization. Add,
            subtract and multiply without floating-point surprises; division and rounding accept a
            precision or scale.
          </p>
          <Code>{`import { decimal, decimalAdd, decimalToString } from '@billie-coop/hereabouts/decimal';

const total = decimalAdd(decimal('0.1'), '0.2');
decimalToString(total); // '0.3'`}</Code>
        </section>
        <section id="docs-days">
          <h2>Days and time zones</h2>
          <p>
            A <code>Day</code> has no time or zone, so a due date stays the same day. A{' '}
            <code>TimeOfDay</code> is a wall clock time. Instants are epoch milliseconds; use an
            explicit IANA zone when converting or formatting them.
          </p>
          <Code>{`import { dayFromString, dayAdd } from '@billie-coop/hereabouts/datetime';
import { formatDay, formatInstant } from '@billie-coop/hereabouts';

const due = dayFromString('2026-01-31');
formatDay(de, dayAdd(due, { months: 1 })); // '28.02.2026'
formatInstant(de, Date.UTC(2026, 2, 29, 12), 'Europe/Berlin', {
  datetime: 'short',
});`}</Code>
          <a href={`${GUIDE}#days-times-and-time-zones`}>
            Read about date math and daylight saving time ↗
          </a>
        </section>
        <section id="docs-translations">
          <h2>App translations</h2>
          <p>
            Keep an English source catalog and one catalog per language. Message keys and
            placeholders are checked by TypeScript; <code>checkCatalogs</code> checks catalog
            coverage. Missing translations fall back to the source language.
          </p>
          <Code>{`import { createTranslator, translate } from '@billie-coop/hereabouts';

const translator = createTranslator({
  source: { 'Due date': 'Due date' },
  catalogs: { de: { 'Due date': 'Fälligkeitsdatum' } },
});
translate(translator, 'de-DE', 'Due date'); // 'Fälligkeitsdatum'`}</Code>
          <p>
            The live examples on the overview use this translator.{' '}
            <a href={`${GUIDE}#translating-an-app`}>Read the translation guide ↗</a>
          </p>
        </section>
        <section id="docs-entry-points">
          <h2>Entry points</h2>
          <p>
            Import from the root for locale functions, or use a focused subpath. A subpath and the
            root share the same function.
          </p>
          <div className="docs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subpath</th>
                  <th>Use it for</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['/datetime', 'Days, times, instants and zones'],
                  ['/decimal', 'Exact decimals and rationals'],
                  ['/timezone', 'IANA time zone data'],
                  ['/messageformat', 'ICU messages and app translations'],
                  ['/plurals', 'Plural rules'],
                  ['/language-tag', 'BCP 47 language tags'],
                  ['/locale', 'Locale resolution and emoji flags'],
                  ['/locale-matcher', 'Matching user language preferences'],
                  ['/unit-converter', 'Unit conversion'],
                ].map(([path, use]) => (
                  <tr key={path}>
                    <td>
                      <code>{path}</code>
                    </td>
                    <td>{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <a href={GUIDE}>Read the full README ↗</a> for units, messages, plurals, locale
            matching, the convenience object, and project history.
          </p>
        </section>
      </article>
    </div>
  </main>
);
