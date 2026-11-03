import {
  type LanguageTag,
  languageTag,
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
} from '../../language-tag';
import { resolveLanguageTag } from '../../locale';
import { numarray } from '../utils/string';
import { type Bundle, type ExceptionIndex, stringBundle } from './bundle';

const enum Chars {
  // Fields in a resource pack are separated by an UNDERSCORE character
  DELIM = '_',
}
const U = undefined;

/**
 * Layer in the pack that supports all regions for a single language + script. Region exception
 * indices are decoded on first use and cached in `cache`.
 *
 * @public
 */
export interface PackScript {
  readonly strings: readonly string[];
  readonly exceptions: readonly string[];
  readonly regions: { readonly [x: string]: string };
  readonly defaultRegion: string;
  readonly spellout: any;
  readonly cache: { [x: string]: ExceptionIndex };
}

/**
 * Runtime resource pack: all scripts and regions for one language. Plain data, built by
 * `loadPack()` from the JSON resource pack.
 *
 * @public
 */
export interface Pack {
  readonly version: string;
  readonly cldrVersion: string;
  readonly checksum: string;
  readonly language: string;
  readonly defaultTag: LanguageTag;
  readonly scripts: { readonly [x: string]: PackScript };
  readonly spellout: any;
}

const packScript = (
  strings: string,
  exceptions: string,
  regions: { [x: string]: string },
  defaultRegion: string,
  spellout: any,
): PackScript => ({
  strings: strings.split(Chars.DELIM),
  exceptions: exceptions.split(Chars.DELIM),
  regions,
  defaultRegion,
  spellout,
  cache: {},
});

const decodeRegion = (script: PackScript, region: string): ExceptionIndex | undefined => {
  const raw = script.regions[region];
  if (raw === U) {
    return U;
  }

  const decoded = numarray(raw, 36);
  const index: { [y: number]: number } = {};
  for (let i = 0; i < decoded.length; i += 2) {
    const k = decoded[i];
    const v = decoded[i + 1];
    index[k] = v;
  }
  script.cache[region] = index;
  return index;
};

const packScriptGet = (script: PackScript, tag: LanguageTag): Bundle => {
  let region = tagRegion(tag);
  let index = script.cache[region] || decodeRegion(script, region);
  if (index === U) {
    region = script.defaultRegion;
    tag = languageTag(
      tagLanguage(tag),
      tagScript(tag),
      region,
      tagVariant(tag),
      tagExtensions(tag),
      tagPrivateUse(tag),
    );
    index = script.cache[region] || decodeRegion(script, region);
  }
  return stringBundle(
    tagCompact(tag),
    tag,
    script.strings,
    script.exceptions,
    index,
    script.spellout,
  );
};

/**
 * Parse a resource pack (JSON string or already-parsed object).
 *
 * @public
 */
export const loadPack = (data: string | any): Pack => {
  const raw: any = typeof data === 'string' ? JSON.parse(data) : data;
  const { version, cldr, checksum, language, spellout } = raw;
  if (version === U) {
    throw new Error('Severe error: data does not look like a valid resource pack.');
  }

  const scripts: { [x: string]: PackScript } = {};
  Object.keys(raw.scripts).forEach((k) => {
    const obj = raw.scripts[k];
    scripts[k] = packScript(obj.strings, obj.exceptions, obj.regions, obj.defaultRegion, spellout);
  });

  return {
    version,
    cldrVersion: cldr,
    checksum,
    language,
    defaultTag: resolveLanguageTag(raw.defaultTag),
    scripts,
    spellout,
  };
};

/**
 * Get the bundle for a language tag from the pack. Falls back to the pack's default script and
 * the script's default region when the tag's are not present.
 *
 * @public
 */
export const packGet = (pack: Pack, tag: LanguageTag): Bundle => {
  // We need the script and region to find the correct string layer. Caller should
  // ideally supply a resolved language tag to avoid the overhead of this call.
  if (!tagHasLanguage(tag) || !tagHasScript(tag) || !tagHasRegion(tag)) {
    tag = resolveLanguageTag(tag);
  }

  // Strings for a language are organized by script.
  let script = pack.scripts[tagScript(tag)];
  if (script === U) {
    // Swap in the default script
    const d = pack.defaultTag;
    tag = languageTag(
      tagLanguage(d),
      tagScript(d),
      tagRegion(d),
      tagVariant(d),
      tagExtensions(tag),
      tagPrivateUse(tag),
    );
    script = pack.scripts[tagScript(tag)];
  }
  return packScriptGet(script, tag);
};
