import { type Cache, cacheGet, cacheSize, createCache } from '@phensley/cldr-utils';
import { getPluralRules, type PluralRules } from '@phensley/plurals';
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
  parseMessagePattern,
} from './parser';

const DEFAULT_CACHE_SIZE = 100;

/**
 * Configures a MessageFormatter instance.
 *
 * @public
 */
export interface MessageFormatterOptions {
  /**
   * Language code, e.g. "en"
   */
  language?: string;

  /**
   * Region code. e.g. "US"
   */
  region?: string;

  /**
   * The plural rules you want to use. Otherwise it will be selected
   * using the language + region.
   */
  plurals?: PluralRules;

  /**
   * Functions to map raw arguments to the types required by the internal tags,
   * 'plural', 'select', 'selectordinal'.
   */
  converter?: MessageArgConverter;

  /**
   * Custom formatting functions.
   */
  formatters?: MessageFormatFuncMap;

  /**
   * Number of parsed messages to cache internally.
   */
  cacheSize?: number;

  /**
   * Disables the escaping of text between matching apostrophes.
   */
  disableEscapes?: boolean;

  /**
   * How apostrophes quote text. Default 'double-required' (1.x behaviour); 'double-optional'
   * is ICU's default and lets text like `Here's {name}` through unescaped. Translators made
   * with `createTranslator` use 'double-optional'.
   */
  apostropheMode?: ApostropheMode;
}

/**
 * Message formatter that caches parsed messages, as returned by
 * `createMessageFormatter`.
 *
 * @public
 */
export interface MessageFormatter {
  readonly plurals: PluralRules;
  readonly converter: MessageArgConverter;
  readonly formatters: MessageFormatFuncMap;
  readonly matcher: MessageMatcher;
  readonly cache: Cache<MessageCode>;
}

/**
 * Create a message formatter that parses messages on demand and caches them.
 *
 * @public
 */
export const createMessageFormatter = (options: MessageFormatterOptions = {}): MessageFormatter => {
  const formatters = options.formatters || {};
  const converter = options.converter || defaultMessageArgConverter;
  const plurals = options.plurals || getPluralRules(options.language || 'root', options.region);
  const size = options.cacheSize || DEFAULT_CACHE_SIZE;
  const matcher = buildMessageMatcher(Object.keys(formatters));
  const cache = createCache<MessageCode>(
    (s) => parseMessagePattern(s, matcher, options.disableEscapes, options.apostropheMode),
    size,
  );
  return { plurals, converter, formatters, matcher, cache };
};

/**
 * Parse and evaluate the message against the given arguments. Parsed messages
 * are cached in the formatter for reuse.
 *
 * @public
 */
export const formatMessage = (
  formatter: MessageFormatter,
  message: string,
  positional: MessageArg[],
  named: MessageNamedArgs,
): string =>
  evaluateMessage(
    formatter.plurals,
    formatter.converter,
    formatter.formatters,
    cacheGet(formatter.cache, message),
    positional,
    named,
  );

/**
 * String representation of a message formatter.
 *
 * @public
 */
export const messageFormatterToString = (formatter: MessageFormatter): string => {
  const names = JSON.stringify(Object.keys(formatter.formatters));
  return `MessageFormatter(formatters=${names} cached=${cacheSize(formatter.cache)})`;
};
