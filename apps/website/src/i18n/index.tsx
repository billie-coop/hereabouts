import { createTranslator, resolveMessage, type TranslateArgs, translate } from '@phensley/cldr';
import type { ReactNode } from 'react';
import { ar } from './ar';
import { de } from './de';
import { en, type MessageKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { pt } from './pt';
import { zh } from './zh';
import { zhHant } from './zh-Hant';

/**
 * The site's translator: the English source catalog and one catalog per language. A locale
 * uses its most specific catalog ('zh-Hant-TW' -> 'zh-Hant', 'pt-PT' -> 'pt'), else English.
 */
export const translator = createTranslator({
  source: en,
  catalogs: { ar, de, es, fr, ja, pt, zh, 'zh-Hant': zhHant },
});

/** Translate for one locale. Keys and placeholders are checked against `en.ts` at compile time. */
export type T = <K extends MessageKey>(
  key: K,
  // When the key is unknown, K falls back to every key: arguments are then optional, so the
  // error names the key.
  ...args: MessageKey extends K ? [args?: Record<string, unknown>] : TranslateArgs<K>
) => string;

// The key and its arguments are checked by T's signature; this call just passes them on.
const translateAny = translate as (
  t: typeof translator,
  locale: string,
  key: string,
  args?: Record<string, unknown>,
) => string;

export const translatorFor =
  (locale: string): T =>
  (key, ...args) =>
    translateAny(translator, locale, key, args[0]);

/** The catalog a locale's text comes from: 'en' when it has none. */
export const pageLanguage = (locale: string): string =>
  resolveMessage(translator, locale, 'Locale')[1];

/** Show `code` spans in translated text as code. */
export const rich = (text: string): ReactNode[] =>
  text.split('`').map((part, i) =>
    i % 2 ? (
      <code key={i} dir="ltr">
        {part}
      </code>
    ) : (
      part
    ),
  );

export type { MessageKey };
