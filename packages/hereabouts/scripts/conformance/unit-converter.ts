/**
 * Builds the shared unit converter test cases in `conformance/unit-converter.json`.
 *
 * Factor sets are given as a table name ("LENGTH") or a list of definitions
 * `[src, factor, dst, offset?]`, where a factor or offset is a rational string or
 * `{ "rational": "n / d" }` (a Rational value rather than a string). Values to convert are
 * decimal strings.
 *
 * Batch cases keep the file small while covering every pair of units in every table:
 * - `unitFactorsGetPaths [table]`: the path of `unitFactorsGet` for each pair (units × units,
 *   in sorted order), or null.
 * - `convertUnitsAll [table, value]`: `convertUnits` of the value for each pair, or null.
 * - `converter [ops]`: a script of converter calls, with one result per call.
 */
import { decimal, type MathContext, type Rational, rational } from '../../src/decimal';
import type { UnitType } from '../../src/types';
import {
  convertUnits,
  createUnitConverter,
  type FactorDef,
  type UnitConverter,
  type UnitFactors,
  unitConverterAdd,
  unitConverterCategories,
  unitConverterFactors,
  unitConverterGet,
  unitConverterHas,
  unitFactors,
  unitFactorsGet,
} from '../../src/unit-converter';
import { TABLES } from '../zig/unit-converter';
import { type ConformanceCase, collector, type Random, random } from './_shared';

type JsonValue = string | { rational: string };
type JsonDef = [string, JsonValue, string, JsonValue?];
type JsonDefs = string | JsonDef[];

const TABLE: Record<string, readonly FactorDef[]> = Object.fromEntries(TABLES);

const value = (v: JsonValue): string | Rational =>
  typeof v === 'string' ? v : rational(v.rational);

const defs = (d: JsonDefs): FactorDef[] =>
  typeof d === 'string'
    ? [...TABLE[d]]
    : d.map(([src, f, dst, off]) => {
        const def: FactorDef = [src as UnitType, value(f), dst as UnitType];
        if (off !== undefined) {
          def.push(value(off));
        }
        return def;
      });

/** One factor set per distinct argument, so lookups share (and exercise) the graph cache. */
const SETS = new Map<string, UnitFactors>();
const factorSet = (d: JsonDefs): UnitFactors => {
  const key = JSON.stringify(d);
  let m = SETS.get(key);
  if (!m) {
    m = unitFactors(defs(d));
    SETS.set(key, m);
  }
  return m;
};

const ctxOf = (c: MathContext | null): MathContext | undefined => c ?? undefined;

/** Custom factor sets for the edge cases. */
const CUSTOM: Record<string, JsonDef[]> = {
  duplicate: [
    ['foo', '2', 'bar'],
    ['foo', '2', 'bar'],
  ],
  rationalValue: [['foo', { rational: '2 / 1' }, 'bar']],
  rationalOffset: [['foo', { rational: '3 / 7' }, 'bar', { rational: '1 / 3' }]],
  // an explicit reverse factor replaces the computed inverse, whichever comes first
  explicitAfter: [
    ['a', '2', 'b'],
    ['b', '0.4', 'a'],
  ],
  explicitBefore: [
    ['b', '0.4', 'a'],
    ['a', '2', 'b'],
  ],
  overwrite: [
    ['a', '2', 'b'],
    ['a', '3', 'b'],
  ],
  selfLoop: [
    ['a', '5', 'a'],
    ['a', '2', 'b'],
  ],
  chain: [
    ['a', '2', 'b'],
    ['b', '3', 'c'],
    ['c', '5', 'd'],
    ['d', '7', 'e'],
  ],
  affine: [
    ['x', '2', 'y', '3'],
    ['y', '5', 'z', '-1'],
    ['z', '1 / 3', 'w'],
  ],
  // offsets that cancel along the path: the composed conversion has no offset
  cancel: [
    ['x', '1', 'y', '3'],
    ['y', '1', 'z', '-3'],
  ],
  constants: [
    ['circle', 'pi', 'diameter'],
    ['growth', 'E', 'unit'],
    ['diameter', '1 / pi', 'unit'],
  ],
  cost: [
    ['a', '0.001', 'b'],
    ['b', '1000', 'c'],
    ['a', '1', 'c'],
    ['a', '7', 'd'],
    ['d', '1 / 7', 'c'],
  ],
  // costs tie: neighbors are visited in JavaScript's object key order, so array-index unit
  // names ("3", "5") come first in numeric order, then the rest in insertion order
  numericKeys: [
    ['x', '1', '5'],
    ['x', '1', '3'],
    ['5', '1', 'y'],
    ['3', '1', 'y'],
    ['x', '1', 'q'],
    ['q', '1', 'y'],
  ],
  insertionOrder: [
    ['x', '1', 'm'],
    ['x', '1', 'k'],
    ['m', '1', 'y'],
    ['k', '2', 'y'],
  ],
  // the path walk stops at the unit "" (a falsy string)
  emptyName: [
    ['', '2', 'a'],
    ['a', '3', 'b'],
  ],
  zero: [['a', '0', 'b']],
  specials: [
    ['a', 'NaN', 'b'],
    ['c', 'Infinity', 'd'],
    ['e', '-Infinity', 'f'],
  ],
  negative: [
    ['a', '-2', 'b', '-0'],
    ['b', '-0.5', 'c', '0.25'],
  ],
  badFactor: [
    ['a', '2', 'b'],
    ['b', 'abc', 'c'],
  ],
  badOffset: [['a', '2', 'b', '1..2']],
  emptyFactor: [['a', '', 'b']],
  disconnected: [
    ['a', '2', 'b'],
    ['c', '3', 'd'],
  ],
  unicode: [
    ['ｚ', '2', 'z'],
    ['😀', '3', 'z'],
    ['é', '5', 'z'],
    ['Z', '7', 'z'],
  ],
  empty: [],
};

const UNKNOWN = ['unknown', 'meter', 'kelvin', '', 'Meter'];

const VALUES = [
  '0',
  '1',
  '-1',
  '3',
  '1.5',
  '-40',
  '100',
  '491.67',
  '0.000001',
  '12345678901234567890.123456789',
  '-0',
  '1e-30',
  '7E+12',
  'NaN',
  'Infinity',
  '-Infinity',
];

const MODES = ['up', 'down', 'ceiling', 'floor', 'half-up', 'half-down', 'half-even'] as const;

const CONTEXTS: (MathContext | null)[] = [
  null,
  { precision: 7 },
  { precision: 3, round: 'down' },
  { scale: 2 },
  { scale: 0, round: 'half-up' },
  { scale: -2 },
  { precision: 40 },
  { precision: 0 },
];

const randomValue = (r: Random): string => {
  if (r.next() < 0.3) {
    return r.pick(VALUES);
  }
  const len = r.int(1, 25);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += String(r.int(0, 9));
  }
  if (r.next() < 0.6) {
    const p = r.int(0, len);
    s = `${s.slice(0, p)}.${s.slice(p)}`;
    if (s === '.') {
      s = '0';
    }
  }
  if (r.next() < 0.2) {
    s += `e${r.int(-15, 15)}`;
  }
  return (r.next() < 0.3 ? '-' : '') + s;
};

const randomContext = (r: Random): MathContext | null => {
  const x = r.next();
  if (x < 0.4) {
    return null;
  }
  const c: MathContext = x < 0.7 ? { precision: r.int(0, 40) } : { scale: r.int(-3, 20) };
  if (r.next() < 0.6) {
    c.round = r.pick(MODES);
  }
  return c;
};

const pickUnit = (r: Random, units: readonly string[]): string =>
  r.next() < 0.05 ? r.pick(UNKNOWN) : r.pick(units);

// ---------------------------------------------------------------------------
// Converter scripts
// ---------------------------------------------------------------------------

type Op =
  | ['create', [string, JsonDefs][]]
  | ['add', string, JsonDefs, boolean?]
  | ['has', string]
  | ['factors', string]
  | ['categories']
  | ['get', string, string, string]
  | ['convert', string, string, string, string, MathContext | null];

const runScript = (ops: Op[]): unknown[] => {
  let c: UnitConverter = createUnitConverter();
  const out: unknown[] = [];
  for (const op of ops) {
    try {
      switch (op[0]) {
        case 'create': {
          const cats: Record<string, UnitFactors> = {};
          for (const [name, d] of op[1]) {
            cats[name] = factorSet(d);
          }
          c = createUnitConverter(cats);
          out.push(null);
          break;
        }
        case 'add': {
          const next = unitConverterAdd(c, op[1], factorSet(op[2]));
          // keep=false checks the original converter is unchanged
          if (op[3] !== false) {
            c = next;
          }
          out.push(null);
          break;
        }
        case 'has':
          out.push(unitConverterHas(c, op[1]));
          break;
        case 'factors': {
          const f = unitConverterFactors(c, op[1]);
          out.push(f ? f.units : null);
          break;
        }
        case 'categories':
          out.push(unitConverterCategories(c));
          break;
        case 'get':
          out.push(unitConverterGet(c, op[1], op[2], op[3]) ?? null);
          break;
        case 'convert':
          out.push(convertUnits(c, op[1], decimal(op[2]), op[3], op[4], ctxOf(op[5])) ?? null);
          break;
      }
    } catch (e) {
      out.push({ error: (e as Error).message });
    }
  }
  return out;
};

const SCRIPTS: Op[][] = [
  // from the converter unit tests
  [
    ['add', 'angle', 'ANGLE'],
    ['has', 'angle'],
    ['has', 'acceleration'],
    ['add', 'angle', 'ANGLE'],
    ['add', 'acceleration', 'ACCELERATION'],
    ['has', 'acceleration'],
    ['factors', 'angle'],
    ['add', 'length', 'LENGTH'],
    ['categories'],
    ['get', 'angle', 'revolution', 'arc-minute'],
    ['get', 'angle', 'unknown', 'arc-minute'],
    ['get', 'unknown', 'arc-second', 'arc-minute'],
    ['convert', 'angle', '3', 'revolution', 'arc-minute', null],
    ['convert', 'angle', '3', 'revolution', 'unknown', null],
    ['convert', 'unknown', '3', 'revolution', 'revolution', null],
    ['get', 'unknown', 'a', 'a'],
    ['factors', 'unknown'],
  ],
  [
    ['add', 'angle', 'ANGLE'],
    ['add', 'angle-2', 'ANGLE'],
    ['has', 'angle'],
    ['get', 'angle', 'degree', 'arc-minute'],
    ['get', 'angle-2', 'degree', 'arc-minute'],
  ],
  // add returns a new converter; the original is unchanged
  [
    ['categories'],
    ['add', 'angle', 'ANGLE', false],
    ['categories'],
    ['has', 'angle'],
    ['add', 'angle', 'ANGLE'],
    ['categories'],
  ],
  [
    [
      'create',
      [
        ['length', 'LENGTH'],
        ['angle', 'ANGLE'],
      ],
    ],
    ['categories'],
    ['factors', 'angle'],
    ['convert', 'length', '1.5', 'mile', 'yard', null],
    ['convert', 'length', '3', 'foot', 'yard', { precision: 7 }],
    ['add', 'length', 'LENGTH'],
    ['add', '', 'TORQUE'],
    ['has', ''],
    ['categories'],
  ],
  // category names sort by UTF-16 code units, as JavaScript does
  [
    [
      'create',
      [
        ['ｚ', 'RATIO'],
        ['😀', 'RATIO'],
        ['Z', 'RATIO'],
        ['a', 'RATIO'],
        ['10', 'RATIO'],
        ['9', 'RATIO'],
        ['é', 'RATIO'],
      ],
    ],
    ['categories'],
    ['has', '😀'],
    ['convert', '😀', '50', 'percent', 'part', null],
  ],
  // errors thrown while building the graph
  [
    ['add', 'bad', CUSTOM.badFactor],
    ['get', 'bad', 'a', 'a'],
    ['get', 'bad', 'a', 'b'],
    ['convert', 'bad', '2', 'a', 'b', null],
    ['convert', 'bad', '2', 'c', 'c', null],
    ['factors', 'bad'],
  ],
  [
    ['add', 'temperature', 'TEMPERATURE'],
    ['convert', 'temperature', '0', 'celsius', 'fahrenheit', null],
    ['convert', 'temperature', '212', 'fahrenheit', 'celsius', null],
    ['convert', 'temperature', '212', 'fahrenheit', 'celsius', { scale: 5 }],
    ['get', 'temperature', 'kelvin', 'fahrenheit'],
    ['get', 'temperature', 'rankine', 'celsius'],
  ],
];

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const r = random(0x7e57);

  const tableNames = TABLES.map(([n]) => n);
  const customNames = Object.keys(CUSTOM);

  // unitFactors: the sorted units of every set
  for (const n of tableNames) {
    add('unitFactors', [n], () => unitFactors(defs(n)).units);
  }
  for (const n of customNames) {
    add('unitFactors', [CUSTOM[n]], () => unitFactors(defs(CUSTOM[n])).units);
  }

  // unitFactorsGet: every pair of every custom set, plus some unknown units
  for (const n of customNames) {
    const d = CUSTOM[n];
    const units = [...unitFactors(defs(d)).units, 'unknown'];
    for (const u of units) {
      for (const v of units) {
        add('unitFactorsGet', [d, u, v], () => unitFactorsGet(factorSet(d), u, v) ?? null);
      }
    }
  }

  // unitFactorsGet: fixed table lookups from the unit tests
  const FIXED_GETS: [string, string, string][] = [
    ['ACCELERATION', 'g-force', 'meter-per-square-second'],
    ['ACCELERATION', 'meter-per-square-second', 'g-force'],
    ['ANGLE', 'arc-second', 'arc-minute'],
    ['ANGLE', 'arc-minute', 'arc-second'],
    ['ANGLE', 'arc-second', 'degree'],
    ['ANGLE', 'degree', 'arc-second'],
    ['ANGLE', 'radian', 'degree'],
    ['AREA', 'acre', 'square-foot'],
    ['AREA', 'acre', 'square-inch'],
    ['AREA', 'square-inch', 'acre'],
    ['DURATION', 'century', 'year'],
    ['DURATION', 'century', 'second'],
    ['TEMPERATURE', 'celsius', 'kelvin'],
    ['TEMPERATURE', 'celsius', 'fahrenheit'],
    ['TEMPERATURE', 'kelvin', 'fahrenheit'],
    ['TEMPERATURE', 'fahrenheit', 'rankine'],
    ['TEMPERATURE', 'rankine', 'celsius'],
    ['TEMPERATURE', 'celsius', 'celsius'],
    ['ELECTRIC', 'volt', 'ohm'],
    ['SUBSTANCE', 'katal', 'item'],
    ['VOLUME', 'pint-imperial', 'pint'],
    ['VOLUME_UK', 'gallon', 'liter'],
    ['PRESSURE', 'millimeter-ofhg', 'pascal'],
    ['MASS', 'grain', 'pound'],
    ['LENGTH', 'parsec', 'meter'],
    ['LENGTH', 'unknown', 'unknown'],
    ['LENGTH', 'unknown', 'meter'],
    ['LENGTH', 'meter', 'kelvin'],
  ];
  for (const [t, u, v] of FIXED_GETS) {
    add('unitFactorsGet', [t, u, v], () => unitFactorsGet(factorSet(t), u, v) ?? null);
  }

  // unitFactorsGet: random pairs from the tables, with full factors and offsets
  for (let i = 0; i < 500; i++) {
    const t = r.pick(tableNames);
    const units = factorSet(t).units;
    const u = pickUnit(r, units);
    const v = pickUnit(r, units);
    add('unitFactorsGet', [t, u, v], () => unitFactorsGet(factorSet(t), u, v) ?? null);
  }

  // Every pair of every table: paths, and the conversion of one value
  for (const t of tableNames) {
    const m = factorSet(t);
    add('unitFactorsGetPaths', [t], () =>
      m.units.flatMap((u) => m.units.map((v) => unitFactorsGet(m, u, v)?.path ?? null)),
    );
  }
  const ALL_VALUES = ['12.345', '-0.5', '1', '0.1', '-3', '1e10', '2.5', '7', '1000', '-0.001'];
  tableNames.forEach((t, i) => {
    const n = ALL_VALUES[i % ALL_VALUES.length];
    const c = createUnitConverter({ [t]: factorSet(t) });
    const m = factorSet(t);
    add('convertUnitsAll', [t, n], () =>
      m.units.flatMap((u) => m.units.map((v) => convertUnits(c, t, decimal(n), u, v) ?? null)),
    );
  });

  // convertUnits: fixed values from the unit tests (temperature, CLDR coverage)
  const FIXED_CONVERTS: [JsonDefs, string, string, string, MathContext | null][] = [
    ['TEMPERATURE', '0', 'celsius', 'fahrenheit', null],
    ['TEMPERATURE', '100', 'celsius', 'fahrenheit', null],
    ['TEMPERATURE', '-40', 'celsius', 'fahrenheit', null],
    ['TEMPERATURE', '100', 'celsius', 'kelvin', null],
    ['TEMPERATURE', '0', 'kelvin', 'celsius', null],
    ['TEMPERATURE', '0', 'rankine', 'kelvin', null],
    ['TEMPERATURE', '300', 'kelvin', 'fahrenheit', null],
    ['TEMPERATURE', '491.67', 'rankine', 'kelvin', null],
    ['TEMPERATURE', '212', 'fahrenheit', 'celsius', null],
    ['TEMPERATURE', '32', 'fahrenheit', 'celsius', null],
    ['TEMPERATURE', '-459.67', 'fahrenheit', 'kelvin', { precision: 10 }],
    ['TEMPERATURE', '25', 'celsius', 'rankine', { scale: 3, round: 'half-even' }],
    ['LENGTH', '1.5', 'mile', 'yard', null],
    ['LENGTH', '3', 'foot', 'yard', { precision: 7 }],
    ['LENGTH', '1', 'earth-radius', 'kilometer', null],
    ['ANGLE', '3', 'revolution', 'arc-minute', null],
    ['ANGLE', '1', 'radian', 'degree', null],
    ['DURATION', '1', 'century', 'second', null],
    ['DURATION', '1', 'quarter', 'month', null],
    ['PRESSURE', '1', 'atmosphere', 'pascal', null],
    ['PRESSURE', '1', 'millimeter-ofhg', 'pascal', null],
    ['ENERGY', '1', 'british-thermal-unit', 'kilowatt-hour', null],
    ['MASS', '1', 'dalton', 'kilogram', null],
    ['VOLUME', '1', 'barrel', 'gallon', null],
    ['VOLUME_UK', '1', 'cup', 'milliliter', null],
    ['ELECTRIC', '2', 'ampere', 'milliampere', null],
    ['SUBSTANCE', '1', 'katal', 'item', null],
  ];
  for (const [d, n, u, v, ctx] of FIXED_CONVERTS) {
    add('convertUnits', [d, n, u, v, ctx], () => {
      const c = createUnitConverter({ x: factorSet(d) });
      return convertUnits(c, 'x', decimal(n), u, v, ctxOf(ctx)) ?? null;
    });
  }

  // convertUnits: custom sets, every pair, a few values and contexts
  for (const name of customNames) {
    const d = CUSTOM[name];
    const units = [...unitFactors(defs(d)).units, 'unknown'];
    for (const u of units) {
      for (const v of units) {
        const n = r.pick(VALUES);
        const ctx = r.pick(CONTEXTS);
        add('convertUnits', [d, n, u, v, ctx], () => {
          const c = createUnitConverter({ x: factorSet(d) });
          return convertUnits(c, 'x', decimal(n), u, v, ctxOf(ctx)) ?? null;
        });
      }
    }
  }

  // convertUnits: random tables, values and contexts
  for (let i = 0; i < 1200; i++) {
    const t = r.pick(tableNames);
    const units = factorSet(t).units;
    const u = pickUnit(r, units);
    const v = pickUnit(r, units);
    const n = randomValue(r);
    const ctx = randomContext(r);
    add('convertUnits', [t, n, u, v, ctx], () => {
      const c = createUnitConverter({ x: factorSet(t) });
      return convertUnits(c, 'x', decimal(n), u, v, ctxOf(ctx)) ?? null;
    });
  }

  for (const ops of SCRIPTS) {
    add('converter', [ops], () => runScript(ops));
  }

  return cases;
};
