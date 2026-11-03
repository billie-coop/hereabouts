import {
  type Decimal,
  DecimalConstants,
  decimal,
  decimalAbs,
  decimalCompare,
  decimalDivmod,
  decimalIntegerDigits,
  decimalIsFinite,
  decimalIsInfinity,
  decimalIsInteger,
  decimalIsNaN,
  decimalIsNegative,
  decimalNegate,
  decimalScale,
  decimalSetScale,
  decimalShiftleft,
  decimalStripTrailingZeros,
  decimalSubtract,
  decimalToInteger,
  decimalToString,
} from '@phensley/decimal';
import { type PluralRules, pluralCardinal, pluralOrdinal } from '@phensley/plurals';
import {
  type ApplyLeft2NumFormatInst,
  type ApplyLeft2RuleInst,
  type ApplyLeftNumFormatInst,
  type ApplyLeftRuleInst,
  type NormalRadixRule,
  type NormalRule,
  Opcode,
  PLURALS,
  type RBNFInst,
  type RBNFRule,
  RuleType,
  type SubLeftInst,
} from './rbnftypes';
import { binarySearch } from './utils';

// Divisors based on the number of integer digits in the number being formatted.
// A 2-digit number's divisor will be '1e1', 3-digit '1e2' and so on.
// This table stops just past the largest base value found in the RBNF dataset.
const DIVISORS: Decimal[] = /*#__PURE__*/ [
  0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
].map((e) => decimal(`1e${e}`));

const { ONE, ZERO } = DecimalConstants;
const MINUS_ONE = /*#__PURE__*/ decimalNegate(ONE);
const TEN = /*#__PURE__*/ decimal(10);

type IntegerSubInst =
  | ApplyLeftRuleInst
  | ApplyLeft2RuleInst
  | ApplyLeft2NumFormatInst
  | ApplyLeftNumFormatInst
  | SubLeftInst;

export interface RBNFSymbols {
  decimal: string;
  nan: string;
  infinity: string;
}

export type RBNFDecimalFormatter = (pattern: string, n: Decimal) => string;

/**
 * Hooks the engine calls while formatting a single number, used for tracing
 * and coverage (see debug.ts). A hook may return a function that is called
 * when the step completes.
 */
export interface RBNFEngineHooks {
  /** Called each time the instructions of a rule are evaluated. */
  // biome-ignore lint/suspicious/noConfusingVoidType: a hook may return a cleanup function or nothing
  readonly evalinst?: (n: Decimal, rule: RBNFRule, ri: number, si: number) => (() => void) | void;
  /** Called each time a modulus substitution is performed. */
  // biome-ignore lint/suspicious/noConfusingVoidType: a hook may return a cleanup function or nothing
  readonly modulussub?: (n: Decimal) => (() => void) | void;
}

/**
 * A closed set of RBNF rules. By "closed" we mean that any instruction
 * that jumps to another named rule always lands in the same ruleset.
 */
export interface RBNFSet {
  readonly id: string;
  readonly language: string;
  readonly plurals: PluralRules;
  readonly pubnames: readonly string[];
  readonly prvnames: readonly string[];
  // Ordered array of ruleset names, match 1:1 with first N elements in rulesets array
  readonly allnames: readonly string[];
  // Lookup a public ruleset index by its name
  readonly index: ReadonlyMap<string, number>;
  // Array of numbers used in rules
  readonly numbers: readonly Decimal[];
  // Array of string symbols used in rules
  readonly symbols: readonly string[];
  // Array of rulesets
  readonly rulesets: readonly RBNFRule[][];
  // Creates the engine hooks for a single format call (debugging only)
  readonly hooks?: () => RBNFEngineHooks;
}

/**
 * Builds an RBNFSet. Passed to createRBNF to customize construction of the sets
 * (currently used for debugging).
 */
export type RBNFSetFactory<S extends RBNFSet> = (
  id: string,
  plurals: PluralRules,
  pub: string[],
  prv: string[],
  numbers: Decimal[],
  symbols: string[],
  rulesets: RBNFRule[][],
) => S;

/**
 * A collection of multiple RBNF locale-specific rulesets with shared arrays of
 * symbols and numbers.
 */
export interface RBNF<S extends RBNFSet = RBNFSet> {
  readonly plurals: PluralRules;
  readonly symbols: readonly string[];
  readonly numbers: readonly Decimal[];
  readonly locales: ReadonlyMap<string, S>;
}

/**
 * Build an RBNFSet.
 */
export const createRBNFSet = (
  id: string,
  plurals: PluralRules,
  pubnames: string[],
  prvnames: string[],
  numbers: Decimal[],
  symbols: string[],
  rulesets: RBNFRule[][],
  hooks?: () => RBNFEngineHooks,
): RBNFSet => {
  const index: Map<string, number> = new Map<string, number>();
  pubnames.forEach((n, i) => index.set(n, i));
  const set: RBNFSet = {
    id,
    language: id === 'root' ? id : id.split('-')[0],
    plurals,
    pubnames,
    prvnames,
    allnames: pubnames.concat(prvnames),
    index,
    numbers,
    symbols,
    rulesets,
  };
  return hooks ? { ...set, hooks } : set;
};

/**
 * Decode the RBNF rulesets for all locales in a spellout resource. The optional
 * `make` builds each locale's set (defaults to createRBNFSet).
 */
export const createRBNF = <S extends RBNFSet = RBNFSet>(
  plurals: PluralRules,
  spellout: any,
  make: RBNFSetFactory<S> = createRBNFSet as RBNFSetFactory<any>,
): RBNF<S> => {
  const { locales: raw, symbols: _symbols, numbers: _numbers } = spellout;
  const symbols: string[] = _symbols ? _symbols.split('_') : [];
  const numbers: Decimal[] = _numbers ? _numbers.split('_').map((n: string) => decimal(n)) : [];
  const locales: Map<string, S> = new Map<string, S>();
  for (const id of Object.keys(raw)) {
    const { names, rulesets } = raw[id];
    const [_pub, _prv] = names;
    const pub = _pub.split('_');
    // some rulesets have no private rules
    const prv = _prv.length ? _prv.split('_') : [];
    locales.set(id, make(id, plurals, pub, prv, numbers, symbols, rulesets));
  }
  return { plurals, symbols, numbers, locales };
};

/**
 * Fetch the rulesets for the given locale id.
 */
export const rbnfGet = <S extends RBNFSet>(rbnf: RBNF<S>, id: string): S | undefined =>
  rbnf.locales.get(id);

/**
 * Return the RBNF formatted representation of a number for the set's
 * language, using the given rules.
 *
 * Some rulesets will be included with the core library (those referenced in the
 * root locale) while others will be added to the corresponding language's resource
 * pack and only available when that language has been loaded.
 */
export const rbnfSetFormat = (
  set: RBNFSet,
  rulename: string,
  symbols: RBNFSymbols,
  n: Decimal,
  fallback: RBNFDecimalFormatter,
): string => {
  const e: Engine = {
    set,
    symbols,
    fallback,
    hooks: set.hooks ? set.hooks() : undefined,
    // Decimal point character: 0 = period, 1 = comma
    decimal: symbols.decimal === '.' ? 1 : 0,
    buf: '',
    errors: [],
    fractions: new Set<number>(),
  };
  const si = set.index.get(rulename);
  if (si !== undefined) {
    format(e, n, si);
  }
  if (e.errors.length) {
    console.log(
      `ERRORS: '${set.language}' rule '${rulename}' number '${decimalToString(n)}'  ${e.errors.join('\n')}`,
    );
  }
  return e.buf;
};

/**
 * State of a single format call. Only lives for the duration of rbnfSetFormat.
 */
interface Engine {
  readonly set: RBNFSet;
  readonly symbols: RBNFSymbols;
  readonly fallback: RBNFDecimalFormatter;
  readonly hooks: RBNFEngineHooks | undefined;
  readonly decimal: number;
  // output buffer
  buf: string;
  readonly errors: string[];
  // rulesets that have been used to format a fraction numerator
  readonly fractions: Set<number>;
}

const format = (e: Engine, n: Decimal, si: number): void => {
  const ri = match(e, n, si);
  if (ri === -1) {
    if (decimalIsNaN(n)) {
      e.buf += e.symbols.nan;
    } else if (decimalIsInfinity(n)) {
      e.buf += e.symbols.infinity;
    }
    return;
  }
  const r = e.set.rulesets[si][ri];
  evalinst(e, n, r[1], r, ri, si);
};

const match = (e: Engine, n: Decimal, si: number): number => {
  const rules = e.set.rulesets[si];
  const neg = decimalIsNegative(n);
  const int = decimalIsInteger(n);
  const fin = decimalIsFinite(n);

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    switch (r[0]) {
      case RuleType.NOT_A_NUMBER:
        if (decimalIsNaN(n)) {
          return i;
        }
        break;

      case RuleType.INFINITY:
        if (decimalIsInfinity(n)) {
          return i;
        }
        break;

      case RuleType.MINUS:
        if (neg) {
          return i;
        }
        break;

      case RuleType.PROPER_FRACTION:
        if (
          !int &&
          fin &&
          r[2] === e.decimal &&
          ((neg && decimalCompare(n, MINUS_ONE) === 1) || (!neg && decimalCompare(n, ONE) === -1))
        ) {
          return i;
        }
        break;

      case RuleType.IMPROPER_FRACTION:
        // If present it always follows a proper fraction rule, catching anything that falls through
        if (!int && fin && r[2] === e.decimal) {
          return i;
        }
        break;

      case RuleType.NORMAL:
      case RuleType.NORMAL_RADIX:
        if (fin) {
          const m = decimalAbs(n);
          const j = binarySearch(
            rules as (NormalRule | NormalRadixRule)[],
            true,
            i,
            (x: NormalRule | NormalRadixRule): number => decimalCompare(e.set.numbers[x[2]], m),
          );
          if (j < i) {
            const name = e.set.allnames[si];
            e.errors.push(
              `Malformed rules in ruleset '${name}' at ${i} for ${decimalToString(n)}: got ${j}`,
            );
            return -1;
          }
          return j;
        }
        break;
    }
  }

  return -1;
};

const evalinst = (
  e: Engine,
  n: Decimal,
  i: RBNFInst[],
  r: RBNFRule,
  ri: number,
  si: number,
): void => {
  const done = e.hooks && e.hooks.evalinst ? e.hooks.evalinst(n, r, ri, si) : undefined;
  for (let j = 0; j < i.length; j++) {
    const inst = i[j];
    switch (inst[0]) {
      case Opcode.LITERAL:
        symbol(e, inst[1]);
        break;

      case Opcode.OPTIONAL:
        // If number is not a multiple of radix, execute the optional block
        if (decimalCompare(ZERO, decimalDivmod(n, getradix(e, r))[1]) !== 0) {
          evalinst(e, n, inst[1], r, ri, si);
        }
        break;

      case Opcode.CARDINAL:
      case Opcode.ORDINAL: {
        const q = decimalDivmod(n, getradix(e, r))[0];
        const cat = plural(e, decimalStripTrailingZeros(q), inst[0] === Opcode.CARDINAL);
        // Select string matching plural category, and fall back to 'other'
        let subs = inst[1].filter((s) => s[0] === cat);
        if (!subs.length) {
          subs = inst[1].filter((s) => s[0] === PLURALS['other']);
        }
        if (subs.length) {
          symbol(e, subs[0][1]);
        }
        break;
      }

      case Opcode.SUB_LEFT:
      case Opcode.APPLY_LEFT_RULE:
      case Opcode.APPLY_LEFT_2_RULE:
      case Opcode.APPLY_LEFT_NUM_FORMAT:
      case Opcode.APPLY_LEFT_2_NUM_FORMAT:
        if (r[0] === RuleType.PROPER_FRACTION || r[0] === RuleType.IMPROPER_FRACTION) {
          integersub(e, n, inst, ri, si);
        } else if (e.fractions.has(si)) {
          const base = r[0] === RuleType.NORMAL || r[0] === RuleType.NORMAL_RADIX ? r[2] : -1;
          if (base !== -1) {
            numeratorsub(e, n, inst, base, ri, si);
          }
        } else {
          multipliersub(e, n, inst, getradix(e, r), ri, si);
        }
        break;

      case Opcode.UNCHANGED_RULE:
        format(e, n, inst[1]);
        break;

      case Opcode.UNCHANGED_NUM_FORMAT:
        e.buf += e.fallback(e.set.symbols[inst[1]], n);
        break;

      case Opcode.SUB_RIGHT:
      case Opcode.SUB_RIGHT_3:
      case Opcode.APPLY_RIGHT_RULE:
        if (r[0] === RuleType.MINUS) {
          format(e, decimalAbs(n), inst[0] === Opcode.APPLY_RIGHT_RULE ? inst[1] : si);
        } else if (r[0] === RuleType.PROPER_FRACTION || r[0] === RuleType.IMPROPER_FRACTION) {
          const m = decimalAbs(n);
          fractionsub(e, decimalSubtract(m, decimalToInteger(m)), inst, ri, si);
        } else {
          modulussub(e, n, inst, getradix(e, r), ri, si);
        }
        break;

      default:
        // TODO: remove
        console.log('   MISSING:', inst[0]);
        break;
    }
  }
  if (done) {
    done();
  }
};

const symbol = (e: Engine, i: number): void => {
  e.buf += e.set.symbols[i];
};

const fractionsub = (e: Engine, n: Decimal, inst: RBNFInst, ri: number, si: number): void => {
  const _si = inst[0] === Opcode.APPLY_RIGHT_RULE ? inst[1] : si;
  const digits = inst[0] === Opcode.SUB_RIGHT || inst[0] === Opcode.SUB_RIGHT_3 || _si === si;
  const spaces = inst[0] !== Opcode.SUB_RIGHT_3;
  if (digits) {
    bydigit(e, n, ri, si, spaces);
  } else {
    let q = n;
    if (decimalScale(q) > 9) {
      q = decimalSetScale(q, 9);
    }
    const t = decimalToInteger(decimalShiftleft(q, decimalScale(q)));
    const m = binarySearch(DIVISORS, false, 0, (x: Decimal) => decimalCompare(x, t));
    const d = DIVISORS[m];
    const k = match(e, d, _si);
    if (k !== -1) {
      e.fractions.add(_si);
      const r = e.set.rulesets[_si][k];
      evalinst(e, t, r[1], r, k, _si);
    }
  }
};

const integersub = (e: Engine, n: Decimal, inst: IntegerSubInst, _ri: number, si: number): void => {
  n = decimalToInteger(n);
  switch (inst[0]) {
    case Opcode.APPLY_LEFT_RULE:
    case Opcode.APPLY_LEFT_2_RULE:
    case Opcode.SUB_LEFT:
      format(e, n, inst[0] === Opcode.SUB_LEFT ? si : inst[1]);
      break;
    case Opcode.APPLY_LEFT_NUM_FORMAT:
    case Opcode.APPLY_LEFT_2_NUM_FORMAT:
      // TODO: implement number format
      e.buf += '#';
      break;
  }
};

const numeratorsub = (
  e: Engine,
  n: Decimal,
  inst: RBNFInst,
  _base: number,
  _ri: number,
  _si: number,
): void => {
  switch (inst[0]) {
    case Opcode.APPLY_LEFT_2_RULE:
      format(e, n, inst[1]);
      break;
  }
};

const multipliersub = (
  e: Engine,
  n: Decimal,
  inst: RBNFInst,
  radix: Decimal,
  _ri: number,
  si: number,
): void => {
  const [q] = decimalDivmod(n, radix);
  switch (inst[0]) {
    case Opcode.APPLY_LEFT_RULE:
    case Opcode.SUB_LEFT:
      format(e, q, inst[0] === Opcode.SUB_LEFT ? si : inst[1]);
      break;
    default:
      // TODO: remove
      console.log('MISSING:', inst[0]);
      break;
  }
};

const modulussub = (
  e: Engine,
  n: Decimal,
  inst: RBNFInst,
  radix: Decimal,
  _ri: number,
  si: number,
): void => {
  const done = e.hooks && e.hooks.modulussub ? e.hooks.modulussub(n) : undefined;
  const r = decimalDivmod(n, radix)[1];
  switch (inst[0]) {
    case Opcode.APPLY_RIGHT_RULE:
    case Opcode.SUB_RIGHT:
      format(e, r, inst[0] === Opcode.SUB_RIGHT ? si : inst[1]);
      break;
  }
  if (done) {
    done();
  }
};

const plural = (e: Engine, n: Decimal, cardinal: boolean): number => {
  const plurals = e.set.plurals;
  const cat = cardinal ? pluralCardinal(plurals, n) : pluralOrdinal(plurals, n);
  return PLURALS[cat];
};

const bydigit = (e: Engine, n: Decimal, _ri: number, si: number, spaces: boolean = true): void => {
  let i = 0;
  while (decimalCompare(ZERO, n) !== 0) {
    if (spaces && i) {
      e.buf += ' ';
    }
    // Shift 1 digit to the left and isolate integer part
    // TODO: method for scanning Decimal by index
    const q = decimalShiftleft(n, 1);
    const r = decimalToInteger(q);
    format(e, r, si);
    n = decimalSubtract(q, r);
    i++;
  }
};

const getradix = (e: Engine, r: RBNFRule): Decimal => {
  const n = e.set.numbers;
  return r[0] === RuleType.NORMAL_RADIX
    ? n[r[3]]
    : r[0] === RuleType.NORMAL
      ? DIVISORS[decimalIntegerDigits(n[r[2]])]
      : TEN;
};
