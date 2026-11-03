import * as subtags from './autogen.subtags';
import { type LanguageTag, languageTag } from './languagetag';
import { replaceRegion, stringToObject } from './util';

// Subtag separator
const SEP = '-';
const UNDERSCORE = /_/g;

// ISO 639 language code
const LANGUAGE = /^[a-z]{2,8}$/i;

// Selected ISO 639 codes
const EXTLANG = /^[a-z]{3}$/i;

// ISO 15924 script code
const SCRIPT = /^[a-z]{4}$/i;

// ISO 3166-1 or UN M.49 code
const REGION = /^([a-z]{2,3}|\d{3})$/i;

// Registered variants
const VARIANT = /^([a-z\d]{5,8}|\d[a-z\d]{3})$/i;

const EXTENSION_PREFIX = /^[\da-wyz]$/i;
const EXTENSION_SUBTAG = /^[\da-z]{2,8}$/i;
const PRIVATEUSE_PREFIX = /^x$/i;
const PRIVATEUSE_SUBTAG = /^[\da-z]{1,8}$/i;

// https://www.unicode.org/reports/tr35/tr35-33/tr35.html#Key_And_Type_Definitions_
const UNICODE_EXTENSION_KEYS: Set<string> = /*#__PURE__*/ new Set([
  'ca', // calendar
  'co', // collation
  'cu', // currency
  'nu', // numbering system
  'tz', // timezone
  'va', // common variant type
]);

// Grandfathered irregular and regular tags from IANA registry.
let GRANDFATHERED_TAGS: { [x: string]: string } | undefined;

const init = () => {
  GRANDFATHERED_TAGS = {
    ...stringToObject(subtags.grandfatheredRaw, '|', ':'),

    // Additional fallbacks from ICU
    'cel-gaulish': 'xtg-x-cel-gaulish',
    'en-GB-oed': 'en-GB-x-oed',
    'i-default': 'en-x-i-default',
    'i-enochian': 'und-x-i-enochian',
    'i-mingo': 'see-x-i-mingo',
    'zh-min': 'nan-x-zh-min',
  };
};

/**
 * Match the first element of the parts array against the given pattern.
 * Shifts the first element and returns the match, or returns null.
 */
const match = (parts: string[], pattern: RegExp): string | undefined => {
  if (parts.length > 0) {
    const m = parts[0].match(pattern);
    if (m !== null) {
      parts.shift();
      return m[0];
    }
  }
  return undefined;
};

const parseExtLangs = (parts: string[], extlangs: string[]): void => {
  while (parts.length !== 0) {
    const result = match(parts, EXTLANG);
    if (!result) {
      break;
    }
    extlangs.push(result);
  }
};

const parseVariants = (parts: string[], variants: string[]): void => {
  while (parts.length > 0) {
    const result = match(parts, VARIANT);
    if (!result) {
      break;
    }
    variants.push(result);
  }
};

const parseExtensions = (parts: string[], extensions: { [x: string]: string[] }): void => {
  while (parts.length > 0) {
    const prefix = match(parts, EXTENSION_PREFIX);
    if (!prefix) {
      break;
    }

    const subs: string[] = [];
    let temp = '';
    while (parts.length > 0) {
      const subtag = match(parts, EXTENSION_SUBTAG);
      if (!subtag) {
        break;
      }

      if (!UNICODE_EXTENSION_KEYS.has(subtag)) {
        temp += temp ? SEP + subtag : subtag;
        continue;
      }

      if (temp) {
        subs.push(temp);
      }
      temp = subtag;
    }

    if (temp) {
      subs.push(temp);
    }

    if (subs.length > 0) {
      subs.sort();
      let curr = extensions[prefix];
      curr = curr === undefined ? subs : curr.concat(subs);
      extensions[prefix] = curr.sort();
    }
  }
};

const parsePrivateUse = (parts: string[]): string => {
  let privateUse = '';
  while (parts.length > 0) {
    const prefix = match(parts, PRIVATEUSE_PREFIX);
    if (!prefix) {
      break;
    }
    const subs = [];
    while (parts.length > 0) {
      const subtag = match(parts, PRIVATEUSE_SUBTAG);
      if (!subtag) {
        break;
      }
      subs.push(subtag);
    }

    if (subs.length > 0) {
      privateUse += `${prefix}${SEP}${subs.join(SEP)}`;
    }
  }
  return privateUse;
};

/**
 * Low-level parsing of a language tag. No resolution is performed.
 *
 * @public
 */
export const parseLanguageTag = (str: string): LanguageTag => {
  if (!GRANDFATHERED_TAGS) {
    init();
  }
  str = str.indexOf('_') === -1 ? str : str.replace(UNDERSCORE, SEP);
  const preferred = GRANDFATHERED_TAGS![str.toLowerCase()];
  const parts = typeof preferred === 'string' ? preferred.split(SEP) : str.split(SEP);

  let script: string | undefined;
  let region: string | undefined;
  const extlangs: string[] = [];
  const variants: string[] = [];
  const extensions: { [x: string]: string[] } = {};

  const language = match(parts, LANGUAGE);
  if (language) {
    if (language.length <= 3) {
      parseExtLangs(parts, extlangs);
    }
    script = match(parts, SCRIPT);
    region = match(parts, REGION);
    parseVariants(parts, variants);
    parseExtensions(parts, extensions);
  }
  const privateUse = parsePrivateUse(parts);

  // If no region was parsed, check if one of the extlangs is actually a valid ISO 3166
  if (!region) {
    for (let i = 0; i < extlangs.length; i++) {
      const replacement = replaceRegion(extlangs[i].toUpperCase());
      if (replacement) {
        region = replacement;
        // Ignore the extlangs since we currently don't add them to the LanguageTag.
        break;
      }
    }
  }

  return languageTag(
    language,
    script,
    region,
    variants.length === 0 ? undefined : variants[0],
    extensions,
    privateUse,
    extlangs,
  );
};
