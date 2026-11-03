/**
 * @public
 */
export enum LanguageTagField {
  LANGUAGE = 0,
  SCRIPT = 1,
  REGION = 2,
  VARIANT = 3,
}

const SEP = '-';

const UNDEFINED_VALUES = ['und', 'Zzzz', 'ZZ', ''];

const KEYS = [
  LanguageTagField.LANGUAGE,
  LanguageTagField.SCRIPT,
  LanguageTagField.REGION,
  LanguageTagField.VARIANT,
];

const TRANSFORMS: ((s: string) => string)[] = [
  (s) => s.toLowerCase(),
  (s) => s[0].toUpperCase() + s.substring(1).toLowerCase(),
  (s) => s.toUpperCase(),
  (s) => s.toLowerCase(),
];

/**
 * Ensure the given field is in canonical form.
 */
const canonicalize = (field: number, value?: string): string | undefined => {
  if (field === LanguageTagField.LANGUAGE && value === 'root') {
    value = undefined;
  } else if (value === UNDEFINED_VALUES[field]) {
    value = undefined;
  }
  if (typeof value === 'string' && value.length > 0) {
    return TRANSFORMS[field](value);
  }
  return undefined;
};

/**
 * IETF BCP 47 language tag. Immutable plain data: create one with
 * `languageTag(...)` or `parseLanguageTag(...)` and read it with the
 * `tag*` functions.
 *
 * The core subtag fields are `undefined` when the subtag is not set; the
 * accessor functions (`tagLanguage`, `tagScript`, `tagRegion`) return the
 * undefined value ('und', 'Zzzz', 'ZZ') in that case.
 *
 * @public
 */
export interface LanguageTag {
  /**
   * Canonical language subtag, or undefined if not set.
   */
  readonly language?: string;

  /**
   * Canonical script subtag, or undefined if not set.
   */
  readonly script?: string;

  /**
   * Canonical region subtag, or undefined if not set.
   */
  readonly region?: string;

  /**
   * Canonical variant subtag, or undefined if not set.
   */
  readonly variant?: string;

  /**
   * Extensions keyed by their single-character prefix, e.g. 'u' or 't'.
   */
  readonly extensions: { readonly [x: string]: readonly string[] };

  /**
   * Private use subtag, e.g. 'x-foo', or empty string.
   */
  readonly privateUse: string;

  /**
   * Extended language subtags, used for BCP 47 canonicalization.
   */
  readonly extlangs: readonly string[];
}

/**
 * Construct a language tag. Core subtags are canonicalized (case, and the
 * undefined values 'und' / 'root' / 'Zzzz' / 'ZZ' / '' are treated as not set).
 *
 * @public
 */
export const languageTag = (
  language?: string,
  script?: string,
  region?: string,
  variant?: string,
  extensions?: { readonly [x: string]: readonly string[] },
  privateUse?: string,
  extlangs?: readonly string[],
): LanguageTag => ({
  language: canonicalize(LanguageTagField.LANGUAGE, language),
  script: canonicalize(LanguageTagField.SCRIPT, script),
  region: canonicalize(LanguageTagField.REGION, region),
  variant: canonicalize(LanguageTagField.VARIANT, variant),
  extensions: extensions || {},
  privateUse: privateUse || '',
  extlangs: extlangs || [],
});

const optString = (s: unknown): boolean => s === undefined || typeof s === 'string';

const isStringArray = (a: unknown): boolean =>
  Array.isArray(a) && a.every((s) => typeof s === 'string');

/**
 * Returns true if the argument has the shape of a language tag: optional string subtags, a
 * private use string, an array of extlang strings and an object of extension subtag arrays.
 *
 * @public
 */
export const isLanguageTag = (x: unknown): x is LanguageTag => {
  if (x === null || typeof x !== 'object') {
    return false;
  }
  const t = x as LanguageTag;
  const ext = t.extensions;
  return (
    optString(t.language) &&
    optString(t.script) &&
    optString(t.region) &&
    optString(t.variant) &&
    typeof t.privateUse === 'string' &&
    isStringArray(t.extlangs) &&
    typeof ext === 'object' &&
    ext !== null &&
    !Array.isArray(ext) &&
    Object.keys(ext).every((k) => isStringArray(ext[k]))
  );
};

/**
 * Language subtag, or 'und' if undefined.
 *
 * @public
 */
export const tagLanguage = (t: LanguageTag): string =>
  t.language || UNDEFINED_VALUES[LanguageTagField.LANGUAGE];

/**
 * Returns true if the language subtag is defined.
 *
 * @public
 */
export const tagHasLanguage = (t: LanguageTag): boolean => t.language !== undefined;

/**
 * Script subtag, or 'Zzzz' if undefined.
 *
 * @public
 */
export const tagScript = (t: LanguageTag): string =>
  t.script || UNDEFINED_VALUES[LanguageTagField.SCRIPT];

/**
 * Returns true if the script subtag is defined.
 *
 * @public
 */
export const tagHasScript = (t: LanguageTag): boolean => t.script !== undefined;

/**
 * Region subtag, or 'ZZ' if undefined.
 *
 * @public
 */
export const tagRegion = (t: LanguageTag): string =>
  t.region || UNDEFINED_VALUES[LanguageTagField.REGION];

/**
 * Returns true if the region subtag is defined.
 *
 * @public
 */
export const tagHasRegion = (t: LanguageTag): boolean => t.region !== undefined;

/**
 * Variant subtag, or '' if undefined.
 *
 * @public
 */
export const tagVariant = (t: LanguageTag): string =>
  t.variant || UNDEFINED_VALUES[LanguageTagField.VARIANT];

/**
 * Return a copy of the language tag's extensions map.
 *
 * @public
 */
export const tagExtensions = (t: LanguageTag): { [x: string]: readonly string[] } => {
  const exts = t.extensions;
  const res: { [x: string]: readonly string[] } = {};
  Object.keys(exts).forEach((k) => {
    res[k] = exts[k];
  });
  return res;
};

/**
 * Return the extensions of the given type. Use 'u' for Unicode
 * and 't' for Transforms.
 *
 * @public
 */
export const tagExtensionSubtags = (t: LanguageTag, key: string): readonly string[] => {
  const exts = t.extensions[key];
  return exts || [];
};

/**
 * Private use subtag.
 *
 * @public
 */
export const tagPrivateUse = (t: LanguageTag): string => t.privateUse;

/**
 * Extended language subtags, used for BCP 47 canonicalization.
 *
 * @public
 */
export const tagExtlangs = (t: LanguageTag): readonly string[] => t.extlangs;

// Rendered strings are cached per tag object, since tags are immutable.
const COMPACT = /*#__PURE__*/ new WeakMap<LanguageTag, string>();
const EXPANDED = /*#__PURE__*/ new WeakMap<LanguageTag, string>();

/**
 * Return a compact string representation of the language tag. Any undefined
 * fields will be omitted.
 *
 * @public
 */
export const tagCompact = (t: LanguageTag): string => {
  let s = COMPACT.get(t);
  if (s === undefined) {
    s = render(t, false);
    COMPACT.set(t, s);
  }
  return s;
};

/**
 * Return an expanded string representation of the language tag. Any undefined
 * fields will emit their undefined value.
 *
 * @public
 */
export const tagExpanded = (t: LanguageTag): string => {
  let s = EXPANDED.get(t);
  if (s === undefined) {
    s = render(t, true);
    EXPANDED.set(t, s);
  }
  return s;
};

/**
 * Return a compact string representation of the language tag. Any undefined
 * fields will be omitted. Same as `tagCompact`.
 *
 * @public
 */
export const tagToString = (t: LanguageTag): string => tagCompact(t);

/**
 * Render a tag in compact or expanded form.
 */
const render = (t: LanguageTag, expanded: boolean): string => {
  const core = [t.language, t.script, t.region, t.variant];
  let buf: string = '';
  KEYS.forEach((key) => {
    const force: boolean =
      key !== LanguageTagField.VARIANT && (key === LanguageTagField.LANGUAGE || expanded);
    const val: string | undefined = core[key];
    if (val !== undefined || force) {
      if (buf.length > 0) {
        buf += SEP;
      }
      buf += val ? val : UNDEFINED_VALUES[key];
    }
  });
  const exts = t.extensions;
  const keys = Object.keys(exts);
  if (keys.length) {
    keys.sort().forEach((k) => {
      const vals = exts[k];
      if (vals !== undefined && vals.length > 0) {
        buf += SEP + k + SEP + exts[k].join(SEP);
      }
    });
  }
  if (t.privateUse.length > 0) {
    buf += SEP + t.privateUse;
  }
  return buf;
};
