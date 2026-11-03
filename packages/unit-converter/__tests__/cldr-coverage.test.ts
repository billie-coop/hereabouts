import {
  type Decimal,
  decimal,
  decimalAbs,
  decimalCompare,
  decimalIsZero,
  decimalMultiply,
  decimalSubtract,
  decimalToString,
  rational,
  rationalCompare,
  rationalMultiply,
} from '@phensley/decimal';
import {
  ACCELERATION,
  ANGLE,
  AREA,
  CONSUMPTION,
  convertUnits,
  createUnitConverter,
  DIGITAL,
  DIGITAL_DECIMAL,
  DURATION,
  ELECTRIC,
  ENERGY,
  type FactorDef,
  FORCE,
  FREQUENCY,
  GRAPHICS_PER,
  GRAPHICS_PIXEL,
  ILLUMINANCE,
  LENGTH,
  MASS,
  POWER,
  PRESSURE,
  RADIATION,
  RADIOACTIVITY,
  RATIO,
  SPEED,
  SUBSTANCE,
  TEMPERATURE,
  TORQUE,
  unitConverterAdd,
  unitConverterFactors,
  unitConverterGet,
  unitFactors,
  unitFactorsGet,
  VOLUME,
  VOLUME_UK,
} from '../src';

const CATEGORIES: [string, FactorDef[]][] = [
  ['acceleration', ACCELERATION],
  ['angle', ANGLE],
  ['area', AREA],
  ['consumption', CONSUMPTION],
  ['digital', DIGITAL],
  ['digital-decimal', DIGITAL_DECIMAL],
  ['duration', DURATION],
  ['electric', ELECTRIC],
  ['energy', ENERGY],
  ['force', FORCE],
  ['frequency', FREQUENCY],
  ['graphics-per', GRAPHICS_PER],
  ['graphics-pixel', GRAPHICS_PIXEL],
  ['illuminance', ILLUMINANCE],
  ['length', LENGTH],
  ['mass', MASS],
  ['power', POWER],
  ['pressure', PRESSURE],
  ['radiation', RADIATION],
  ['radioactivity', RADIOACTIVITY],
  ['ratio', RATIO],
  ['speed', SPEED],
  ['substance', SUBSTANCE],
  ['temperature', TEMPERATURE],
  ['torque', TORQUE],
  ['volume', VOLUME],
  ['volume-uk', VOLUME_UK],
];

const converter = () => {
  let c = createUnitConverter();
  for (const [cat, defs] of CATEGORIES) {
    c = unitConverterAdd(c, cat, unitFactors(defs));
  }
  return c;
};

const close = (d: Decimal, v: string) => {
  const target = decimal(v);
  const diff = decimalAbs(decimalSubtract(d, target));
  // relative tolerance (1e-12): catches wrong-magnitude and wrong-constant
  // bugs while absorbing finite-precision decimal rendering
  const scale = decimalIsZero(decimalAbs(target)) ? decimal(1) : decimalAbs(target);
  expect(decimalCompare(diff, decimalMultiply(scale, decimal('1e-12')))).toBeLessThan(0);
};

test('categories are closed within components and separated between them', () => {
  for (const [cat, defs] of CATEGORIES) {
    const adj = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
      if (!adj.has(a)) {
        adj.set(a, new Set());
      }
      adj.get(a)!.add(b);
      if (!adj.has(b)) {
        adj.set(b, new Set());
      }
      adj.get(b)!.add(a);
    };
    for (const [u, , v] of defs) {
      link(u, v);
    }
    // connected components over the direct edges
    const component = new Map<string, number>();
    let next = 0;
    for (const u of Array.from(adj.keys())) {
      if (component.has(u)) {
        continue;
      }
      const c = next++;
      const stack = [u];
      while (stack.length) {
        const n = stack.pop()!;
        if (component.has(n)) {
          continue;
        }
        component.set(n, c);
        for (const w of Array.from(adj.get(n)!)) {
          stack.push(w);
        }
      }
    }
    const map = unitFactors(defs);
    for (const u of map.units) {
      for (const v of map.units) {
        const connected = component.get(u) === component.get(v);
        expect({
          category: cat,
          from: u,
          to: v,
          connected,
          reachable: unitFactorsGet(map, u, v) !== undefined,
        }).toEqual({
          category: cat,
          from: u,
          to: v,
          connected,
          reachable: connected,
        });
      }
    }
  }
});

test('every CLDR unit dimension is registered in some category', () => {
  const c = converter();
  const expectUnit = (unit: string) => {
    const cats = CATEGORIES.filter(([cat]) => unitConverterFactors(c, cat)!.units.includes(unit));
    expect(cats.length).toBeGreaterThanOrEqual(1);
  };
  // the units called out in the F5 finding
  for (const u of [
    'celsius',
    'fahrenheit',
    'kelvin',
    'rankine',
    'atmosphere',
    'bar',
    'pascal',
    'electronvolt',
    'british-thermal-unit',
    'therm-us',
    'grain',
    'slug',
    'dalton',
    'earth-mass',
    'solar-mass',
    'barrel',
    'dram',
    'drop',
    'pinch',
    'dessert-spoon',
    'jigger',
    'quart-imperial',
    'pint-imperial',
    'volt',
    'ohm',
    'siemens',
    'coulomb',
    'farad',
    'henry',
    'tesla',
    'weber',
    'becquerel',
    'gray',
    'sievert',
    'katal',
    'lumen',
    'lux',
    'candela',
    'steradian',
    'cho',
    'ken',
    'koku',
    'shaku',
    'shaku-cloth',
    'shaku-length',
    'bu-jp',
    'se-jp',
    'dunam',
    'dot',
    'em',
    'item',
    'mole',
    'percent',
    'permille',
    'permyriad',
    'karat',
    'ofglucose',
    'chain',
    'rod',
    'furlong',
    'earth-radius',
    'solar-radius',
    'light-speed',
    'fortnight',
    'night',
    'day-person',
    'week-person',
    'month-person',
    'year-person',
    'decade',
    'quarter',
    'fun',
    'cup-imperial',
    'cup-metric',
    'cup-jp',
    'fluid-ounce-imperial',
    'fluid-ounce-metric',
    'pint-metric',
    'dessert-spoon-imperial',
    'gallon-imperial',
    'osaji',
    'kosaji',
    'sai',
    'to-jp',
    'jo-jp',
    'ri-jp',
    'rin',
    'sun',
    'gasoline-energy-density',
    'ofhg',
    'kilogram-force',
    'solar-luminosity',
  ]) {
    expectUnit(u);
  }
});

test('previously missing or wrong units convert per CLDR 48.2.0', () => {
  const c = converter();
  const cvt = (cat: string, src: string, dst: string) =>
    convertUnits(c, cat, decimal(1), src, dst)!;

  // pressure
  expect(decimalToString(cvt('pressure', 'atmosphere', 'pascal'))).toEqual('101325');
  expect(decimalToString(cvt('pressure', 'bar', 'pascal'))).toEqual('100000');
  expect(decimalToString(cvt('pressure', 'pascal', 'hectopascal'))).toEqual('0.01');
  expect(decimalToString(cvt('pressure', 'ofhg', 'pascal'))).toEqual('133.322387415');
  close(cvt('pressure', 'millimeter-ofhg', 'pascal'), '133.3223684210526315789473684');

  // energy (F5: calorie was 4.1868, foodcalorie was 4.184 — CLDR 48 is 4.184 / 4184)
  expect(decimalToString(cvt('energy', 'calorie', 'joule'))).toEqual('4.184');
  expect(decimalToString(cvt('energy', 'foodcalorie', 'joule'))).toEqual('4184');
  expect(decimalToString(cvt('energy', 'kilocalorie', 'joule'))).toEqual('4184');
  expect(decimalToString(cvt('energy', 'electronvolt', 'joule'))).toEqual(
    '0.0000000000000000001602177',
  );
  close(cvt('energy', 'british-thermal-unit', 'kilowatt-hour'), '0.000292875073469');
  close(cvt('energy', 'therm-us', 'kilowatt-hour'), '29.300111111111111');

  // mass
  close(cvt('mass', 'grain', 'pound'), '0.0001428571428571428571428571428');
  close(cvt('mass', 'slug', 'kilogram'), '14.593902937206365');
  expect(decimalToString(cvt('mass', 'dalton', 'kilogram'))).toEqual(
    '0.00000000000000000000000000166053878283',
  );
  close(cvt('mass', 'earth-mass', 'kilogram'), '5.9722e24');

  // volume
  expect(decimalToString(cvt('volume', 'barrel', 'gallon'))).toEqual('42');
  expect(decimalToString(cvt('volume', 'dram', 'fluid-ounce'))).toEqual('0.125');
  expect(decimalToString(cvt('volume', 'jigger', 'fluid-ounce'))).toEqual('1.5');
  close(cvt('volume', 'drop', 'fluid-ounce'), '0.0017361111111111111');
  close(cvt('volume', 'pint-imperial', 'pint'), '1.200949925504855');
  close(cvt('volume', 'koku', 'liter'), '180.3906836964688');
  expect(decimalToString(cvt('volume', 'tablespoon', 'fluid-ounce'))).toEqual('0.5');

  // length
  expect(decimalToString(cvt('length', 'chain', 'meter'))).toEqual('20.1168');
  close(cvt('length', 'shaku-length', 'meter'), '0.03305785123966942');
  close(cvt('length', 'parsec', 'meter'), '3.0856775814913673e16');
  close(cvt('length', 'earth-radius', 'kilometer'), '6378.1');

  // angle (CLDR's PI is the rational approximation 411557987/131002976,
  // which differs from true pi past the 10th digit)
  close(cvt('angle', 'arc-minute', 'degree'), '0.01666666666666666666666666666');
  close(cvt('angle', 'radian', 'degree'), '57.29577951308232052');
  expect(decimalToString(cvt('angle', 'steradian', 'steradian'))).toEqual('1');

  // duration
  expect(decimalToString(cvt('duration', 'fortnight', 'day'))).toEqual('14');
  close(cvt('duration', 'quarter', 'month'), '3');
  close(cvt('duration', 'day-person', 'month-person'), '0.03285488408386209');

  // ratio / substance
  expect(decimalToString(cvt('ratio', 'percent', 'part'))).toEqual('0.01');
  close(cvt('ratio', 'karat', 'part'), '0.04166666666666666666666666667');
  expect(decimalToString(cvt('substance', 'mole', 'item'))).toEqual('602214076000000000000000');
  // ofglucose and katal are singleton dimensions (no other unit shares their
  // base), so they are registered but only convertible to themselves
  expect(decimalToString(cvt('substance', 'ofglucose', 'ofglucose'))).toEqual('1');
  expect(convertUnits(c, 'substance', decimal(1), 'katal', 'item')).toBe(undefined);

  // speed
  expect(decimalToString(cvt('speed', 'light-speed', 'meter-per-second'))).toEqual('299792458');
});

test('hand-maintained and CLDR factors agree on shared edges', () => {
  const c = converter();
  const checks: [string, string, string, string][] = [
    ['energy', 'calorie', 'joule', '4.184'],
    ['force', 'pound-force', 'newton', '4.4482216152605'],
    ['power', 'horsepower', 'watt', '745.69987158227022'],
    ['mass', 'pound', 'kilogram', '45359237 / 100000000'],
    ['mass', 'gram', 'kilogram', '1 / 1000'],
    ['acceleration', 'g-force', 'meter-per-square-second', '9.80665'],
    ['length', 'light-year', 'meter', '9460730472580800'],
    ['length', 'astronomical-unit', 'meter', '149597870700'],
    ['length', 'nautical-mile', 'meter', '1852'],
    ['speed', 'knot', 'meter-per-second', '463 / 900'],
    ['area', 'hectare', 'square-meter', '10000'],
    ['digital', 'byte', 'bit', '8'],
    ['duration', 'minute', 'second', '60'],
    ['volume', 'gallon', 'cubic-meter', '0.003785411784'],
  ];
  for (const [cat, src, dst, expected] of checks) {
    const conv = unitConverterGet(c, cat, src, dst)!;
    const fac = conv.factors.reduce((p, f) => rationalMultiply(p, f), rational(1));
    expect({
      cat,
      src,
      dst,
      direct: conv.path.length === 2,
      equal: rationalCompare(fac, expected) === 0,
    }).toEqual({
      cat,
      src,
      dst,
      direct: true,
      equal: true,
    });
  }
});

test('nonlinear beaufort scale is intentionally not registered', () => {
  for (const [, defs] of CATEGORIES) {
    expect(defs.some((e) => e[0] === 'beaufort' || e[2] === 'beaufort')).toBe(false);
  }
});

test('electric units are registered but not mutually convertible', () => {
  const c = converter();
  expect(unitConverterFactors(c, 'electric')!.units).toEqual(
    expect.arrayContaining([
      'volt',
      'ohm',
      'siemens',
      'coulomb',
      'farad',
      'henry',
      'tesla',
      'weber',
      'ampere',
      'milliampere',
    ]),
  );
  expect(unitConverterGet(c, 'electric', 'volt', 'ohm')).toBe(undefined);
  expect(
    decimalToString(convertUnits(c, 'electric', decimal(2), 'ampere', 'milliampere')!),
  ).toEqual('2000');
});

test('volume UK variant localizes generic units without US leakage', () => {
  const c = converter();
  // UK gallon is the imperial gallon (4.54609 L), not the US gallon
  expect(decimalToString(convertUnits(c, 'volume-uk', decimal(1), 'gallon', 'liter')!)).toEqual(
    '4.54609',
  );
  expect(decimalToString(convertUnits(c, 'volume-uk', decimal(1), 'pint', 'liter')!)).toEqual(
    '0.56826125',
  );
  expect(decimalToString(convertUnits(c, 'volume-uk', decimal(1), 'cup', 'milliliter')!)).toEqual(
    '284.1',
  );
  // US category keeps the US values
  expect(decimalToString(convertUnits(c, 'volume', decimal(1), 'gallon', 'liter')!)).toEqual(
    '3.785411784',
  );
  expect(decimalToString(convertUnits(c, 'volume', decimal(1), 'pint', 'liter')!)).toEqual(
    '0.473176473',
  );
  // imperial-specific units convert in both
  close(convertUnits(c, 'volume', decimal(1), 'pint-imperial', 'liter')!, '0.56826125');
  close(convertUnits(c, 'volume-uk', decimal(1), 'pint-imperial', 'liter')!, '0.56826125');
});
