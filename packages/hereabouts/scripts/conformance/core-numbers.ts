/**
 * Cases for the core foundation (resource packs, schema, framework, numbering systems,
 * patterns) and for number and currency formatting.
 */
import { config } from '../../src/config';
import {
  adjustDecimal,
  availableLocales,
  checksumIndices,
  formatCurrency,
  formatCurrencyToParts,
  formatDecimal,
  formatDecimalToParts,
  getCurrencyDisplayName,
  getCurrencyForRegion,
  getCurrencyFractions,
  getCurrencyPluralName,
  getCurrencySymbol,
  getPluralCardinal,
  getPluralOrdinal,
  resolveLocale,
} from '../../src/core';
import { getContextTransformInfo } from '../../src/core/api/private/api';
import { getNumberParams } from '../../src/core/api/private/numbers';
import {
  contextTransform,
  formatListValue,
  formatWrapper,
} from '../../src/core/internals/general/internal';
import { parseNumberPattern } from '../../src/core/parsing/number';
import { parseWrapperPattern } from '../../src/core/parsing/wrapper';
import { buildOrigin, keyIndexGet } from '../../src/core/schema';
import {
  digitsGet,
  fieldGet,
  scopeGet,
  vectorExists,
  vectorGet,
  vectorMapping,
  vectorValid,
} from '../../src/core/schema/schema/arrows';
import { fastFormatDecimal, numberingFormatString } from '../../src/core/systems/numbering/decimal';
import { stringValue } from '../../src/core/utils/render';
import { VERSION } from '../../src/core/utils/version';
import { decimalToString } from '../../src/decimal';
import { tagCompact } from '../../src/language-tag';
import { LOCALES, load } from './_core';
import { type ConformanceCase, collector, type Random, random } from './_shared';

// ---------------------------------------------------------------------------------------------
// Schema paths
// ---------------------------------------------------------------------------------------------

interface ArrowPath {
  path: string;
  arrow: any;
}

/** Every arrow of the schema with its dotted path; scope maps add the key as a segment. */
const arrowPaths = (schema: any): ArrowPath[] => {
  const out: ArrowPath[] = [];
  const walk = (o: any, path: string): void => {
    if (o.kind === 'field' || o.kind === 'vector' || o.kind === 'digits') {
      out.push({ path, arrow: o });
    } else if (o.kind === 'scope') {
      for (const k of Object.keys(o.map)) {
        walk(o.map[k], `${path}.${k}`);
      }
    } else {
      for (const k of Object.keys(o)) {
        walk(o[k], path ? `${path}.${k}` : k);
      }
    }
  };
  walk(schema, '');
  return out;
};

const vectorSize = (arrow: any): number =>
  arrow.keysets.reduce((p: number, k: any) => p * k.size, 1);

// ---------------------------------------------------------------------------------------------
// Random inputs
// ---------------------------------------------------------------------------------------------

const randomNumber = (r: Random): string => {
  switch (r.int(0, 9)) {
    case 0:
      return r.pick(['0', '-0', '0.0', '-0.00', '1', '-1', '0.5', '-0.5', '1.5', '2.5']);
    case 1:
      return r.pick(['999', '9999', '99999', '999999', '999999.5', '9999999', '999500', '99950']);
    case 2:
      return r.pick(['0.000123', '0.00999', '0.0995', '1e5', '1.5e-3', '12345e10', '-7E2']);
    default: {
      const neg = r.next() < 0.3 ? '-' : '';
      const int = r.int(0, 16);
      let s = r.int(1, 9).toString();
      for (let i = 1; i < int; i++) {
        s += r.int(0, 9);
      }
      if (int === 0) {
        s = '0';
      }
      const frac = r.int(0, 6);
      if (frac > 0) {
        s += '.';
        for (let i = 0; i < frac; i++) {
          s += r.int(0, 9);
        }
      }
      return neg + s;
    }
  }
};

const ROUNDING = ['half-even', 'half-up', 'half-down', 'up', 'down', 'ceiling', 'floor'];
const SYSTEMS = [
  'latn',
  'arab',
  'arabext',
  'beng',
  'deva',
  'thai',
  'mymr',
  'hanidec',
  'fullwide',
  'tibt',
  'native',
  'finance',
  'traditional',
  'default',
  'bogus',
];
const DIVISORS = [1, 10, 100, 1000, 10000, 1000000, 1e9, 5000, 1e20];

/** Random number options; each key appears with some probability. */
const randomNumberOptions = (r: Random, extra: (o: any) => void): any => {
  const o: any = {};
  if (r.next() < 0.3) o.round = r.pick(ROUNDING);
  if (r.next() < 0.15) o.group = r.next() < 0.5;
  if (r.next() < 0.15) o.minimumIntegerDigits = r.int(0, 4);
  if (r.next() < 0.25) o.maximumFractionDigits = r.int(0, 5);
  if (r.next() < 0.25) o.minimumFractionDigits = r.int(0, 5);
  if (r.next() < 0.15) o.maximumSignificantDigits = r.int(1, 6);
  if (r.next() < 0.15) o.minimumSignificantDigits = r.int(1, 6);
  if (r.next() < 0.15) o.trimZeroFractions = r.next() < 0.7;
  if (r.next() < 0.2) o.nu = r.pick(SYSTEMS);
  extra(o);
  return o;
};

const DECIMAL_STYLES = [
  'decimal',
  'short',
  'long',
  'scientific',
  'percent',
  'percent-scaled',
  'permille',
  'permille-scaled',
];
const CURRENCY_STYLES = ['symbol', 'accounting', 'code', 'name', 'short'];
const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'DKK',
  'BHD',
  'CLF',
  'KWD',
  'INR',
  'CNY',
  'TWD',
  'RUB',
  'PLN',
  'TRY',
  'EGP',
  'IRR',
  'ILS',
  'THB',
  'KRW',
  'BRL',
  'MXN',
  'PTE',
  'CVE',
  'XAF',
  'MMK',
  'BDT',
  'TZS',
  'RSD',
  'BAM',
  'AZN',
  'BAD',
  'XXQ',
  'SEK',
  'HUF',
  'ISK',
  'XAU',
];

// ---------------------------------------------------------------------------------------------
// Foundation
// ---------------------------------------------------------------------------------------------

const foundation = (add: (fn: string, args: unknown[], f: () => unknown) => void): void => {
  const r = random(0x5eed);
  const en = load('en');
  const paths = arrowPaths(en.schema);
  const vectors = paths.filter((p) => p.arrow.kind === 'vector');
  const fields = paths.filter((p) => p.arrow.kind === 'field');
  const digits = paths.filter((p) => p.arrow.kind === 'digits');
  const byPath = (path: string): any => paths.find((p) => p.path === path)!.arrow;

  add('checksumIndices', [VERSION], () =>
    checksumIndices(VERSION, buildOrigin(JSON.parse(JSON.stringify(config))).indices),
  );
  add('checksumIndices', ['1.2.3'], () =>
    checksumIndices('1.2.3', buildOrigin(JSON.parse(JSON.stringify(config))).indices),
  );

  for (const id of [
    ...LOCALES,
    'fr-US',
    'ja-US',
    'ar-001',
    'zh-Hant-SG',
    'en-Latn-GB-u-nu-arab-x-foo',
  ]) {
    add('loadLocale', [id], () => {
      const d = load(id);
      return {
        id: d.id,
        language: d.language,
        region: d.region,
        languageRegion: d.languageRegion,
        languageScript: d.languageScript,
        calendarSystem: d.calendarSystem,
        numberSystem: d.numberSystem,
        locale: { id: d.locale.id, tag: tagCompact(d.locale.tag) },
      };
    });
  }

  for (const id of [
    'en',
    'en-US',
    'en_GB',
    'zh-TW',
    'sr-Latn',
    'und',
    '',
    'x-foo',
    'iw',
    'tl-PH',
    'no',
  ]) {
    add('resolveLocale', [id], () => {
      const l = resolveLocale(id);
      return { id: l.id, tag: tagCompact(l.tag) };
    });
  }

  add('availableLocales', [], () => availableLocales().map((l) => [l.id, tagCompact(l.tag)]));

  // Raw string table reads, including the region exception offsets.
  for (const id of LOCALES) {
    const d = load(id);
    const offsets: number[] = [];
    const idx = d.index ? Object.keys(d.index).map(Number) : [];
    for (let i = 0; i < 12; i++) {
      offsets.push(r.int(0, d.strings.length - 1));
    }
    for (let i = 0; i < 12 && idx.length > 0; i++) {
      offsets.push(r.pick(idx));
    }
    offsets.push(d.strings.length, d.strings.length + 1000);
    add('bundleGet', [id, offsets], () =>
      offsets.map((o) =>
        d.index && d.index[o] !== undefined ? d.exceptions[d.index[o]] || '' : d.strings[o] || '',
      ),
    );
  }

  // Fields: all of them for a few locales.
  for (const id of ['en', 'ar-EG', 'sr-Latn-BA', 'zh-Hant-HK', 'de-CH', 'my']) {
    const d = load(id);
    add('fieldGet', [id, fields.map((p) => p.path)], () => fields.map((p) => fieldGet(p.arrow, d)));
  }

  // Vector existence for every vector, a few locales.
  for (const id of ['en', 'ar', 'hi', 'ja', 'pt-PT']) {
    const d = load(id);
    add('vectorExists', [id, vectors.map((p) => p.path)], () =>
      vectors.map((p) => vectorExists(p.arrow, d)),
    );
  }

  // Small vectors as mappings; random lookups in all of them.
  const small = vectors.filter((p) => vectorSize(p.arrow) <= 200);
  for (const id of LOCALES) {
    const d = load(id);
    for (let i = 0; i < 6; i++) {
      const p = r.pick(small);
      add('vectorMapping', [id, p.path], () => vectorMapping(p.arrow, d));
    }
    for (let i = 0; i < 10; i++) {
      const p = r.pick(vectors);
      const keys = p.arrow.keysets.map((ks: any) => {
        const one = (): string =>
          r.next() < 0.1 || ks.keys.length === 0 ? 'bogus' : r.pick(ks.keys);
        return r.next() < 0.25 ? [one(), one(), one()] : one();
      });
      add('vectorGet', [id, p.path, keys], () => vectorGet(p.arrow, d, ...keys));
    }
  }
  for (const id of ['en', 'pt-PT', 'ar', 'ja']) {
    const d = load(id);
    for (const code of ['USD', 'EUR', 'PTE', 'XXQ', 'BAD']) {
      for (const keys of [
        [['narrow', 'none'], code],
        [['bogus', 'none'], code],
        [
          ['short', 'bogus'],
          [code, 'USD'],
        ],
        [[], code],
      ]) {
        add('vectorGet', [id, 'Currencies.symbol', keys], () =>
          vectorGet(byPath('Currencies.symbol'), d, ...keys),
        );
      }
    }
  }
  for (const keys of [
    ['none', 'USD'],
    [['narrow', 'none'], 'XXQ'],
    [['bogus', 'none'], 'EUR'],
    [['none', 'bogus'], 'EUR'],
    ['none', ['XXQ', 'EUR']],
    [[], 'USD'],
  ]) {
    add('vectorValid', ['Currencies.symbol', keys], () =>
      vectorValid(byPath('Currencies.symbol'), ...keys),
    );
  }

  // Compact pattern digits.
  for (const id of ['en', 'de', 'ja', 'hi', 'ar', 'sw', 'ko', 'es-MX']) {
    const d = load(id);
    for (let i = 0; i < 10; i++) {
      const p = r.pick(digits);
      const key = r.pick(['other', 'one', 'few', 'many', 'zero', 'two', 'bogus']);
      const n = r.pick([0, 1, 2, 4, 5, 7, 9, 12, 15, 16, 30, 2.5, -1]);
      add('digitsGet', [id, p.path, key, n], () => digitsGet(p.arrow, d, key as any, n));
    }
  }

  for (const key of ['latn', 'arab', 'hanidec', 'bogus', 'thai']) {
    add(
      'scopeGet',
      ['Numbers.numberSystem', key],
      () => scopeGet(en.schema.Numbers.numberSystem, key as any) !== undefined,
    );
  }

  for (const name of Object.keys(en.indices)) {
    const ki = en.indices[name];
    const keys =
      ki.keys.length > 0
        ? [ki.keys[0], ki.keys[ki.keys.length - 1], r.pick(ki.keys), 'bogus']
        : ['bogus'];
    add('keyIndexGet', [name, keys], () => keys.map((k) => keyIndexGet(ki, k)));
  }

  // Patterns.
  const wrappers = [
    '{0} {1}',
    '{1} at {0}',
    "'{0}'",
    '{ }',
    '{a}',
    '{10}',
    'x{0}y{1}z',
    '',
    '{',
    '}',
    "it's {0}",
    '{0} {1}',
    '{ }',
    '{١}',
    '{0',
    'abc',
    '{0}{0}{1}',
  ];
  for (const w of wrappers) {
    add('parseWrapperPattern', [w], () => parseWrapperPattern(w));
    add('formatWrapper', [w, ['A', 'B']], () => formatWrapper(w, ['A', 'B']));
  }

  const patterns = new Set<string>([
    '#,##0.###',
    '#,##,##0.###',
    '#,##0.00;(#,##0.00)',
    '0.00E0',
    '#E0',
    '¤#,##0.00',
    '¤ #,##0.00',
    '#,##0.00 ¤',
    '#,##0%',
    "'abc'#",
    "'unterminated",
    "#'#'",
    '0',
    '000',
    '#,##0.00¤;-#,##0.00¤;x',
    '+#;-#',
    '0K',
    '00 thousand',
    '',
    ';',
    '#;',
    '¤',
    "'''#",
    '#,#,##0',
    '0.###E+0',
    '#,##0.0#',
  ]);
  for (const id of ['en', 'ar', 'fa', 'hi', 'de-CH', 'my', 'sw', 'he']) {
    const d = load(id);
    for (const p of paths) {
      if (p.arrow.kind === 'field' && /Format|standard|accounting/.test(p.path)) {
        const v = fieldGet(p.arrow, d);
        if (v) patterns.add(v);
      }
    }
  }
  for (const p of Array.from(patterns)) {
    add('parseNumberPattern', [p], () => parseNumberPattern(p));
  }

  // Numbering systems.
  for (const id of ['en', 'ar', 'hi', 'fa', 'bn', 'my', 'th', 'zh', 'de-CH', 'en-IN']) {
    const d = load(id);
    for (const nu of ['latn', 'native', 'arab', 'hanidec', 'mathbold']) {
      for (let i = 0; i < 3; i++) {
        const n = randomNumber(r);
        const group = r.next() < 0.5;
        const minInt = r.int(0, 4);
        add('numberingFormatString', [id, nu, n, group, minInt], () =>
          numberingFormatString(getNumberParams(d, nu as any).system, n, group, minInt),
        );
        const k = r.int(-99999, 999999);
        add('numberingFormatString', [id, nu, k, group, minInt], () =>
          numberingFormatString(getNumberParams(d, nu as any).system, k, group, minInt),
        );
      }
    }
  }
  for (const [n, nu, minInt] of [
    ['123', 'latn', 0],
    ['-45', 'arab', 4],
    ['1.5e3', 'deva', 2],
    ['', 'thai', 3],
    ['9', 'mathbold', 2],
  ] as const) {
    add('fastFormatDecimal', [n, nu, minInt], () =>
      fastFormatDecimal(n, getNumberParams(load('en'), nu as any).digits, minInt),
    );
  }

  for (const id of LOCALES) {
    for (const [nu, def] of [
      [undefined, undefined],
      [r.pick(['native', 'finance', 'traditional']), undefined],
      ['bogus', 'finance'],
      [r.pick(SYSTEMS), undefined],
    ]) {
      add('getNumberParams', [id, nu ?? null, def ?? null], () => {
        const p = getNumberParams(load(id), nu as any, def as any);
        return {
          numberSystemName: p.numberSystemName,
          digits: p.digits.join(''),
          latinDigits: p.latinDigits.join(''),
          symbols: p.symbols,
          minimumGroupingDigits: p.minimumGroupingDigits,
          primaryGroupingSize: p.primaryGroupingSize,
          secondaryGroupingSize: p.secondaryGroupingSize,
          currencySpacing: p.currencySpacing,
          system: p.system.name,
          latnSystem: p.latnSystem.name,
        };
      });
    }
  }

  for (const code of [...CURRENCIES, 'ADP', 'UYW', 'CLP', '']) {
    add('getCurrencyFractions', [code], () => getCurrencyFractions(code));
  }
  for (const region of ['US', 'GB', 'DE', 'JP', 'ZZ', 'XX', 'AC', 'PS', 'CH', 'IN', '']) {
    add('getCurrencyForRegion', [region], () => getCurrencyForRegion(region));
  }

  // Context transforms and lists.
  for (const id of ['en', 'de', 'fr', 'es', 'ru', 'pl', 'sr', 'tr', 'pt']) {
    const d = load(id);
    for (const value of ['dollar', 'ßeta', 'éclair', 'доллар', 'ǆ', '𝐀bc', '']) {
      for (const context of [
        'begin-sentence',
        'middle-of-text',
        'standalone',
        'ui-list-or-menu',
        undefined,
      ]) {
        const field = r.pick([
          'currencyName',
          'languages',
          'relative',
          'calendar-field',
          'bogus',
          undefined,
        ]);
        add('contextTransform', [id, value, context ?? null, field ?? null], () =>
          contextTransform(value, getContextTransformInfo(d), context as any, field as any),
        );
      }
    }
  }
  for (const id of ['en', 'de', 'ar', 'ja', 'he', 'sr-Latn']) {
    for (const type of ['and', 'and-short', 'or', 'unit-long', 'unit-narrow', 'unit-short']) {
      for (const items of [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']]) {
        add('formatListValue', [id, items, type], () =>
          formatListValue(load(id), stringValue(), items, type as any),
        );
      }
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Numbers and currencies
// ---------------------------------------------------------------------------------------------

const numbers = (add: (fn: string, args: unknown[], f: () => unknown) => void): void => {
  const r = random(0xc0ffee);

  const decimal = (id: string, n: string, o: any, parts = false): void => {
    if (parts) {
      add('formatDecimalToParts', [id, n, o], () => formatDecimalToParts(load(id), n, o));
    } else {
      add('formatDecimal', [id, n, o], () => formatDecimal(load(id), n, o));
    }
  };
  const currency = (id: string, n: string, code: string, o: any, parts = false): void => {
    if (parts) {
      add('formatCurrencyToParts', [id, n, code, o], () =>
        formatCurrencyToParts(load(id), n, code as any, o),
      );
    } else {
      add('formatCurrency', [id, n, code, o], () => formatCurrency(load(id), n, code as any, o));
    }
  };

  // Fixed cases from the TypeScript tests.
  const fixedDecimal: [string, any][] = [
    ['-0.00', { minimumFractionDigits: 2 }],
    ['-0.00', { minimumFractionDigits: 2, negativeZero: true }],
    ['-0.00', { negativeZero: true }],
    ['-0.00', { trimZeroFractions: true }],
    ['-0.00', {}],
    ['-0.00012345', { style: 'scientific', minimumSignificantDigits: 3 }],
    ['-0.998', { round: 'ceiling', maximumFractionDigits: 0 }],
    ['-0.998', { round: 'ceiling', maximumFractionDigits: 2 }],
    ['-0.999', { style: 'long' }],
    ['-0.999', { style: 'long', maximumFractionDigits: 0, round: 'ceiling' }],
    ['-0.999', { style: 'long', maximumFractionDigits: 1, round: 'ceiling' }],
    ['-0', { style: 'scientific' }],
    ['-0', { style: 'scientific', negativeZero: false }],
    ['-1.234', { style: 'permille-scaled' }],
    ['-1.234', { style: 'permille' }],
    ['-1.234567', { style: 'scientific', minimumSignificantDigits: 4 }],
    ['0.998', { round: 'floor', maximumFractionDigits: 0 }],
    ['0.999', { style: 'short' }],
    ['1.234', { style: 'percent', minimumFractionDigits: 1 }],
    ['1.234', { style: 'percent-scaled', minimumFractionDigits: 2 }],
    ['1.234567', { style: 'short', minimumFractionDigits: 2 }],
    ['1000000000', { style: 'scientific', nu: 'beng' }],
    ['1000000000', { style: 'short', minimumFractionDigits: 1 }],
    ['10000000000000000', { style: 'long', group: true }],
    ['100599.99', { maximumSignificantDigits: 3, round: 'half-even' }],
    ['101599.99', { maximumSignificantDigits: 3 }],
    ['999999', { style: 'short' }],
    ['999999', { style: 'long' }],
    ['999950', { style: 'short' }],
    ['99999', { style: 'short', maximumFractionDigits: 1 }],
    ['1234567', { style: 'short', divisor: 1000 }],
    ['1234567', { style: 'short', divisor: 1000000, minimumIntegerDigits: 3 }],
    ['1234567', { style: 'long', divisor: 5000 }],
    ['1234567', { style: 'short', divisor: 1e20 }],
    ['NaN', {}],
    ['Infinity', {}],
    ['-Infinity', {}],
    ['NaN', { errors: ['nan'] }],
    ['Infinity', { errors: ['infinity'] }],
    ['-Infinity', { errors: ['nan'] }],
    ['12345.6789', { style: 'bogus' }],
    ['1e21', {}],
    ['1.5', { minimumIntegerDigits: 3, group: false }],
    ['123456789', { nu: 'bogus' }],
    ['123456789', { nu: 'native' }],
    ['123456789', { nu: 'traditional' }],
  ];
  for (const id of ['en', 'de', 'ar', 'hi', 'bn', 'my', 'he']) {
    for (const [n, o] of fixedDecimal) {
      decimal(id, n, o);
    }
  }
  for (const [n, o] of fixedDecimal) {
    decimal('en', n, o, true);
    decimal('ar', n, o, true);
  }

  const fixedCurrency: [string, string, any][] = [
    ['-12345.6789', 'EUR', { group: false }],
    ['-12345', 'USD', { style: 'accounting' }],
    ['-12345', 'USD', { style: 'accounting', nu: 'arab' }],
    ['0', 'AZN', {}],
    ['1', 'GBP', { style: 'code' }],
    ['10.00', 'USD', { trimZeroFractions: true }],
    ['10.1', 'CLF', { trimZeroFractions: true }],
    ['10.10000', 'BHD', { trimZeroFractions: true }],
    ['12345.67', 'CAD', { cash: true }],
    ['12345.67', 'CAD', { cash: true, round: 'down' }],
    ['12345.67', 'DKK', { cash: true }],
    ['12345.76', 'DKK', { cash: true, round: 'down' }],
    ['12345.99', 'CAD', { cash: true }],
    ['12345', 'USD', { style: 'code', nu: 'arab' }],
    ['12345', 'USD', { style: 'name', nu: 'arab' }],
    ['12345', 'USD', { style: 'short', nu: 'arab' }],
    ['123456789', 'USD', { style: 'code', nu: 'deva' }],
    ['9.9999', 'BHD', { trimZeroFractions: true }],
    ['9.9999', 'USD', { minimumFractionDigits: 2, trimZeroFractions: true }],
    ['1', 'PTE', {}],
    ['100.5', 'CHF', {}],
    ['100.5', 'CVE', {}],
    ['10689.5', 'PTE', { group: true }],
    ['12345.234', 'XXQ', {}],
    ['12345.234', 'BAD', { nu: 'native' }],
    ['999999.987', 'USD', { style: 'short' }],
    ['999000.00', 'USD', { style: 'short' }],
    ['0.9999', 'USD', { style: 'short' }],
    ['1234567', 'EUR', { style: 'short', divisor: 1000 }],
    ['1', 'USD', { style: 'name' }],
    ['2', 'RUB', { style: 'name' }],
    ['5', 'PLN', { style: 'name' }],
    ['1.5', 'EUR', { style: 'name' }],
    ['12345.6', 'JPY', { symbolWidth: 'narrow' }],
    ['12345.6', 'TWD', { symbolWidth: 'narrow' }],
    ['NaN', 'USD', {}],
    ['Infinity', 'USD', {}],
    ['-12345.6', 'USD', { style: 'bogus' }],
  ];
  for (const id of [
    'en',
    'en-IN',
    'de-CH',
    'fr',
    'pt-PT',
    'ar',
    'fa',
    'hi',
    'zh-Hant-TW',
    'ru',
    'pl',
    'sr-Latn',
    'my',
    'he',
    'bn',
    'sw',
  ]) {
    for (const [n, code, o] of fixedCurrency) {
      currency(id, n, code, o);
    }
  }
  for (const [n, code, o] of fixedCurrency) {
    currency('en', n, code, o, true);
    currency('fr', n, code, o, true);
    currency('ar', n, code, o, true);
  }

  // Compact styles over powers of ten.
  for (const id of ['en', 'de', 'ja', 'hi', 'ar', 'es', 'ko', 'zh', 'ru', 'my', 'sw', 'tr']) {
    for (let e = 0; e <= 16; e++) {
      let n = String(r.int(1, 9));
      for (let i = 0; i < e; i++) {
        n += r.next() < 0.5 ? '9' : String(r.int(0, 9));
      }
      decimal(id, `${n}.${r.int(0, 9)}`, { style: r.pick(['short', 'long']) });
      currency(id, '9'.repeat(e + 1), 'EUR', { style: 'short' });
    }
  }

  // Random formatting.
  for (let i = 0; i < 1300; i++) {
    const id = r.pick(LOCALES);
    const n = randomNumber(r);
    const o = randomNumberOptions(r, (x) => {
      x.style = r.pick(DECIMAL_STYLES);
      if (r.next() < 0.1) x.negativeZero = r.next() < 0.5;
      if (r.next() < 0.08 && (x.style === 'short' || x.style === 'long'))
        x.divisor = r.pick(DIVISORS);
    });
    decimal(id, n, o, r.next() < 0.25);
  }
  for (let i = 0; i < 1300; i++) {
    const id = r.pick(LOCALES);
    const n = randomNumber(r);
    const o = randomNumberOptions(r, (x) => {
      x.style = r.pick(CURRENCY_STYLES);
      if (r.next() < 0.15) x.cash = true;
      if (r.next() < 0.2) x.symbolWidth = 'narrow';
      if (r.next() < 0.05 && x.style === 'short') x.divisor = r.pick(DIVISORS);
    });
    currency(id, n, r.pick(CURRENCIES), o, r.next() < 0.25);
  }

  // Names, symbols, plurals.
  for (const id of LOCALES) {
    const d = load(id);
    for (const code of [r.pick(CURRENCIES), r.pick(CURRENCIES), 'USD', 'XXQ']) {
      add('getCurrencySymbol', [id, code, null], () => getCurrencySymbol(d, code as any));
      add('getCurrencySymbol', [id, code, 'narrow'], () =>
        getCurrencySymbol(d, code as any, 'narrow'),
      );
      const context = r.pick([
        'begin-sentence',
        'middle-of-text',
        'standalone',
        'ui-list-or-menu',
        undefined,
      ]);
      const o = context ? { context } : undefined;
      add('getCurrencyDisplayName', [id, code, o ?? null], () =>
        getCurrencyDisplayName(d, code as any, o as any),
      );
      const n = randomNumber(r);
      add('getCurrencyPluralName', [id, n, code, o ?? null], () =>
        getCurrencyPluralName(d, n, code, o as any),
      );
    }
    for (let i = 0; i < 5; i++) {
      const n = randomNumber(r);
      const o =
        r.next() < 0.4
          ? {
              round: r.pick(ROUNDING),
              maximumFractionDigits: r.int(0, 3),
              minimumFractionDigits: r.int(0, 2),
            }
          : undefined;
      add('getPluralCardinal', [id, n, o ?? null], () => getPluralCardinal(d, n, o as any));
      add('getPluralOrdinal', [id, n, o ?? null], () => getPluralOrdinal(d, n, o as any));
    }
  }
  for (let i = 0; i < 150; i++) {
    const n = randomNumber(r);
    const o = randomNumberOptions(r, () => undefined);
    delete o.nu;
    delete o.group;
    delete o.trimZeroFractions;
    add('adjustDecimal', ['en', n, o], () => decimalToString(adjustDecimal(load('en'), n, o)));
  }
};

export const cases = (): ConformanceCase[] => {
  const { cases: out, add } = collector();
  foundation(add);
  numbers(add);
  return out;
};
