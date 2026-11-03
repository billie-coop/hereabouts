import type { Decimal } from '../../../hereabouts/src/decimal';
import { getPluralRules, type PluralRules } from '../../../hereabouts/src/plurals';
import { algorithmicNumbering } from './autogen.names';
import { rbnfRulesets } from './autogen.rbnf';
import {
  createRBNF,
  type RBNF,
  type RBNFDecimalFormatter,
  type RBNFSet,
  type RBNFSymbols,
  rbnfGet,
  rbnfSetFormat,
} from './rbnf';

const U = undefined;

let root: RBNF | undefined;

/**
 * The rulesets bundled with the library, decoded on first use.
 */
const rootRBNF = (): RBNF => root || (root = createRBNF(getPluralRules('root'), rbnfRulesets));

const rootSet = (): RBNFSet => rbnfGet(rootRBNF(), 'root')!;

/**
 * Locale-specific rule-based numbering systems, with fallback to the root locale.
 */
export interface AlgorithmicNumberingSystems {
  readonly rbnfset: RBNFSet | undefined;
  readonly rulenames: readonly string[];
}

/**
 * A rule-based numbering system: a public ruleset in an RBNF set.
 */
export interface AlgorithmicNumberingSystem {
  readonly name: string;
  readonly symbols: RBNFSymbols;
  readonly rbnf: RBNFSet;
}

/**
 * Decode the locale rulesets in the spellout resource and select the set for
 * the given locale ids.
 */
export const createAlgorithmicNumberingSystems = (
  plurals: PluralRules,
  spellout: any,
  ...ids: string[]
): AlgorithmicNumberingSystems => {
  const rbnf = createRBNF(plurals, spellout);
  const rootset = rootSet();
  let rbnfset: RBNFSet | undefined;
  let rulenames: string[] = [];

  // Find the first defined system. This lets us check if a region-specific
  // system exists, falling back to the language-script.
  // NOTE: 1.x does not stop at the first match: the last id wins, and an
  // undefined last id falls back to the root locale below.
  for (const id of ids) {
    rbnfset = rbnfGet(rbnf, id);
    if (rbnfset) {
      rulenames = rbnfset.pubnames.slice(0);
      // Include rules from the root locale that are not already defined
      // by the locale.
      for (const n of rootset.pubnames) {
        if (!rbnfset.index.has(n)) {
          rulenames.push(n);
        }
      }
    }
  }
  // If no locale rules are available, use those from the root locale.
  if (!rbnfset) {
    rulenames = rootset.pubnames.slice(0);
  }
  return { rbnfset, rulenames };
};

/**
 * Build a rule-based numbering system.
 */
export const algorithmicNumberingSystem = (
  name: string,
  symbols: RBNFSymbols,
  rbnf: RBNFSet,
): AlgorithmicNumberingSystem => ({ name, symbols, rbnf });

/**
 * Return a globally-available rule-based numbering system, e.g. 'hant' or 'roman-upper'.
 */
export const algorithmicSystem = (
  _systems: AlgorithmicNumberingSystems,
  name: string,
  symbols: RBNFSymbols,
): AlgorithmicNumberingSystem | undefined => {
  const path = algorithmicNumbering[name];
  if (path) {
    const set = rbnfGet(rootRBNF(), path[0]);
    if (set && set.index.has(path[1])) {
      return algorithmicNumberingSystem(path[1], symbols, set);
    }
  }
  return U;
};

/**
 * Return a locale-specific rule-based numbering system, e.g. 'spellout-cardinal' or
 * 'digits-ordinal'.
 */
export const algorithmicRbnf = (
  systems: AlgorithmicNumberingSystems,
  rule: string,
  symbols: RBNFSymbols,
): AlgorithmicNumberingSystem | undefined => {
  const rootset = rootSet();
  let set: RBNFSet | undefined;
  if (systems.rbnfset && systems.rbnfset.index.has(rule)) {
    set = systems.rbnfset;
  } else if (rootset.index.has(rule)) {
    set = rootset;
  }
  return set ? algorithmicNumberingSystem(rule, symbols, set) : U;
};

/**
 * Format a number using the numbering system.
 */
export const algorithmicFormat = (
  system: AlgorithmicNumberingSystem,
  n: Decimal,
  fallback: RBNFDecimalFormatter,
): string => rbnfSetFormat(system.rbnf, system.name, system.symbols, n, fallback);
