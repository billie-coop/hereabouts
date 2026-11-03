import { type Decimal, decimal, decimalToString } from '../../../hereabouts/src/decimal';
import { getPluralRules } from '../../../hereabouts/src/plurals';
import {
  algorithmicFormat,
  algorithmicRbnf,
  algorithmicSystem,
  createAlgorithmicNumberingSystems,
} from '../../src/ext-rbnf/algorithmic';
import { rbnfRulesets } from '../../src/ext-rbnf/autogen.rbnf';
import { createRBNFDebug } from '../../src/ext-rbnf/debug';
import {
  createRBNF,
  type RBNFDecimalFormatter,
  rbnfGet,
  rbnfSetFormat,
} from '../../src/ext-rbnf/rbnf';

// Expected values recorded from the 1.x class-based engine.

const SYMBOLS = { decimal: '.', nan: 'NaN', infinity: '∞' };

const FALLBACK: RBNFDecimalFormatter = (p: string, n: Decimal) => `<${p}|${decimalToString(n)}>`;

const ROOT_RULES = [
  'armenian-lower',
  'armenian-upper',
  'cyrillic-lower',
  'digits-ordinal',
  'ethiopic',
  'georgian',
  'greek-lower',
  'greek-upper',
  'hebrew',
  'hebrew-item',
  'roman-lower',
  'roman-upper',
  'spellout-cardinal',
  'spellout-numbering',
  'spellout-numbering-year',
  'spellout-ordinal',
  'tamil',
  'zz-default',
];

test('rbnf sets', () => {
  const rbnf = createRBNF(getPluralRules('root'), rbnfRulesets);
  const fmt = (id: string, rule: string, n: string) =>
    rbnfSetFormat(rbnfGet(rbnf, id)!, rule, SYMBOLS, decimal(n), FALLBACK);

  expect(rbnfGet(rbnf, 'xx')).toBe(undefined);
  expect(rbnfGet(rbnf, 'ja-Jpan')!.language).toEqual('ja');
  expect(rbnfGet(rbnf, 'root')!.pubnames).toEqual(ROOT_RULES);

  expect(fmt('root', 'roman-upper', '1234')).toEqual('MCCXXXIV');
  expect(fmt('root', 'roman-upper', '12345')).toEqual('ↂMMCCCXLV');
  expect(fmt('root', 'roman-upper', '-23.57')).toEqual('−<#,##0.00|23.57>');
  expect(fmt('root', 'hebrew', '3999')).toEqual('ג׳תתקצ״ט');
  expect(fmt('ja-Jpan', 'spellout-cardinal', '12345')).toEqual('一万二千三百四十五');
  expect(fmt('ja-Jpan', 'spellout-cardinal', '-23.57')).toEqual('マイナス二十三・五七');
  expect(fmt('ja-Jpan', 'spellout-cardinal', '0.5')).toEqual('〇・五');
  expect(fmt('zh-Hans', 'spellout-cardinal-financial', '-23.57')).toEqual('负贰拾叁点伍柒');
  expect(
    rbnfSetFormat(rbnfGet(rbnf, 'ja-Jpan')!, 'spellout-cardinal', SYMBOLS, decimal(NaN), FALLBACK),
  ).toEqual('NaN');
  expect(
    rbnfSetFormat(rbnfGet(rbnf, 'root')!, 'roman-upper', SYMBOLS, decimal(Infinity), FALLBACK),
  ).toEqual('∞');
  // unknown and private rule names produce nothing
  expect(fmt('root', 'no-such-rule', '1')).toEqual('');
});

test('algorithmic numbering systems', () => {
  const plurals = getPluralRules('root');
  let systems = createAlgorithmicNumberingSystems(plurals, rbnfRulesets);
  expect(systems.rbnfset).toBe(undefined);
  expect(systems.rulenames).toEqual(ROOT_RULES);

  const fmt = (name: string, n: string) =>
    algorithmicFormat(algorithmicSystem(systems, name, SYMBOLS)!, decimal(n), FALLBACK);
  expect(fmt('romanlow', '1234')).toEqual('mccxxxiv');
  expect(fmt('romanlow', '57')).toEqual('lvii');
  expect(fmt('hant', '1234')).toEqual('一千二百三十四');
  expect(fmt('hant', '1000000')).toEqual('一百萬');
  expect(algorithmicSystem(systems, 'latn', SYMBOLS)).toBe(undefined);

  systems = createAlgorithmicNumberingSystems(plurals, rbnfRulesets, 'ja-Jpan');
  expect(systems.rbnfset!.id).toEqual('ja-Jpan');
  expect(systems.rulenames.slice(0, 8)).toEqual([
    'digits-ordinal',
    'spellout-cardinal',
    'spellout-cardinal-financial',
    'spellout-numbering',
    'spellout-numbering-year',
    'spellout-numbering-year-latn',
    'spellout-ordinal',
    'armenian-lower',
  ]);
  // deliberate fix: 1.x appended the root rule names to the set's pubnames (20)
  expect(systems.rbnfset!.pubnames.length).toEqual(7);

  let sys = algorithmicRbnf(systems, 'spellout-cardinal', SYMBOLS)!;
  expect(sys.rbnf.id).toEqual('ja-Jpan');
  expect(algorithmicFormat(sys, decimal('1234'), FALLBACK)).toEqual('千二百三十四');
  // falls back to the root locale
  sys = algorithmicRbnf(systems, 'roman-upper', SYMBOLS)!;
  expect(sys.rbnf.id).toEqual('root');
  expect(algorithmicFormat(sys, decimal('3999'), FALLBACK)).toEqual('MMMCMXCIX');
  expect(algorithmicRbnf(systems, 'nope', SYMBOLS)).toBe(undefined);

  // 1.x behaviour: the last id wins, and an undefined last id falls back to root
  systems = createAlgorithmicNumberingSystems(plurals, rbnfRulesets, 'ja-Jpan', 'zz-Zzzz');
  expect(systems.rbnfset).toBe(undefined);
  expect(systems.rulenames).toEqual(ROOT_RULES);
});

test('debug coverage', () => {
  const rbnf = createRBNFDebug(getPluralRules('root'), rbnfRulesets, { coverage: true });
  const set = rbnfGet(rbnf, 'root')!;
  expect(rbnfSetFormat(set, 'roman-upper', SYMBOLS, decimal('1234'), FALLBACK)).toEqual('MCCXXXIV');
  const si = set.index.get('roman-upper')!;
  expect(set.coverage.get(si)!.size).toBeGreaterThan(0);
  expect(set.coverage.has(set.index.get('hebrew')!)).toBe(false);
});
