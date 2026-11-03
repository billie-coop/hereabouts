import {
  isLanguageTag,
  type LanguageTag,
  languageTag,
  parseLanguageTag,
  tagCompact,
  tagExtensions,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagPrivateUse,
  tagRegion,
  tagScript,
  tagVariant,
} from '../language-tag';
import { type Locale, resolveLanguageTag, substituteAliases } from '../locale';
import { paradigmLocales } from './autogen.distance';
import { DEFAULT_THRESHOLD, getDistance, MAX_DISTANCE } from './distance';

// Space and comma-separated bundle ids.
const TAG_SEP = /[,\s]+/g;

const U = undefined;

const numberCmp = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);

/**
 * A locale held by the matcher, paired with its compact tag string.
 *
 * @public
 */
export interface LocaleMatcherEntry extends Locale {
  readonly compact: string;
}

const entry = (id: string, tag: LanguageTag): LocaleMatcherEntry => ({
  id,
  tag,
  compact: tagCompact(tag),
});

type LangTag = Locale | LanguageTag | string;

/**
 * Flatten and split the string or array into a list of matcher entries.
 *
 * Visible for testing.
 */
export const parse = (
  locales: string | (Locale | LangTag)[] = [],
  options: LocaleMatcherOptions = {},
): LocaleMatcherEntry[] => {
  let raw: LangTag[];
  if (typeof locales === 'string') {
    raw = locales.split(TAG_SEP);
  } else {
    raw = locales.reduce((a: LangTag[], e: Locale | LanguageTag | string): LangTag[] => {
      if (typeof e === 'string') {
        const tmp = e.split(TAG_SEP);
        return a.concat(tmp);
      }
      if (isLanguageTag((e as Locale).tag)) {
        a.push(e as Locale);
      } else if (isLanguageTag(e)) {
        a.push(e);
      }
      return a;
    }, [] as LangTag[]);
  }

  const resolve = options.resolve !== false;
  const result: LocaleMatcherEntry[] = [];
  const len = raw.length;
  for (let i = 0; i < len; i++) {
    const e = raw[i];
    let id: string;
    let tag: LanguageTag;
    if (isLanguageTag(e)) {
      tag = e;
      id = tagCompact(tag);
    } else if (typeof e === 'string') {
      id = e.trim();
      tag = parseLanguageTag(id);
    } else {
      // Have a full Locale object, so optionally substitute aliases and add it
      tag = e.tag;
      id = e.id;
      result.push(entry(e.id, resolve ? substituteAliases(e.tag) : e.tag));
      continue;
    }

    // This code preserves the 'und' undefined locale. If we resolve it, adding
    // likely subtags will expand it to 'en-Latn-US'.

    const l = tagHasLanguage(tag);
    const s = tagHasScript(tag);
    const r = tagHasRegion(tag);

    if (l && s && r) {
      // If all subtags are present, substitute aliases
      result.push(entry(id, resolve ? substituteAliases(tag) : tag));
    } else if (l || s || r) {
      // If at least one subtag is present, resolve
      result.push(entry(id, resolve ? resolveLanguageTag(tag) : tag));
    } else {
      // Preserve undefined core fields, but include input's extensions
      result.push(entry(id, languageTag(U, U, U, U, tagExtensions(tag), tagPrivateUse(tag))));
    }
  }
  return result;
};

/**
 * A result returned by matchLocale.
 *
 * @public
 */
export interface LocaleMatch {
  /**
   * The locale that was matched.
   */
  locale: Locale;

  /**
   * Distance of the match from the desired locale.
   */
  distance: number;
}

/**
 * Options for createLocaleMatcher.
 *
 * @public
 */
export interface LocaleMatcherOptions {
  /**
   * Resolve language tags. (default true)
   */
  resolve?: boolean;
}

/**
 * Sort the supported locale entries. The result will have the following order:
 *
 *  First: default locale
 *   Next: all paradigm locales
 *   Last: all other locales
 *
 * Visible for testing.
 */
export const sortEntries =
  (d: LocaleMatcherEntry) =>
  (a: LocaleMatcherEntry, b: LocaleMatcherEntry): number => {
    // Check if entry is our default tag, to keep it at the front of the array.
    if (a.tag === d.tag) {
      return -1;
    }
    if (b.tag === d.tag) {
      return 1;
    }

    // Sort all paradigm locales before non-paradigms.
    const pa = paradigmLocales[a.compact];
    const pb = paradigmLocales[b.compact];
    if (pa !== undefined) {
      return pb === U ? -1 : numberCmp(pa, pb);
    } else if (pb !== undefined) {
      return 1;
    }

    // All other locales stay in their relative positions.
    return 0;
  };

/**
 * Locale matcher created by `createLocaleMatcher`. Plain readonly data;
 * pass it to `matchLocale`.
 *
 * @public
 */
export interface LocaleMatcher {
  /**
   * Supported locales, sorted: default first, then paradigm locales, then all others.
   */
  readonly supported: readonly LocaleMatcherEntry[];

  /**
   * The default locale, i.e. the first supported locale given.
   */
  readonly defaultEntry: LocaleMatcherEntry;

  /**
   * Supported locales keyed by compact tag, for quick exact-match lookups.
   */
  readonly exactMap: { readonly [x: string]: readonly LocaleMatcherEntry[] };
}

/**
 * Create a matcher for the given list of supported locales. Use `matchLocale`
 * to find the supported locale closest to a user's desired locales. The first
 * locale in the list will be used as the default. The default will be selected
 * if no match is within the distance threshold.
 *
 * Implementation of CLDR enhanced language matching:
 * http://www.unicode.org/reports/tr35/tr35.html#EnhancedLanguageMatching
 *
 * @public
 */
export const createLocaleMatcher = (
  supportedLocales: string | (Locale | LanguageTag | string)[],
  options: LocaleMatcherOptions = {},
): LocaleMatcher => {
  const supported = parse(supportedLocales, options);
  if (!supported.length) {
    throw new Error('LocaleMatcher expects at least one supported locale');
  }

  // The first locale in the list is used as the default.
  const defaultEntry = supported[0];
  supported.sort(sortEntries(defaultEntry));

  // Wire up a map for quick lookups of exact matches. These have a
  // distance of 0 and will short-circuit the matching loop.
  const exactMap: { [x: string]: LocaleMatcherEntry[] } = {};
  supported.forEach((locale) => {
    const key = locale.compact;
    const entries = exactMap[key];
    if (entries === U) {
      exactMap[key] = [locale];
    } else {
      entries.push(locale);
    }
  });

  return { supported, defaultEntry, exactMap };
};

/**
 * Find the desired locale that is the closest match to a supported locale, within
 * the given threshold. Any matches whose distance is greater than or equal to the
 * threshold will be treated as having maximum distance.
 *
 * @public
 */
export const matchLocale = (
  matcher: LocaleMatcher,
  desiredLocales: string | string[],
  threshold: number = DEFAULT_THRESHOLD,
): LocaleMatch => {
  const { supported: supportedEntries, defaultEntry, exactMap } = matcher;
  const count = supportedEntries.length;
  const desireds = parse(desiredLocales);
  const len = desireds.length;
  let bestDistance = MAX_DISTANCE;
  let bestMatch: LocaleMatcherEntry | undefined;
  let bestDesired = len === 0 ? defaultEntry : desireds[0];
  for (let i = 0; i < len; i++) {
    const desired = desireds[i];

    // Short-circuit if we find an exact match
    const exact = exactMap[desired.compact];
    if (exact !== undefined) {
      bestMatch = exact[0];
      bestDistance = 0;
      bestDesired = desired;
      break;
    }

    for (let j = 0; j < count; j++) {
      const supported = supportedEntries[j];
      const distance = getDistance(desired.tag, supported.tag, threshold);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = supported;
        bestDesired = desired;
      }
    }
  }

  const extensions = tagExtensions(bestDesired.tag);
  const privateUse = tagPrivateUse(bestDesired.tag);
  const { id, tag } = bestMatch === U ? defaultEntry : bestMatch;
  const result = languageTag(
    tagLanguage(tag),
    tagScript(tag),
    tagRegion(tag),
    tagVariant(tag),
    extensions,
    privateUse,
  );
  return {
    locale: { id, tag: result },
    distance: bestMatch === U ? MAX_DISTANCE : bestDistance,
  };
};
