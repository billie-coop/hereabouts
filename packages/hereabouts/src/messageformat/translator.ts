import { getPluralRules, type PluralRules } from '../plurals';
import {
  evaluateMessage,
  type MessageArg,
  type MessageFormatFuncMap,
  type MessageNamedArgs,
} from './evaluation';
import { defaultMessageArgConverter, type MessageArgConverter } from './evaluation/converter';
import {
  type ApostropheMode,
  buildMessageMatcher,
  type MessageCode,
  type MessageMatcher,
  MessageOpType,
  parseMessagePattern,
} from './parser';

/**
 * Translating an app's text with message catalogs.
 *
 * The app keeps its messages in a source catalog, an object from message key to ICU message
 * pattern in the source language (often the key is the English text itself), and one catalog
 * per translated language with the same keys:
 *
 * ```ts
 * export const en = {
 *   'Save changes?': 'Save changes?',
 *   '{count} invoices': '{count, plural, one {# invoice} other {# invoices}}',
 * };
 * export const de: MessageCatalog<keyof typeof en> = {
 *   'Save changes?': 'Änderungen speichern?',
 *   '{count} invoices': '{count, plural, one {# Rechnung} other {# Rechnungen}}',
 * };
 *
 * const translator = createTranslator({ source: en, catalogs: { de } });
 * translate(translator, 'de-AT', '{count} invoices', { count: 3 }); // "3 Rechnungen"
 * translate(translator, 'de', 'Save chnages?');           // compile error: no such key
 * translate(translator, 'de', '{count} invoices');        // compile error: count is missing
 * ```
 *
 * Use `checkCatalogs(translator)` in a test to catch missing or extra keys, placeholders that
 * differ from the source, and messages that don't parse.
 */

/**
 * A translated catalog: some or all of the source catalog's keys, each with a message in the
 * catalog's language.
 *
 * @public
 */
export type MessageCatalog<K extends string = string> = { readonly [P in K]?: string };

/**
 * Options for {@link createTranslator}.
 *
 * @public
 */
export interface TranslatorOptions<S extends Record<string, string>> {
  /** Messages in the source language, by key. Its keys are the keys `translate` accepts. */
  source: S;

  /** Language of the source messages, for their plural rules. Default 'en'. */
  sourceLanguage?: string;

  /**
   * Translated catalogs by language or locale id: 'de', 'pt', 'pt-PT', 'zh-Hant'. A message
   * missing from a catalog falls back to the less specific catalog ('pt-PT' to 'pt'), then
   * to the source.
   */
  catalogs?: { readonly [language: string]: MessageCatalog<keyof S & string> | undefined };

  /** Custom formatters for `{arg, name}` placeholders, as for `createMessageFormatter`. */
  formatters?: MessageFormatFuncMap;

  /** Converts arguments for plural / select, as for `createMessageFormatter`. */
  converter?: MessageArgConverter;

  /**
   * How apostrophes quote text. Default 'double-optional' (ICU's default), so translations can
   * contain apostrophes (`Here's {name}`, `l'{item}`) without escaping.
   */
  apostropheMode?: ApostropheMode;
}

/**
 * A translator: the catalogs plus caches of parsed messages and plural rules, shared by every
 * `translate` call. Create one per app (or per set of catalogs) and keep it.
 *
 * @public
 */
export interface Translator<S extends Record<string, string> = Record<string, string>> {
  readonly source: S;
  readonly sourceLanguage: string;
  readonly catalogs: { readonly [language: string]: MessageCatalog<keyof S & string> | undefined };
  /** @internal */
  readonly state: TranslatorState;
}

/**
 * Parse and plural-rule caches. Patterns come from the catalogs, so the parse cache is bounded
 * by their size.
 *
 * @internal
 */
export interface TranslatorState {
  readonly formatters: MessageFormatFuncMap;
  readonly converter: MessageArgConverter;
  readonly matcher: MessageMatcher;
  readonly apostropheMode: ApostropheMode;
  readonly parsed: Map<string, MessageCode>;
  readonly plurals: Map<string, PluralRules>;
}

/**
 * Create a translator for a source catalog and its translations. See {@link translate}.
 *
 * @public
 */
export const createTranslator = <S extends Record<string, string>>(
  options: TranslatorOptions<S>,
): Translator<S> => {
  const formatters = options.formatters || {};
  return {
    source: options.source,
    sourceLanguage: options.sourceLanguage || 'en',
    catalogs: options.catalogs || {},
    state: {
      formatters,
      converter: options.converter || defaultMessageArgConverter,
      matcher: buildMessageMatcher(Object.keys(formatters)),
      apostropheMode: options.apostropheMode || 'double-optional',
      parsed: new Map(),
      plurals: new Map(),
    },
  };
};

// ---------------------------------------------------------------------------------------------
// Types: the placeholders of a message, read from its pattern at compile time.

type Trim<S extends string> = S extends ` ${infer R}`
  ? Trim<R>
  : S extends `${infer R} `
    ? Trim<R>
    : S;

type Pop<D extends unknown[]> = D extends [...infer R, unknown] ? R : [];

/** The argument name right after a `{`: up to the first `,` or `}`. */
type NameAt<S extends string> = S extends `${infer N}}${string}`
  ? N extends `${infer M},${string}`
    ? Trim<M>
    : Trim<N>
  : never;

/** Only names that look like argument names (`count`, `customer_name`, `0`). */
type ArgName<N extends string> = N extends '' | `${string}${' ' | '#' | '{' | "'"}${string}`
  ? never
  : N;

/**
 * Walk the braces of a pattern. Arguments open at even depths (0 for `{count, plural, ...}`,
 * 2 for a `{customer}` inside one of its branches); odd depths open plural / select branches.
 */
type Walk<
  S extends string,
  D extends unknown[] = [],
  Acc extends string = never,
> = S extends `${infer Pre}{${infer Post}`
  ? Pre extends `${string}}${string}`
    ? S extends `${string}}${infer Rest}`
      ? Walk<Rest, Pop<D>, Acc>
      : Acc
    : Walk<
        Post,
        [...D, 0],
        D['length'] extends 0 | 2 | 4 | 6 | 8 ? Acc | ArgName<NameAt<Post>> : Acc
      >
  : S extends `${string}}${infer Rest}`
    ? Walk<Rest, Pop<D>, Acc>
    : Acc;

/**
 * The argument names in an ICU message pattern, as a union of string literals:
 * `MessageArgNames<'{count, plural, one {# for {customer}} other {...}}'>` is
 * `'count' | 'customer'`. `never` if the pattern has none, or isn't a literal type.
 *
 * @public
 */
export type MessageArgNames<P extends string> = string extends P ? never : Walk<P>;

/**
 * The pattern whose placeholders a key's arguments must match: the source message if its type
 * is a literal (`as const` catalogs), otherwise the key itself (catalogs keyed by their text).
 */
type PatternFor<S, K extends keyof S> = S[K] extends string
  ? string extends S[K]
    ? K & string
    : S[K]
  : never;

/**
 * The arguments `translate` takes for a message: none if it has no placeholders, otherwise an
 * object with every placeholder.
 *
 * @public
 */
export type TranslateArgs<P extends string> = [MessageArgNames<P>] extends [never]
  ? [args?: MessageNamedArgs]
  : [args: { [N in MessageArgNames<P>]: MessageArg } & MessageNamedArgs];

/**
 * Arguments for `translate`. When the key isn't one of the source keys, TypeScript falls back to
 * the union of all keys; arguments are then optional, so the error names the unknown key rather
 * than missing arguments.
 */
type KeyArgs<S, K extends keyof S> = keyof S extends K
  ? [args?: MessageNamedArgs]
  : TranslateArgs<PatternFor<S, K>>;

// ---------------------------------------------------------------------------------------------

/** Catalog ids to try for a locale, most specific first: 'pt-PT' -> 'pt-PT', 'pt'. */
const candidates = (locale: string): string[] => {
  const parts = locale.replace(/_/g, '-').split('-');
  const r: string[] = [];
  for (let i = parts.length; i > 0; i--) {
    r.push(parts.slice(0, i).join('-'));
  }
  return r;
};

const REGION = /^([A-Za-z]{2}|\d{3})$/;

/** Plural rules for a catalog id ('pt-PT' -> Portuguese as used in Portugal), cached. */
const pluralsFor = (state: TranslatorState, id: string): PluralRules => {
  let rules = state.plurals.get(id);
  if (!rules) {
    const parts = id.split('-');
    const region = parts.slice(1).find((p) => REGION.test(p));
    rules = getPluralRules(parts[0] || 'root', region && region.toUpperCase());
    state.plurals.set(id, rules);
  }
  return rules;
};

const parse = (state: TranslatorState, pattern: string): MessageCode => {
  let code = state.parsed.get(pattern);
  if (!code) {
    code = parseMessagePattern(pattern, state.matcher, false, state.apostropheMode);
    state.parsed.set(pattern, code);
  }
  return code;
};

/**
 * The message for `key` in the most specific catalog for `locale` that has it, and the id of
 * that catalog (the source language if none does).
 *
 * @public
 */
export const resolveMessage = <S extends Record<string, string>>(
  translator: Translator<S>,
  locale: string,
  key: keyof S & string,
): [message: string, language: string] => {
  for (const id of candidates(locale)) {
    const catalog = translator.catalogs[id];
    const m = catalog && catalog[key];
    if (typeof m === 'string') {
      return [m, id];
    }
  }
  const m = translator.source[key];
  return [typeof m === 'string' ? m : key, translator.sourceLanguage];
};

/**
 * Translate a message into `locale` ('de', 'pt-BR', a device locale such as 'en_CA'): the
 * message from the most specific catalog that has it, falling back to the source, formatted
 * with the plural rules of the language it is written in (an English fallback on a Japanese
 * device uses English plural rules). Keys and arguments are type-checked against the source
 * catalog.
 *
 * Parsed messages are cached in the translator, so repeated calls only evaluate.
 *
 * @public
 */
export const translate = <S extends Record<string, string>, K extends keyof S & string>(
  translator: Translator<S>,
  locale: string,
  key: K,
  ...args: KeyArgs<S, K>
): string => {
  const [message, language] = resolveMessage(translator, locale, key);
  // Text with no braces or apostrophes formats to itself.
  if (message.indexOf('{') === -1 && message.indexOf("'") === -1) {
    return message;
  }
  const state = translator.state;
  return evaluateMessage(
    pluralsFor(state, language),
    state.converter,
    state.formatters,
    parse(state, message),
    [],
    (args[0] || {}) as MessageNamedArgs,
  );
};

/**
 * True if `key` is a key of the translator's source catalog, e.g. to translate a runtime string
 * (a validation message from a shared schema) only when it is one.
 *
 * @public
 */
export const isMessageKey = <S extends Record<string, string>>(
  translator: Translator<S>,
  key: string,
): key is keyof S & string => Object.prototype.hasOwnProperty.call(translator.source, key);

// ---------------------------------------------------------------------------------------------
// Checking catalogs

const collectArgs = (code: MessageCode, names: Set<string>): void => {
  switch (code[0]) {
    case MessageOpType.ARG:
      names.add(String(code[1]));
      break;
    case MessageOpType.PLURAL:
      for (const a of code[1]) names.add(String(a));
      for (const c of code[4]) collectArgs(c[2], names);
      break;
    case MessageOpType.SELECT:
      for (const a of code[1]) names.add(String(a));
      for (const c of code[2]) collectArgs(c[1], names);
      break;
    case MessageOpType.SIMPLE:
      for (const a of code[2]) names.add(String(a));
      break;
    case MessageOpType.BLOCK:
      for (const c of code[1]) collectArgs(c, names);
      break;
  }
};

/**
 * The argument names a message pattern uses, sorted: `['count', 'customer']` for
 * `'{count, plural, one {# for {customer}} other {# for {customer}}}'`.
 *
 * @public
 */
export const messageArgNames = (
  pattern: string,
  options: { formatters?: string[]; apostropheMode?: ApostropheMode } = {},
): string[] => {
  const names = new Set<string>();
  const matcher = buildMessageMatcher(options.formatters || []);
  collectArgs(
    parseMessagePattern(pattern, matcher, false, options.apostropheMode || 'double-optional'),
    names,
  );
  return Array.from(names).sort();
};

/**
 * A problem found by {@link checkCatalogs}.
 *
 * @public
 */
export interface CatalogIssue {
  /** Catalog id, or the source language for problems in the source catalog. */
  readonly language: string;
  readonly key: string;
  readonly problem: 'missing' | 'extra' | 'placeholders' | 'unbalanced' | 'no-other';
  readonly detail: string;
}

/**
 * Options for {@link checkCatalogs}.
 *
 * @public
 */
export interface CheckCatalogsOptions {
  /** Report keys missing from a catalog. Default true; set false while translations are in progress. */
  complete?: boolean;
}

const depthOk = (pattern: string, mode: ApostropheMode): boolean => {
  // Count braces outside quoted text, as the parser sees them.
  let d = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "'") {
      const next = pattern[i + 1];
      if (next === "'") {
        i++;
      } else if (mode === 'double-required' || next === '{' || next === '}' || next === '#') {
        const k = pattern.indexOf("'", i + 1);
        if (k === -1) {
          return d === 0;
        }
        i = k;
      }
    } else if (c === '{') {
      d++;
    } else if (c === '}') {
      d--;
      if (d < 0) {
        return false;
      }
    }
  }
  return d === 0;
};

const missingOther = (code: MessageCode): boolean => {
  switch (code[0]) {
    case MessageOpType.PLURAL:
      return !code[4].some((c) => c[1] === 'other') || code[4].some((c) => missingOther(c[2]));
    case MessageOpType.SELECT:
      return !code[2].some((c) => c[0] === 'other') || code[2].some((c) => missingOther(c[1]));
    case MessageOpType.BLOCK:
      return code[1].some(missingOther);
    default:
      return false;
  }
};

/**
 * Check a translator's catalogs against the source catalog, for a unit test:
 * `expect(checkCatalogs(translator)).toEqual([])`. Reports keys missing from or unknown to a
 * catalog, messages whose placeholders differ from the source message's, unbalanced braces,
 * and plural / select messages without an `other` case. The source catalog is checked too.
 *
 * @public
 */
export const checkCatalogs = <S extends Record<string, string>>(
  translator: Translator<S>,
  options: CheckCatalogsOptions = {},
): CatalogIssue[] => {
  const issues: CatalogIssue[] = [];
  const state = translator.state;
  const mode = state.apostropheMode;
  const formatters = Object.keys(state.formatters);
  const keys = Object.keys(translator.source);

  const checkMessage = (language: string, key: string, message: string, expected?: string[]) => {
    if (!depthOk(message, mode)) {
      issues.push({ language, key, problem: 'unbalanced', detail: message });
      return;
    }
    const code = parse(state, message);
    if (missingOther(code)) {
      issues.push({ language, key, problem: 'no-other', detail: message });
    }
    if (expected) {
      const names = messageArgNames(message, { formatters, apostropheMode: mode });
      if (names.join(',') !== expected.join(',')) {
        const list = (a: string[]) => (a.length ? a.map((n) => `{${n}}`).join(', ') : 'none');
        issues.push({
          language,
          key,
          problem: 'placeholders',
          detail: `has ${list(names)}, source has ${list(expected)}`,
        });
      }
    }
  };

  const sourceArgs: Record<string, string[]> = {};
  for (const key of keys) {
    const message = translator.source[key] as string;
    checkMessage(translator.sourceLanguage, key, message);
    sourceArgs[key] = depthOk(message, mode)
      ? messageArgNames(message, { formatters, apostropheMode: mode })
      : [];
  }

  for (const language of Object.keys(translator.catalogs).sort()) {
    const catalog = translator.catalogs[language] || {};
    for (const key of keys) {
      const message = (catalog as Record<string, string | undefined>)[key];
      if (typeof message !== 'string') {
        if (options.complete !== false) {
          issues.push({ language, key, problem: 'missing', detail: '' });
        }
        continue;
      }
      checkMessage(language, key, message, sourceArgs[key]);
    }
    for (const key of Object.keys(catalog)) {
      if (!Object.prototype.hasOwnProperty.call(translator.source, key)) {
        issues.push({ language, key, problem: 'extra', detail: '' });
      }
    }
  }
  return issues;
};
