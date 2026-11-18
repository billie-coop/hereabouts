/**
 * Cases for unit quantity formatting (`core/api/units.ts`).
 */
import {
  availableUnits,
  formatQuantity,
  formatQuantitySequence,
  formatQuantitySequenceToParts,
  formatQuantityToParts,
  getUnitDisplayName,
} from '../../src/core';
import { LOCALES, load } from './_core';
import { type ConformanceCase, collector, type Random, random } from './_shared';

const LENGTHS = ['long', 'short', 'narrow'];
const STYLES = ['decimal', 'short', 'long', 'scientific'];
const SYSTEMS = ['latn', 'arab', 'deva', 'beng', 'native', 'finance', 'bogus'];

const randomNumber = (r: Random): string => {
  if (r.next() < 0.2) {
    return r.pick([
      '0',
      '1',
      '-1',
      '1.0',
      '2',
      '3',
      '5',
      '11',
      '21',
      '0.5',
      '1.5',
      '100',
      '1000000',
    ]);
  }
  const neg = r.next() < 0.2 ? '-' : '';
  let s = String(r.int(1, 9));
  const n = r.int(0, 8);
  for (let i = 0; i < n; i++) {
    s += r.int(0, 9);
  }
  if (r.next() < 0.5) {
    s += `.${r.int(0, 999)}`;
  }
  return neg + s;
};

const randomOptions = (r: Random): any => {
  const o: any = {};
  if (r.next() < 0.6) o.length = r.pick(LENGTHS);
  if (r.next() < 0.3) o.style = r.pick(STYLES);
  if (r.next() < 0.15) o.nu = r.pick(SYSTEMS);
  if (r.next() < 0.2) o.maximumFractionDigits = r.int(0, 3);
  if (r.next() < 0.1) o.minimumFractionDigits = r.int(0, 3);
  if (r.next() < 0.1) o.maximumSignificantDigits = r.int(1, 4);
  if (r.next() < 0.1) o.group = r.next() < 0.5;
  if (r.next() < 0.1) o.round = r.pick(['half-even', 'up', 'down', 'floor']);
  if (r.next() < 0.05) o.divisor = r.pick([1000, 1000000]);
  if (r.next() < 0.05) o.trimZeroFractions = true;
  return Object.keys(o).length === 0 && r.next() < 0.5 ? null : o;
};

export const cases = (): ConformanceCase[] => {
  const { cases: out, add } = collector();
  const r = random(0x0417);
  const units = availableUnits(load('en'));
  const quantity = (): any => {
    const q: any = { value: randomNumber(r) };
    if (r.next() < 0.95) q.unit = r.pick(units);
    const k = r.next();
    if (k < 0.15) q.per = r.pick(units);
    else if (k < 0.25) q.times = r.pick(units);
    return q;
  };

  add('availableUnits', ['en'], () => availableUnits(load('en')));

  for (const id of LOCALES) {
    const d = load(id);
    for (let i = 0; i < 8; i++) {
      const unit = r.next() < 0.05 ? 'bogus' : r.pick(units);
      const length = r.next() < 0.25 ? null : r.pick(LENGTHS);
      add('getUnitDisplayName', [id, unit, length], () =>
        getUnitDisplayName(d, unit as any, (length ?? undefined) as any),
      );
    }
  }

  // Fixed cases from the TypeScript tests.
  const fixed: [any, any][] = [
    [{ value: '12345.6789', unit: 'kilogram', per: 'second' }, null],
    [{ value: '17.9887', unit: 'terabit', per: 'minute' }, null],
    [{ value: '30.7899', unit: 'kilogram', per: 'lux' }, null],
    [{ value: '1', unit: 'newton', times: 'meter' }, null],
    [{ value: '123', unit: 'newton', times: 'meter' }, null],
    [{ value: '1', unit: 'foot', times: 'pound' }, { length: 'short' }],
    [{ value: '123', unit: 'meter', times: 'kilogram' }, { length: 'narrow' }],
    [{ value: '1', unit: 'meter', per: 'second' }, { length: 'narrow' }],
    [{ value: '1.5', unit: 'meter', per: 'second' }, { length: 'short' }],
    [
      { value: '12345678', unit: 'byte' },
      { style: 'long', length: 'short' },
    ],
    [{ value: '1', unit: 'g-force' }, null],
    [{ value: '3' }, null],
    [{ value: '3', per: 'second' }, null],
    [{ value: '2', unit: 'hour', per: 'hour' }, null],
    [{ value: '0.25', unit: 'mile', per: 'gallon' }, { length: 'long' }],
    [{ value: '-0', unit: 'celsius' }, { style: 'scientific' }],
    [{ value: '1', unit: 'bogus' }, null],
    [{ value: '5', unit: 'meter', per: 'bogus' }, null],
  ];
  for (const id of [
    'en',
    'de',
    'fr',
    'es',
    'ar',
    'fa',
    'he',
    'hi',
    'ja',
    'zh',
    'ko',
    'ru',
    'pl',
    'sr-Latn',
    'tr',
    'sw',
    'my',
    'pt-PT',
    'bn',
    'th',
  ]) {
    for (const [q, o] of fixed) {
      add('formatQuantity', [id, q, o], () => formatQuantity(load(id), q, o ?? undefined));
    }
  }
  for (const [q, o] of fixed) {
    add('formatQuantityToParts', ['en', q, o], () =>
      formatQuantityToParts(load('en'), q, o ?? undefined),
    );
    add('formatQuantityToParts', ['ar', q, o], () =>
      formatQuantityToParts(load('ar'), q, o ?? undefined),
    );
  }

  for (let i = 0; i < 2200; i++) {
    const id = r.pick(LOCALES);
    const q = quantity();
    const o = randomOptions(r);
    if (r.next() < 0.3) {
      add('formatQuantityToParts', [id, q, o], () =>
        formatQuantityToParts(load(id), q, o ?? undefined),
      );
    } else {
      add('formatQuantity', [id, q, o], () => formatQuantity(load(id), q, o ?? undefined));
    }
  }

  for (let i = 0; i < 400; i++) {
    const id = r.pick(LOCALES);
    const qs: any[] = [];
    const n = r.int(0, 4);
    for (let j = 0; j < n; j++) {
      qs.push(quantity());
    }
    const o = randomOptions(r);
    if (r.next() < 0.3) {
      add('formatQuantitySequenceToParts', [id, qs, o], () =>
        formatQuantitySequenceToParts(load(id), qs, o ?? undefined),
      );
    } else {
      add('formatQuantitySequence', [id, qs, o], () =>
        formatQuantitySequence(load(id), qs, o ?? undefined),
      );
    }
  }
  return out;
};
