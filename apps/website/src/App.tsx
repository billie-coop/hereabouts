import { cldrVersion, type LocaleData, systemTimeZone, timeZoneIds } from '@billie-coop/hereabouts';
import { useEffect, useMemo, useState } from 'react';
import { pageLanguage, translatorFor } from './i18n';
import { cldrDataVersion, initialLocale, LOCALES, loadLocale } from './locale';
import { localeDetail, localeItems, zoneDetail, zoneItems } from './pickers';
import { SearchSelect } from './SearchSelect';
import { Docs } from './Docs';
import { Dates } from './sections/Dates';
import { DecimalMath } from './sections/DecimalMath';
import { Matching } from './sections/Matching';
import { Messages } from './sections/Messages';
import { Currency, Numbers } from './sections/Numbers';
import { Translations } from './sections/Translations';
import { Units } from './sections/Units';

const QUICK = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-MX',
  'pt-BR',
  'ja-JP',
  'zh-Hant-TW',
  'ar-EG',
  'hi-IN',
];
const ZONES = [...timeZoneIds()].sort();

const NAV = [
  ['numbers', 'Numbers'],
  ['currency', 'Currency'],
  ['math', 'Decimal math'],
  ['dates', 'Dates'],
  ['units', 'Units'],
  ['messages', 'Messages'],
  ['matching', 'Matching'],
  ['translations', 'Translations'],
] as const;

// Languages written right to left that have a catalog.
const RTL = new Set(['ar']);

export const App = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const toggleTheme = () => {
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.classList.toggle('dark', nextTheme === 'dark');
    root.style.colorScheme = nextTheme;
    try {
      localStorage.setItem('billie-coop-theme', nextTheme);
    } catch {
      // The switch still works when browser storage is unavailable.
    }
    setTheme(nextTheme);
  };
  const [hash, setHash] = useState(() => window.location.hash);
  const docs = /^#docs(?:\/|$)/.test(hash);
  useEffect(() => {
    const navigate = () => setHash(window.location.hash);
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const [localeId, setLocaleId] = useState(initialLocale);
  const [zone, setZone] = useState(() => systemTimeZone() ?? 'Etc/UTC');
  const [cldr, setCldr] = useState<LocaleData>();
  const [error, setError] = useState<string>();
  // English names are searchable whatever the page's language.
  const [en, setEn] = useState<LocaleData>();
  // The page's own text, in the chosen locale's language when there is a catalog for it.
  const t = useMemo(() => translatorFor(localeId), [localeId]);
  const dir = RTL.has(pageLanguage(localeId)) ? 'rtl' : 'ltr';

  useEffect(() => {
    loadLocale('en').then(setEn, () => {});
  }, []);

  useEffect(() => {
    let live = true;
    loadLocale(localeId)
      .then((data) => live && (setCldr(data), setError(undefined)))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [localeId]);

  // availableLocales() lists 'en', not 'en-US'; keep the chosen id in the list either way.
  const localeOptions = useMemo(
    () =>
      cldr && localeItems(cldr, en, LOCALES.includes(localeId) ? LOCALES : [localeId, ...LOCALES]),
    [cldr, en, localeId],
  );
  // Offsets as of when the page's locale was chosen.
  const zoneOptions = useMemo(() => cldr && zoneItems(cldr, en, ZONES, Date.now()), [cldr, en]);

  const demoReady = Boolean(cldr && localeOptions && zoneOptions);
  useEffect(() => {
    document.title = docs ? 'hereabouts · Docs' : 'hereabouts · Internationalization';
    const target = docs ? hash.replace('#docs/', 'docs-') : hash.slice(1);
    requestAnimationFrame(() => {
      if (target && target !== '#docs') document.getElementById(target)?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
  }, [docs, hash, demoReady]);

  return (
    <div className="site-shell">
      <a className="skip-link" href={docs ? '#docs/main' : '#main'}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-container header-inner">
          <a href="#" className="site-brand">
            hereabouts<span>by Billie co-op</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#" aria-current={!docs ? 'page' : undefined}>
              Overview
            </a>
            <a href="#docs" aria-current={docs ? 'page' : undefined}>
              Docs
            </a>
            <a href="https://github.com/billie-coop/hereabouts">GitHub ↗</a>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextTheme} mode`}
              title={`Switch to ${nextTheme} mode`}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </nav>
        </div>
      </header>
      {docs ? (
        <Docs />
      ) : (
        <main id="main" tabIndex={-1}>
          <section className="site-container site-hero">
            <h1>hereabouts</h1>
            <p className="hero-description">
              Internationalization for JavaScript and TypeScript, with formatting, decimal math and
              translations for 429 locales.
            </p>
            <div className="hero-actions">
              <code className="install-command">npm install @billie-coop/hereabouts</code>
              <a className="primary-link" href="#docs">
                Docs →
              </a>
              <a href="#demo">Examples ↓</a>
            </div>
          </section>
          <section id="demo" className="demo-area">
            <div className="site-container">
              <div className="demo-heading">
                <h2>Examples</h2>
              </div>
              <div dir={dir} lang={pageLanguage(localeId)}>
                {error ? (
                  <p role="alert">{t("Couldn't load locale data: {error}", { error })}</p>
                ) : !cldr || !localeOptions || !zoneOptions ? (
                  <p role="status">{t('Loading locale data…')}</p>
                ) : (
                  <>
                    <div className="demo-toolbar">
                      <p className="text-xs text-muted mb-4" dir="ltr">
                        v{cldrVersion()} · CLDR {cldrDataVersion}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <SearchSelect
                          label={t('Locale')}
                          placeholder={t('Search languages and regions')}
                          empty={(query) => t('No matches for “{query}”', { query })}
                          value={localeId}
                          onChange={setLocaleId}
                          items={localeOptions}
                          detail={(item) =>
                            localeDetail(cldr, en, item.value).map((line) => (
                              <div key={line} dir="auto">
                                {line}
                              </div>
                            ))
                          }
                          className="w-full sm:w-72"
                        />
                        <SearchSelect
                          label={t('Time zone')}
                          placeholder={t('Search time zones')}
                          empty={(query) => t('No matches for “{query}”', { query })}
                          value={zone}
                          onChange={setZone}
                          items={zoneOptions}
                          detail={(item) => <div dir="auto">{zoneDetail(cldr, item.value)}</div>}
                          className="w-full sm:w-72"
                        />
                      </div>
                      <nav
                        aria-label="Live examples"
                        className="flex flex-wrap gap-x-4 gap-y-2 pt-4 text-sm"
                      >
                        {NAV.map(([id, label]) => (
                          <a key={id} href={`#${id}`} className="text-accent hover:underline">
                            {t(label)}
                          </a>
                        ))}
                        <span dir="ltr" className="ms-auto flex flex-wrap gap-1.5">
                          {QUICK.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setLocaleId(id)}
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                id === localeId
                                  ? 'bg-accent text-page'
                                  : 'bg-surface text-muted hover:text-ink'
                              }`}
                            >
                              {id}
                            </button>
                          ))}
                        </span>
                      </nav>
                    </div>

                    <div className="feature-mosaic">
                      <Numbers cldr={cldr} t={t} />
                      <Currency cldr={cldr} t={t} />
                      <DecimalMath cldr={cldr} t={t} />
                      <Dates cldr={cldr} zone={zone} t={t} />
                      <Units cldr={cldr} t={t} />
                      <Messages cldr={cldr} t={t} />
                      <Matching cldr={cldr} t={t} />
                      <Translations cldr={cldr} localeId={localeId} t={t} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </main>
      )}

      <footer className="site-footer">
        <div className="site-container">
          <div className="footer-main">
            <p>
              Made at <a href="https://billie.coop">Billie co-op</a> ·{' '}
              <a href="https://github.com/billie-coop/hereabouts/blob/main/LICENSE">Apache-2.0</a>
            </p>
            <nav aria-label="Billie co-op projects">
              <a href="https://billie-coop.github.io/seaq/">seaq</a>
              <a href="https://billie-coop.github.io/serenity-now/">serenity-now</a>
              <a href="https://billie-coop.github.io/hereabouts/" aria-current="page">
                hereabouts
              </a>
            </nav>
          </div>
          <p className="footer-credit" lang={pageLanguage(localeId)} dir={dir}>
            <a className="hover:underline" href="https://github.com/phensley/cldr-engine">
              {t(
                'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.',
              )}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
