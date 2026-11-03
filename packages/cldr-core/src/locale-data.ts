import type { KeyIndexMap, Schema } from '@phensley/cldr-types';
import type { Locale } from '@phensley/locale';
import type { Bundle } from './resource/bundle';
import type { SchemaConfig } from './schema/code/index';

/**
 * Everything the locale functions need for one locale, as one plain object: the strings of the
 * locale's bundle (it *is* a Bundle), the locale the caller asked for, and the schema accessor
 * and key indices for the schema config the resource pack was built with.
 *
 * Pass it as the first argument of the locale functions, e.g. `formatDecimal(locale, 1234.5)`.
 * Values derived from it (number symbols, parsed patterns, ...) are cached internally per object.
 *
 * @public
 */
export interface LocaleData extends Bundle {
  /** The locale as requested: the application's id and the resolved language tag. */
  readonly locale: Locale;
  /** Schema accessor tree for the active schema config. */
  readonly schema: Schema;
  /** Key indices (currency ids, unit ids, ...) for the active schema config. */
  readonly indices: KeyIndexMap;
  /** The active schema config. */
  readonly config: SchemaConfig;
}

/**
 * Combine a bundle with the locale and schema it is used with.
 *
 * @public
 */
export const localeData = (
  locale: Locale,
  bundle: Bundle,
  schema: Schema,
  indices: KeyIndexMap,
  config: SchemaConfig,
): LocaleData => ({
  ...bundle,
  locale,
  schema,
  indices,
  config,
});
