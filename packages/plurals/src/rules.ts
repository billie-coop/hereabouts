import { type Decimal, type DecimalArg, decimal } from '@phensley/decimal';
import { expressions } from './autogen.rules';
import { type NumberOperands, numberOperands } from './operands';

import type { Expr, Rule } from './types';

/**
 * Plural range rules for a language: either a single category index that
 * applies to every range, or a map from `((1 << start) << 5) + (1 << end)`
 * to a category index.
 *
 * @public
 */
export type RangeMap = number | { readonly [x: number]: number };

export type Operand = 'n' | 'i' | 'v' | 'w' | 'f' | 't' | 'c';

// Notation for categories in compact plural rules
const CATEGORIES: string[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

const arg = (n: DecimalArg, c: number = 0) => numberOperands(decimal(n), c);

/**
 * Cardinal, ordinal and range plural rules for a given language, as returned
 * by `getPluralRules`. The rules reference the shared array of expression
 * fragments in the generated rule data.
 *
 * @public
 */
export interface PluralRules {
  readonly cardinals: readonly Rule[];
  readonly ordinals: readonly Rule[];
  readonly ranges: RangeMap;
}

/**
 * Compute the plural operands for the Decimal `d`.
 *
 * @public
 */
export const pluralOperands = (_rules: PluralRules, d: Decimal): NumberOperands =>
  numberOperands(d);

/**
 * Cardinal plural category of `n`, with optional compact exponent `c`.
 *
 * @public
 */
export const pluralCardinal = (rules: PluralRules, n: DecimalArg, c: number = 0): string =>
  CATEGORIES[evaluate(arg(n, c), rules.cardinals)];

/**
 * Ordinal plural category of `n`.
 *
 * @public
 */
export const pluralOrdinal = (rules: PluralRules, n: DecimalArg): string =>
  CATEGORIES[evaluate(arg(n), rules.ordinals)];

/**
 * Plural category of the range `start` to `end`.
 *
 * @public
 */
export const pluralRange = (rules: PluralRules, start: DecimalArg, end: DecimalArg): string => {
  const ranges = rules.ranges;
  if (typeof ranges === 'number') {
    return CATEGORIES[ranges];
  }
  const s = evaluate(arg(start), rules.cardinals);
  const e = evaluate(arg(end), rules.cardinals);
  const cat = ranges[((1 << s) << 5) + (1 << e)];
  return CATEGORIES[cat] || 'other';
};

const evaluate = (operands: NumberOperands, rules: readonly Rule[]): number => {
  if (rules) {
    for (const rule of rules) {
      if (execute(operands, rule[1])) {
        return rule[0];
      }
    }
  }
  return 5;
};

const execute = (operands: NumberOperands, conditions: Rule[1]): boolean => {
  // Evaluate each condition and OR them together.
  const len = conditions.length;
  for (let i = 0; i < len; i++) {
    const cond = conditions[i];

    // Evaluate the inner expressions and AND them together.
    let res = true;
    for (let j = 0; j < cond.length; j++) {
      const expr = expressions[cond[j]];
      res = res && evaluateExpr(operands, expr);
      if (!res) {
        break;
      }
    }
    if (res) {
      return true;
    }
  }
  return false;
};

export const evaluateExpr = (operands: NumberOperands, expr: Expr): boolean => {
  const operand = expr[0]!;
  let n: number = operands[operand as Operand];

  // The N = X..Y syntax means N matches an integer from X to Y inclusive
  // Operand 'n' must always be compared as an integer, so if it has any non-zero decimal
  // parts we must set integer = false.
  const integer = operand === 'n' ? operands.w === 0 : true;

  const mod = expr[1];
  if (mod) {
    n = n % mod;
  }

  const ranges = expr[3];
  let res = false;
  for (let i = 0; i < ranges.length; i++) {
    const elem = ranges[i];
    if (typeof elem === 'number') {
      res = res || (integer && n === elem);
    } else {
      res = res || (integer && elem[0] <= n && n <= elem[1]);
    }
  }
  return expr[2] ? res : !res;
};
