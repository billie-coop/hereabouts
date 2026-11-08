import {
  checkCatalogs,
  getLanguageDisplayName,
  type LocaleData,
  resolveMessage,
} from '@billie-coop/hereabouts';
import { rich, type T, translator } from '../i18n';
import { Example, q, Section } from '../ui';

const SOURCE_SAMPLE = `// i18n/en.ts: the source catalog, keyed by its English text
export const en = {
  'Due date': 'Due date',
  'The clocks change in {zone} on {date}: …{hours, plural, one {# hour} other {# hours}}…': '…',
};

// i18n/de.ts: one catalog per language, checked against the source's keys
export const de: MessageCatalog<keyof typeof en> = {
  'Due date': 'Fälligkeitsdatum',
};

// i18n/index.ts
const translator = createTranslator({ source: en, catalogs: { de, fr, ja, … } });
translate(translator, locale, 'Due date');
translate(translator, locale, 'Due dtae');                      // compile error: no such message
translate(translator, locale, 'The clocks change in {zone}…');  // compile error: missing arguments

// i18n.test.ts
expect(checkCatalogs(translator)).toEqual([]);`;

export const Translations = ({
  cldr,
  localeId,
  t,
}: {
  cldr: LocaleData;
  localeId: string;
  t: T;
}) => {
  const [, language] = resolveMessage(translator, localeId, 'Locale');
  const catalogs = Object.keys(translator.catalogs);
  const issues = checkCatalogs(translator);
  return (
    <Section
      moreLabel={t('More examples')}
      id="translations"
      title={t('Translations')}
      intro={rich(
        t(
          'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.',
        ),
      )}
    >
      <Example
        code={`resolveMessage(translator, ${q(localeId)}, 'Locale')`}
        result={`['${translator.catalogs[language]?.Locale ?? translator.source.Locale}', '${language}']`}
      />
      <Example
        code={`translate(translator, ${q(localeId)}, 'This text is in {language}.', { language })`}
        result={t('This text is in {language}.', {
          language: getLanguageDisplayName(cldr, language),
        })}
      />
      <Example
        code="Object.keys(translator.source).length, catalogs"
        result={t(
          '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.',
          { count: Object.keys(translator.source).length, languages: catalogs.length },
        )}
      />
      <Example
        code="checkCatalogs(translator)"
        result={rich(
          t('Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.', {
            count: issues.length,
          }),
        )}
      />
      <pre
        dir="ltr"
        className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
      >
        {SOURCE_SAMPLE}
      </pre>
      <p className="pt-3 text-xs text-zinc-500">
        {t(
          'Translations on this site were written by an AI and have not been reviewed by native speakers.',
        )}
      </p>
    </Section>
  );
};
