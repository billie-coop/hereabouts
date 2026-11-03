import {
  type LanguageTag,
  languageTag,
  parseLanguageTag,
  substituteRegionAliases,
  LanguageTagField as Tag,
  tagExtensions,
  tagPrivateUse,
  tagVariant,
} from '../language-tag';

import { languageAliasRaw } from './autogen.aliases';
import { likelySubtags } from './autogen.subtags';
import { type FastTag, type LanguageAliasMap, stringToObject } from './util';

/**
 * Since a lot of comparisons will be done, we need fast access to
 * core fields of LanguageTag.
 *
 * Visible for testing
 */
export const fastTag = (real: LanguageTag): FastTag => {
  // The fast tag is used for indexing purposes. Since a field may be
  // undefined, and we don't want to use its string representation of
  // the undefined value (e.g. 'und', 'Zzzz', etc), we use the field's
  // index number to represent undefined.
  const fast: FastTag = [
    real.language || Tag.LANGUAGE,
    real.script || Tag.SCRIPT,
    real.region || Tag.REGION,
  ];

  // If an extlang subtag exists, replace the language subtag with the first
  // extlang value.
  const extlangs = real.extlangs;
  if (extlangs && extlangs.length) {
    fast[0] = extlangs[0];
  }
  return fast;
};

const likelyGet = (query: FastTag): FastTag | undefined => {
  const lang = query[Tag.LANGUAGE];
  const n1 = likelySubtags[lang] || {};
  const script = query[Tag.SCRIPT];
  const n2 = n1[script] || {};
  const region = query[Tag.REGION];
  const n3: any = n2[region];
  if (typeof n3 === 'string') {
    // On first access, convert to an array representation
    const p = n3.split('-').map((v, i) => {
      if (!v) {
        return i === 0 ? lang : region;
      }
      if (i === 1) {
        return likelySubtags._[Number(v)];
      }
      return v;
    });
    n2[region] = p;
    return p;
  }
  return n3;
};

// Flags for subtag permutations
const enum F {
  LANGUAGE = 1,
  SCRIPT = 2,
  REGION = 4,
}

const MATCH_ORDER = [
  F.LANGUAGE | F.SCRIPT | F.REGION,
  F.LANGUAGE | F.REGION,
  F.LANGUAGE | F.SCRIPT,
  F.LANGUAGE,
  F.SCRIPT,
];

/**
 * Clear or copy fields from src to dst depending on flags.
 */
const setFields = (src: FastTag, dst: FastTag, flags: number): void => {
  dst[Tag.LANGUAGE] = (flags & F.LANGUAGE) === 0 ? Tag.LANGUAGE : src[Tag.LANGUAGE];
  dst[Tag.SCRIPT] = (flags & F.SCRIPT) === 0 ? Tag.SCRIPT : src[Tag.SCRIPT];
  dst[Tag.REGION] = (flags & F.REGION) === 0 ? Tag.REGION : src[Tag.REGION];
};

/**
 * Lookup any aliases that match this tag, and replace any undefined subtags.
 */
const substituteLanguageAliases = (dst: FastTag): void => {
  if (!LANGUAGE_ALIAS_MAP) {
    initAlias();
  }
  const aliases = LANGUAGE_ALIAS_MAP![dst[Tag.LANGUAGE]];
  if (aliases === undefined) {
    return;
  }
  for (let i = 0; i < aliases.length; i++) {
    const [type, repl] = aliases[i];
    const exact =
      type[Tag.LANGUAGE] === dst[Tag.LANGUAGE] &&
      type[Tag.SCRIPT] === dst[Tag.SCRIPT] &&
      type[Tag.REGION] === dst[Tag.REGION];

    if ((type[Tag.SCRIPT] === Tag.SCRIPT && type[Tag.REGION] === Tag.REGION) || exact) {
      dst[Tag.LANGUAGE] = repl[Tag.LANGUAGE];
      if (dst[Tag.SCRIPT] === Tag.SCRIPT) {
        dst[Tag.SCRIPT] = repl[Tag.SCRIPT];
      }
      if (dst[Tag.REGION] === Tag.REGION) {
        dst[Tag.REGION] = repl[Tag.REGION];
      }
      break;
    }
  }
};

/**
 * Add any missing subtags using the likely subtags mapping. For example,
 * this would convert "en" to "en-Latn-US".
 */
const addLikelySubtagsFast = (dst: FastTag): void => {
  const tmp = dst.slice(0);
  for (let i = 0; i < MATCH_ORDER.length; i++) {
    const flags = MATCH_ORDER[i];
    setFields(dst, tmp, flags);
    const match = likelyGet(tmp);
    if (match !== undefined) {
      if (dst[Tag.LANGUAGE] === Tag.LANGUAGE) {
        dst[Tag.LANGUAGE] = match[Tag.LANGUAGE];
      }
      if (dst[Tag.SCRIPT] === Tag.SCRIPT) {
        dst[Tag.SCRIPT] = match[Tag.SCRIPT];
      }
      if (dst[Tag.REGION] === Tag.REGION) {
        dst[Tag.REGION] = match[Tag.REGION];
      }
      break;
    }
  }
};

/**
 * Return a language tag, combining the fast tag's core subtags with the
 * original's additional subtags.
 *
 * Visible for testing
 */
export const returnTag = (real: LanguageTag, fast: FastTag): LanguageTag => {
  const language = fast[Tag.LANGUAGE];
  const script = fast[Tag.SCRIPT];
  const region = fast[Tag.REGION];

  return languageTag(
    typeof language === 'number' ? undefined : language,
    typeof script === 'number' ? undefined : script,
    typeof region === 'number' ? undefined : region,
    tagVariant(real),
    tagExtensions(real),
    tagPrivateUse(real),
  );
};

// Undefined tag to be copied for use in resolution below.
const UNDEFINED: FastTag = [Tag.LANGUAGE, Tag.SCRIPT, Tag.REGION];

/**
 * Compare two fast tags for equality. These always have identical length.
 */
const fastTagEquals = (a: FastTag, b: FastTag): boolean => {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

const parseFastTag = (s: string) => {
  const p = s.split('-');
  const r: FastTag = [0, 1, 2];
  for (let i = 0; i < 3; i++) {
    if (p[i]) {
      r[i] = p[i];
    }
  }
  return r as FastTag;
};

const buildLanguageAliasMap = (): LanguageAliasMap => {
  const languageAlias = stringToObject(languageAliasRaw, '|', ':');
  return Object.keys(languageAlias).reduce((o: LanguageAliasMap, k) => {
    const type = parseFastTag(k);
    const repl = parseFastTag(languageAlias[k]);
    const language = type[Tag.LANGUAGE];
    let aliases = o[language];
    if (aliases === undefined) {
      aliases = [];
      o[language] = aliases;
    }
    aliases.push([type, repl]);
    return o;
  }, {});
};

// Singleton maps.
let LANGUAGE_ALIAS_MAP: LanguageAliasMap | undefined;

const initAlias = () => {
  LANGUAGE_ALIAS_MAP = buildLanguageAliasMap();
};

const toTag = (real: string | LanguageTag): LanguageTag =>
  typeof real === 'string' ? parseLanguageTag(real) : real;

/**
 * Substitute language and region aliases only.
 *
 * @public
 */
export const substituteAliases = (real: string | LanguageTag): LanguageTag => {
  const tag = toTag(real);
  const fast = fastTag(tag);
  substituteLanguageAliases(fast);
  substituteRegionAliases(fast);
  return returnTag(tag, fast);
};

/**
 * Substitute all relevant aliases, and then add likely subtags.
 *
 * @public
 */
export const resolveLanguageTag = (real: string | LanguageTag): LanguageTag => {
  const tag = toTag(real);
  const fast = fastTag(tag);
  // TODO: add flags to determine which operations to perform.
  substituteLanguageAliases(fast);
  substituteRegionAliases(fast);
  addLikelySubtagsFast(fast);
  return returnTag(tag, fast);
};

/**
 * Add any missing subtags using the likely subtags mapping. For example,
 * this would convert "en" to "en-Latn-US".
 *
 * @public
 */
export const addLikelySubtags = (real: string | LanguageTag): LanguageTag => {
  const tag = toTag(real);
  const fast = fastTag(tag);
  addLikelySubtagsFast(fast);
  return returnTag(tag, fast);
};

/**
 * Remove any subtags that would be added by addLikelySubtags() above. For example,
 * this would convert "en-Latn-US" to "en".
 *
 * @public
 */
export const removeLikelySubtags = (real: string | LanguageTag): LanguageTag => {
  const tag = toTag(real);
  const max = fastTag(tag);
  if (
    max[Tag.LANGUAGE] === Tag.LANGUAGE ||
    max[Tag.SCRIPT] === Tag.SCRIPT ||
    max[Tag.REGION] === Tag.REGION
  ) {
    addLikelySubtagsFast(max);
  }
  const tmp = UNDEFINED.slice(0);

  // Using "en-Latn-US" as an example...
  // 1. Match "en-Zzzz-ZZ"
  tmp[Tag.LANGUAGE] = max[Tag.LANGUAGE];
  let match = tmp.slice(0);
  addLikelySubtagsFast(match);
  if (fastTagEquals(match, max)) {
    return returnTag(tag, tmp);
  }

  // 2. Match "en-Zzzz-US"
  tmp[Tag.REGION] = max[Tag.REGION];
  match = tmp.slice(0);
  addLikelySubtagsFast(match);
  if (fastTagEquals(match, max)) {
    tmp[Tag.LANGUAGE] = max[Tag.LANGUAGE];
    return returnTag(tag, tmp);
  }

  // 3. Match "en-Latn-ZZ"
  tmp[Tag.REGION] = Tag.REGION;
  tmp[Tag.SCRIPT] = max[Tag.SCRIPT];
  match = tmp.slice(0);
  addLikelySubtagsFast(match);
  if (fastTagEquals(match, max)) {
    return returnTag(tag, tmp);
  }

  // 4. Nothing matched, so return a copy of the original tag.
  return returnTag(tag, max);
};
