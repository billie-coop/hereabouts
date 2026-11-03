import type {
  AltType,
  CharacterOrderType,
  ContextType,
  LineOrderType,
  Vector2Arrow,
} from '@phensley/cldr-types';
import type { Part } from '@phensley/decimal';
import {
  type LanguageTag,
  parseLanguageTag,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagRegion,
  tagScript,
} from '@phensley/language-tag';
import {
  createMessageFormatter,
  type MessageFormatter,
  type MessageFormatterOptions,
} from '@phensley/messageformat';
import type {
  DisplayNameOptions,
  ListPatternType,
  MeasurementCategory,
  MeasurementSystem,
} from '../common/general';
import { resolveLocale } from '../framework';
import { contextTransform, formatListValue } from '../internals/general/internal';
import type { LocaleData } from '../locale-data';
import { fieldGet, vectorGet } from '../schema/schema/arrows';
import { partsValue, stringValue } from '../utils/render';
import { getContextTransformInfo } from './private/api';

const DEFAULT_NAME_OPTIONS: DisplayNameOptions = { context: 'begin-sentence' };

// Compound fields for language display name
type LanguageTagFunc = (t: LanguageTag) => string;

const F_LANG_REGION = (t: LanguageTag): string => `${tagLanguage(t)}-${tagRegion(t)}`;
const F_LANG_SCRIPT = (t: LanguageTag): string => `${tagLanguage(t)}-${tagScript(t)}`;

const LANGUAGE_FUNCS: LanguageTagFunc[] = [
  F_LANG_REGION,
  F_LANG_SCRIPT,
  (t: LanguageTag): string => tagLanguage(t),
];

/**
 * Returns the character order for the current locale, e.g. "ltr" for left-to-right
 * or "rtl" for right-to-left.
 *
 * @public
 */
export const characterOrder = (data: LocaleData): CharacterOrderType =>
  fieldGet(data.schema.Layout.characterOrder, data) as CharacterOrderType;

/**
 * Returns the line order for the current locale, e.g. "ttb" for top-to-bottom
 * or "btt" for bottom-to-top.
 *
 * @public
 */
export const lineOrder = (data: LocaleData): LineOrderType =>
  fieldGet(data.schema.Layout.lineOrder, data) as LineOrderType;

// One default message formatter per locale, so its parsed-message cache is shared by every
// caller instead of starting empty on each call.
const DEFAULT_FORMATTERS = /*#__PURE__*/ new WeakMap<LocaleData, MessageFormatter>();

/**
 * A message formatter that uses the locale's plural rules. Without options the same formatter
 * (and its cache of parsed messages) is returned for every call with this locale data, so
 * `formatMessage(messageFormatter(locale), ...)` in a hot path doesn't re-parse. With options a
 * new formatter is created; keep it if you call it often.
 *
 * For an app's own text in several languages, see `createTranslator` / `translate`.
 *
 * @public
 */
export const messageFormatter = (
  data: LocaleData,
  options?: MessageFormatterOptions,
): MessageFormatter => {
  if (options) {
    return createMessageFormatter({ ...options, plurals: data.plurals });
  }
  let f = DEFAULT_FORMATTERS.get(data);
  if (!f) {
    f = createMessageFormatter({ plurals: data.plurals });
    DEFAULT_FORMATTERS.set(data, f);
  }
  return f;
};

/**
 * Returns the measurement system in use for the current locale generally,
 * or for a specific measurement category.
 *
 * @public
 */
export const measurementSystem = (
  data: LocaleData,
  category?: MeasurementCategory,
): MeasurementSystem => {
  const region = data.region;
  switch (category) {
    case 'temperature':
      switch (region) {
        case 'BS':
        case 'BZ':
        case 'PR':
        case 'PW':
          return 'us';
        default:
          return 'metric';
      }

    default:
      switch (region) {
        case 'GB':
          return 'uk';
        case 'LR':
        case 'MM':
        case 'US':
          return 'us';
        default:
          return 'metric';
      }
  }
};

/**
 * Format a list of items to string using the given list type.
 *
 * @public
 */
export const formatList = (data: LocaleData, items: string[], type?: ListPatternType): string =>
  formatListValue(data, stringValue(), items, type || 'and');

/**
 * Format a list of items to an array of parts using the given list type.
 *
 * @public
 */
export const formatListToParts = (
  data: LocaleData,
  items: string[],
  type?: ListPatternType,
): Part[] => {
  const parts: Part[][] = items.map((i) => [{ type: 'item', value: i }]);
  return formatListValue(data, partsValue(), parts, type || 'and');
};

/**
 * Returns the display name of the given language code or language tag.
 *
 * @public
 */
export const getLanguageDisplayName = (
  data: LocaleData,
  code: string | LanguageTag,
  options: DisplayNameOptions = DEFAULT_NAME_OPTIONS,
): string => {
  const type = options.type || 'none';
  const arrow = data.schema.Names.languages.displayName;

  let tag: LanguageTag = typeof code === 'string' ? parseLanguageTag(code) : code;
  let s: string = '';

  // First attempt to match the exact string
  if (typeof code === 'string') {
    s = getVectorAlt(data, arrow, code, type);
  }
  // Try language + region
  if (!s && tagHasLanguage(tag) && tagHasRegion(tag)) {
    s = getVectorAlt(data, arrow, F_LANG_REGION(tag), type);
  }
  // Try language + script
  if (!s && tagHasLanguage(tag) && tagHasScript(tag)) {
    s = getVectorAlt(data, arrow, F_LANG_SCRIPT(tag), type);
  }
  // Try language if script and region are empty
  if (!s && !tagHasScript(tag) && !tagHasRegion(tag)) {
    s = getVectorAlt(data, arrow, tagLanguage(tag), type);
  }

  // Resolve to fill in unknown subtags, then attempt combinations
  if (!s) {
    const locale = resolveLocale(tag);
    tag = locale.tag;
    for (const func of LANGUAGE_FUNCS) {
      const id = func(tag);
      s = getVectorAlt(data, arrow, id, type);
      if (s) {
        // Found one
        break;
      }
    }
  }
  return contextTransform(s, getContextTransformInfo(data), _ctx(options), 'languages');
};

/**
 * Returns the display name of the given script code or the script of the language tag.
 *
 * @public
 */
export const getScriptDisplayName = (
  data: LocaleData,
  code: string | LanguageTag,
  options: DisplayNameOptions = DEFAULT_NAME_OPTIONS,
): string => {
  const arrow = data.schema.Names.scripts.displayName;
  const type = options.type || 'none';
  let s: string = '';
  if (typeof code === 'string') {
    s = getVectorAlt(data, arrow, code, type);

    // If language is blank or we have an explicit script subtag, use the
    // script subtag as-is. This will resolve "und-Zzzz" to "Unknown" but
    // "en-Zzzz" will fall through to resolve "Latin"
  } else if (!tagHasLanguage(code) || tagHasScript(code)) {
    s = getVectorAlt(data, arrow, tagScript(code), type);
  }
  if (!s) {
    // Resolve to populate the script
    const locale = resolveLocale(code);
    s = getVectorAlt(data, arrow, tagScript(locale.tag), type);
  }
  return contextTransform(s, getContextTransformInfo(data), _ctx(options), 'script');
};

/**
 * Returns the display name of the given region code or the region of the language tag.
 *
 * @public
 */
export const getRegionDisplayName = (
  data: LocaleData,
  code: string | LanguageTag,
  options: DisplayNameOptions = DEFAULT_NAME_OPTIONS,
): string => {
  const arrow = data.schema.Names.regions.displayName;
  const type = options.type || 'none';
  let s: string = '';
  if (typeof code === 'string') {
    s = getVectorAlt(data, arrow, code, type);

    // If language is blank or we have an explicit region subtag, use
    // the region subtag as-is. This will resolve "und-ZZ" to "Unknown" but
    // "en-Zzzz" will fall through to resolve "United States"
  } else if (!tagHasLanguage(code) || tagHasRegion(code)) {
    s = getVectorAlt(data, arrow, tagRegion(code), type);
  }
  if (!s) {
    // Resolve to populate the region
    const { tag } = resolveLocale(code);
    s = getVectorAlt(data, arrow, tagRegion(tag), type);
  }
  // No context transform for region
  return s;
};

// Check if the given alt type field exists, and fall back to alt type 'none'
const getVectorAlt = <T extends string>(
  data: LocaleData,
  arrow: Vector2Arrow<AltType, T>,
  code: string,
  type: AltType,
): string =>
  vectorGet(arrow, data, type, code as unknown as T) ||
  vectorGet(arrow, data, 'none', code as unknown as T);

// Default an options context value
const _ctx = (o: DisplayNameOptions): ContextType =>
  _def(o, 'context', 'begin-sentence' as ContextType);

// Default an option value
const _def = <O, K extends keyof O, T>(o: O, k: K, t: T): T => (o[k] as unknown as T) || t;
