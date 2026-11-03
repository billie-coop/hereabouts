import type { PrimitiveBundle } from '@phensley/cldr-types';
import {
  type LanguageTag,
  tagExtensionSubtags,
  tagLanguage,
  tagRegion,
  tagScript,
} from '@phensley/language-tag';
import { getPluralRules, type PluralRules } from '@phensley/plurals';

/**
 * Maps a string table offset to an index in the exceptions table.
 *
 * @internal
 */
export type ExceptionIndex = { readonly [y: number]: number };

/**
 * All strings for one locale, plus a few precomputed properties of its language tag. Plain data;
 * read strings with `bundleGet(bundle, offset)` (normally through the schema accessors).
 *
 * @public
 */
export interface Bundle extends PrimitiveBundle {
  readonly tag: LanguageTag;
  /** e.g. 'en-US', precomputed for fast lookups into region-keyed maps */
  readonly languageRegion: string;
  /** e.g. 'en-Latn' */
  readonly languageScript: string;
  /** Calendar system from the 'u-ca' extension, or '' to use the region's preference. */
  readonly calendarSystem: string;
  /** Number system from the 'u-nu' extension, or 'default'. */
  readonly numberSystem: string;
  /** Spellout rule sets from the resource pack. */
  readonly spellout: any;
  /** Cardinal and ordinal plural rules for the locale. */
  readonly plurals: PluralRules;
}

/**
 * Read the string at the given offset. A region-specific exception overrides the string table.
 *
 * @public
 */
export const bundleGet = (bundle: PrimitiveBundle, offset: number): string => {
  // If there is an exception index, attempt to resolve it.
  const index = bundle.index;
  /* istanbul ignore else -- @preserve */
  if (index) {
    const i = index[offset];
    if (i !== undefined) {
      return bundle.exceptions[i] || '';
    }
  }

  // Return the actual string.
  return bundle.strings[offset] || '';
};

/**
 * Build the bundle for a resolved language tag from the tables of a resource pack.
 *
 * @internal
 */
export const stringBundle = (
  id: string,
  tag: LanguageTag,
  strings: readonly string[],
  exceptions: readonly string[],
  index: ExceptionIndex | undefined,
  spellout: any,
): Bundle => {
  const language = tagLanguage(tag);
  const region = tagRegion(tag);

  // Empty string will select the preferred calendar for the region.
  let calendarSystem = '';
  let numberSystem = 'default';

  // See if there are unicode extensions for number and calendar systems.
  for (const subtag of tagExtensionSubtags(tag, 'u')) {
    if (subtag.startsWith('nu-')) {
      numberSystem = subtag.substring(3);
    } else if (subtag.startsWith('ca-')) {
      calendarSystem = subtag.substring(3);
    }
  }

  return {
    id,
    language,
    region,
    strings,
    exceptions,
    index,
    tag,
    languageRegion: `${language}-${region}`,
    languageScript: `${language}-${tagScript(tag)}`,
    calendarSystem,
    numberSystem,
    spellout,
    plurals: getPluralRules(language, region),
  };
};
