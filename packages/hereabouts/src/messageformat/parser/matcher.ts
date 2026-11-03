/**
 * A string and range of characters [s, e) (from 's' up to but not including 'e'),
 * representing the current state of the parse of a given scope inside a
 * message string.
 *
 * @public
 */
export interface MessageState {
  t: string;
  s: number;
  e: number;
}

// Matches ICU pattern syntax and whitespace, which includes control characters.
const IDENTIFIER =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: see above
  /[^\u0009-\u000d \u0085\u200e\u200f\u2028\u2029\u0021-\u002f\u003a-\u0040\u005b-\u005e\u0060\u007b-\u007e\u00a1-\u00a7\u00a9\u00ab\u00ac\u00ae\u00b0\u00b1\u00b6\u00bb\u00bf\u00d7\u00f7\u2010-\u2027\u2030-\u203e\u2041-\u2053\u2055-\u205e\u2190-\u245f\u2500-\u2775\u2794-\u2bff\u2e00-\u2e7f\u3001-\u3003\u3008-\u3020\u3030\ufd3e\ufd3f\ufe45\ufe46]+/;

const OPTION = /[^\s,{}]+/;

// explicit or plural category
const PLURAL_CHOICE = /(=\d+(\.\d+)?)|zero|one|two|few|many|other/;

const OFFSET = /offset:-?\d+/;

/**
 * Matches message syntax fragments. A record of functions; each one that
 * matches advances the start of the parse range `r` past the match.
 *
 * @public
 */
export interface MessageMatcher {
  /**
   * Return the next character.
   */
  readonly char: (r: MessageState) => string;

  /**
   * Indicate if we've reached the end of input.
   */
  readonly complete: (r: MessageState) => boolean;

  /**
   * Match one or more spaces.
   */
  readonly spaces: (r: MessageState) => boolean;

  /**
   * Match a list of arguments.
   */
  readonly arguments: (r: MessageState) => (number | string)[] | undefined;

  /**
   * Match variable identifier.
   */
  readonly identifier: (r: MessageState) => string | undefined;

  /**
   * Match a list of options.
   */
  readonly options: (r: MessageState) => string[];

  /**
   * Match a formatter name.
   */
  readonly formatter: (r: MessageState) => string | undefined;

  /**
   * Match a plural offset.
   */
  readonly pluralOffset: (r: MessageState) => number;

  /**
   * Match a plural choice (exact or category).
   */
  readonly pluralChoice: (r: MessageState) => string | undefined;
}

// This library supports these operations by default.
const BUILTINS = ['plural', 'select', 'selectordinal'];

const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Attempt to match the pattern at the given starting location. If a
 * match is found, move the start pointer and return the string.
 * Otherwise return undefined.
 */
type MatchFunc = (pattern: RegExp, r: MessageState) => string | undefined;

// Sticky regexps match at lastIndex.
const stickyMatch: MatchFunc = (pattern, r) => {
  pattern.lastIndex = r.s;
  const raw = pattern.exec(r.t);
  if (raw) {
    // set the start of range to the sticky index
    r.s = pattern.lastIndex;
    return raw[0];
  }
  return undefined;
};

// Anchored regexps match against the substring [start, end).
const substringMatch: MatchFunc = (pattern, r) => {
  pattern.lastIndex = 0;
  const s = r.t.substring(r.s, r.e);
  const raw = pattern.exec(s);
  if (raw) {
    // skip ahead by the number of characters matched
    r.s += pattern.lastIndex;
    return raw[0];
  }
  return undefined;
};

const createMatcher = (
  formatters: string[],
  compile: regexpFunc,
  match: MatchFunc,
): MessageMatcher => {
  const space = compile('[,\\s]+');
  const arg = compile(`(0[1..9]+|\\d+|${IDENTIFIER.source})`);
  const ident = compile(IDENTIFIER.source);
  const option = compile(OPTION.source);
  // Sort keys by length descending to ensure prefixes are matched last
  const names = BUILTINS.concat(formatters).sort((a, b) => cmp(b.length, a.length));
  const fmt = compile(`(${names.join('|')})`);
  const offset = compile(OFFSET.source);
  const choice = compile(PLURAL_CHOICE.source);

  const complete = (r: MessageState): boolean => r.e === r.s;

  const spaces = (r: MessageState): boolean => match(space, r) !== undefined;

  return {
    char: (r: MessageState): string => r.t[r.s],

    complete,

    spaces,

    arguments: (r: MessageState): (number | string)[] | undefined => {
      let args: (number | string)[] | undefined;
      do {
        const a = match(arg, r);
        if (!a) {
          break;
        }

        const n = parseInt(a, 10);
        if (!args) {
          args = [];
        }
        args.push(Number.isFinite(n) ? n : a);

        // Tuple arguments are separated by a single semicolon
        if (r.t[r.s] !== ';') {
          break;
        }
        r.s++;
      } while (!complete(r));
      return args;
    },

    identifier: (r: MessageState): string | undefined => match(ident, r),

    options: (r: MessageState): string[] => {
      const options: string[] = [];
      do {
        spaces(r);
        const opt = match(option, r);
        if (!opt) {
          break;
        }
        options.push(opt);
      } while (!complete(r));
      return options;
    },

    formatter: (r: MessageState): string | undefined => match(fmt, r),

    pluralOffset: (r: MessageState): number => {
      let n = 0;
      const m = match(offset, r);
      if (m) {
        // This must parse successfully since it is constrained by the regexp match
        n = parseInt(m.split(':')[1], 10);
      }
      return n;
    },

    pluralChoice: (r: MessageState): string | undefined => match(choice, r),
  };
};

/**
 * Matcher using sticky regular expressions compiled with `compile` (normally
 * `stickyRegexp`). Matches against a substring defined by the [start, end) range
 * argument. When a match occurs it updates the range's start pointer. This
 * allows a single matcher to be used to match positions recursively.
 *
 * For example, while the outer block is being parsed at [0, 74] the inner
 * block at [24, 73] can be recursively parsed using the same matcher, with
 * the corresponding parse positions maintained in a range object within each
 * stack frame.
 *
 * ```
 *   "{gender, select, female {guests plural one {her guest} other {her guests}}"
 * ```
 * @public
 */
export const stickyMatcher = (formatters: string[], compile: regexpFunc): MessageMatcher =>
  createMatcher(formatters, compile, stickyMatch);

/**
 * Matcher for browsers that do not support sticky regexps. All patterns are
 * anchored to the start of the string (normally compiled with `substringRegexp`),
 * then matched against a substring [start, end].
 *
 * @public
 */
export const substringMatcher = (formatters: string[], compile: regexpFunc): MessageMatcher =>
  createMatcher(formatters, compile, substringMatch);

/**
 * Check if the current JS runtime supports sticky RegExp flag.
 */
const hasStickyRegexp = /*#__PURE__*/ (() => {
  try {
    // Built at runtime: a /./y literal is a syntax error where the flag isn't supported.
    // biome-ignore lint/complexity/useRegexLiterals: feature detection, see above
    const r = new RegExp('.', 'y');
    return r && true;
  } catch {
    /* istanbul ignore next -- @preserve */
    return false;
  }
})();

/**
 * Function that compiles a regular expression.
 *
 * @public
 */
export type regexpFunc = (pattern: string) => RegExp;

/**
 * Construct a regular expression for use in a sticky matcher.
 *
 * @public
 */
export const stickyRegexp = (pattern: string): RegExp => new RegExp(pattern, 'y');

/**
 * Construct a regular expression for use in a substring matcher.
 *
 * @public
 */
export const substringRegexp = (pattern: string): RegExp => new RegExp('^' + pattern, 'g');

/**
 * Constructs the right matcher based on the runtime environment's
 * support of sticky regexp, while allowing substring matcher to be selected for
 * testing.
 *
 * @public
 */
export const buildMessageMatcher = (
  names: string[],
  sticky: boolean = hasStickyRegexp,
): MessageMatcher =>
  sticky ? stickyMatcher(names, stickyRegexp) : substringMatcher(names, substringRegexp);
