/* istanbul ignore file -- @preserve */

import { type Decimal, decimalToString } from '../../../hereabouts/src/decimal';
import type { PluralRules } from '../../../hereabouts/src/plurals';
import { createRBNF, createRBNFSet, type RBNF, type RBNFEngineHooks, type RBNFSet } from './rbnf';
import { Opcode, type RBNFInst, type RBNFRule, RuleType } from './rbnftypes';

const REVPLURALS: { [x: number]: string } = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'few',
  4: 'many',
  5: 'other',
};

export interface RBNFDebugSettings {
  trace?: boolean;
  coverage?: boolean;
}

/**
 * An RBNF set that traces execution and/or collects ruleset coverage
 * information while formatting, according to its settings.
 */
export interface RBNFDebugSet extends RBNFSet {
  /**
   * Ruleset coverage collected while formatting: ruleset index to the set of
   * rule indices evaluated. Filled in as a side effect of formatting.
   */
  readonly coverage: Map<number, Set<number>>;
}

/**
 * Decode the RBNF rulesets like createRBNF, building debug sets. The settings
 * object is shared by all sets and read on every format call.
 */
export const createRBNFDebug = (
  plurals: PluralRules,
  spellout: any,
  settings: RBNFDebugSettings = {},
): RBNF<RBNFDebugSet> =>
  createRBNF(plurals, spellout, (id, _plurals, pub, prv, numbers, symbols, rulesets) =>
    createRBNFDebugSet(id, _plurals, pub, prv, numbers, symbols, rulesets, settings),
  );

/**
 * Build a debug RBNF set.
 */
export const createRBNFDebugSet = (
  id: string,
  plurals: PluralRules,
  pubnames: string[],
  prvnames: string[],
  numbers: Decimal[],
  symbols: string[],
  rulesets: RBNFRule[][],
  settings: RBNFDebugSettings,
): RBNFDebugSet => {
  const coverage: Map<number, Set<number>> = new Map();
  const hooks = (): RBNFEngineHooks => debugHooks(set, settings, coverage);
  const set: RBNFDebugSet = {
    ...createRBNFSet(id, plurals, pubnames, prvnames, numbers, symbols, rulesets, hooks),
    coverage,
  };
  return set;
};

/**
 * Print the ruleset coverage report for a debug set.
 */
export const rbnfDebugReport = (set: RBNFDebugSet, detail: boolean = false): void => {
  console.log('Coverage report:');
  for (let si = 0; si < set.allnames.length; si++) {
    const name = set.allnames[si];
    const rules = set.rulesets[si];
    let pct = 0;
    let count = 0;
    const covered = set.coverage.get(si);
    let rpt = '';
    for (let ri = 0; ri < rules.length; ri++) {
      if (covered && covered.has(ri)) {
        count++;
      } else {
        rpt += '   ' + rulerepr(set, rules[ri]) + '\n';
      }
    }
    pct = (count / rules.length) * 100;
    console.log(
      padleft(`${Math.floor(pct)}%`, 6),
      '[',
      padleft(`${count}`, 2),
      '/',
      padleft(`${rules.length}`, 2),
      ']',
      name,
    );
    if (detail && pct < 100) {
      console.log(rpt);
    }
  }
};

export const padleft = (s: string, n: number): string => {
  const d = n - s.length;
  return ' '.repeat(d > 0 ? d : 0) + s;
};

export const padright = (s: string, n: number): string => {
  const d = n - s.length;
  return s + ' '.repeat(d > 0 ? d : 0);
};

type tracefunc = (...s: any[]) => void;

/**
 * Engine hooks for a single format call: trace depth and step ids restart
 * with each call, coverage accumulates on the set.
 */
const debugHooks = (
  set: RBNFSet,
  settings: RBNFDebugSettings,
  coverage: Map<number, Set<number>>,
): RBNFEngineHooks => {
  let depth = 0;
  let id = 0;

  const trace = (...s: any[]): tracefunc => {
    const _id = `${padleft(`[${id}]`, 5)}`;
    const indent = '  '.repeat(depth);
    id++;
    depth++;
    if (settings.trace) {
      console.log(indent, _id, '>>', ...s);
    }
    return (..._e: any[]) => {
      depth--;
    };
  };

  return {
    evalinst: (n: Decimal, r: RBNFRule, ri: number, si: number) => {
      // Collect ruleset coverage during execution
      if (settings.coverage) {
        let covered = coverage.get(si);
        if (!covered) {
          covered = new Set();
          coverage.set(si, covered);
        }
        covered.add(ri);
      }
      let t: tracefunc | undefined;
      if (settings.trace) {
        t = trace(`_evalinst '${decimalToString(n)}' ${set.allnames[si]} ${rulerepr(set, r)}`);
      }
      return () => {
        if (settings.trace) {
          t!('_evalinst');
        }
      };
    },
    modulussub: (n: Decimal) => {
      const t = trace('modolussub', decimalToString(n));
      return () => t('modulussub');
    },
  };
};

const rulerepr = (rbnf: RBNFSet, rule: RBNFRule): string => {
  let res = '';
  switch (rule[0]) {
    case RuleType.IMPROPER_FRACTION:
    case RuleType.PROPER_FRACTION: {
      const sym = rule[2] === 1 ? ',' : '.';
      res += `"${rule[0] === RuleType.IMPROPER_FRACTION ? 'x' : '0'}${sym}x"`;
      break;
    }
    case RuleType.MINUS:
      res += '"-x"';
      break;
    case RuleType.INFINITY:
      res += `"Inf"`;
      break;
    case RuleType.NOT_A_NUMBER:
      res += 'NaN';
      break;
    case RuleType.NORMAL:
      res += `"${decimalToString(rbnf.numbers[rule[2]])}"`;
      break;
    case RuleType.NORMAL_RADIX:
      res += `"${decimalToString(rbnf.numbers[rule[2]])}/${decimalToString(rbnf.numbers[rule[3]])}"`;
      break;
    default:
      res += '!!!!!';
  }
  res += '  "' + rule[1].map((i) => instrepr(rbnf, i)).join('') + ';"';
  return res;
};

const instrepr = (rbnf: RBNFSet, i: RBNFInst): string => {
  switch (i[0]) {
    case Opcode.APPLY_LEFT_NUM_FORMAT:
      return `<${rbnf.symbols[i[1]]}<`;
    case Opcode.APPLY_LEFT_RULE:
      return `<%${rbnf.allnames[i[1]]}%<`;
    case Opcode.APPLY_LEFT_2_NUM_FORMAT:
      return `<${rbnf.symbols[i[1]]}<<`;
    case Opcode.APPLY_LEFT_2_RULE:
      return `<%${rbnf.allnames[i[1]]}%<<`;
    case Opcode.APPLY_RIGHT_RULE:
      return `>%${rbnf.allnames[i[1]]}%>`;
    case Opcode.OPTIONAL:
      return '[' + i[1].map((_i) => instrepr(rbnf, _i)).join('') + ']';
    case Opcode.LITERAL:
      return rbnf.symbols[i[1]];
    case Opcode.SUB_LEFT:
      return '<<';
    case Opcode.SUB_RIGHT:
      return '>>';
    case Opcode.SUB_RIGHT_3:
      return '>>>';
    case Opcode.UNCHANGED_NUM_FORMAT:
      return `=${rbnf.symbols[i[1]]}=`;
    case Opcode.UNCHANGED_RULE:
      return `=%${rbnf.allnames[i[1]]}%=`;
    case Opcode.CARDINAL:
    case Opcode.ORDINAL: {
      const r = i[0] === Opcode.CARDINAL ? 'cardinal' : 'ordinal';
      const subs = i[1].map((s) => `${REVPLURALS[s[0]]}{${rbnf.symbols[s[1]]}}`).join('');
      return `$(${r},${subs})$`;
    }
    default:
      return OPCODES[i[0]];
  }
};

export const OPCODES: { [x: number]: string } = {
  [Opcode.APPLY_LEFT_2_NUM_FORMAT]: 'APPLY_LEFT_2_NUM_FORMAT',
  [Opcode.APPLY_LEFT_2_RULE]: 'APPLY_LEFT_2_RULE',
  [Opcode.APPLY_LEFT_NUM_FORMAT]: 'APPLY_LEFT_NUM_FORMAT',
  [Opcode.APPLY_LEFT_RULE]: 'APPLY_LEFT_RULE',
  [Opcode.APPLY_RIGHT_NUM_FORMAT]: 'APPLY_RIGHT_NUM_FORMAT',
  [Opcode.APPLY_RIGHT_RULE]: 'APPLY_RIGHT_RULE',
  [Opcode.CARDINAL]: 'CARDINAL',
  [Opcode.LITERAL]: 'LITERAL',
  [Opcode.OPTIONAL]: 'OPTIONAL',
  [Opcode.ORDINAL]: 'ORDINAL',
  [Opcode.SUB_LEFT]: 'SUB_LEFT',
  [Opcode.SUB_RIGHT]: 'SUB_RIGHT',
  [Opcode.SUB_RIGHT_3]: 'SUB_RIGHT_3',
  [Opcode.UNCHANGED_NUM_FORMAT]: 'UNCHANGED_NUM_FORMAT',
  [Opcode.UNCHANGED_RULE]: 'UNCHANGED_RULE',
};

export const RULETYPES = {
  [RuleType.IMPROPER_FRACTION]: 'IMPROPER_FRACTION',
  [RuleType.INFINITY]: 'INFINITY',
  [RuleType.MINUS]: 'MINUS',
  [RuleType.NORMAL]: 'NORMAL',
  [RuleType.NORMAL_RADIX]: 'NORMAL_RADIX',
  [RuleType.NOT_A_NUMBER]: 'NOT_A_NUMBER',
  [RuleType.PROPER_FRACTION]: 'PROPER_FRACTION',
};
