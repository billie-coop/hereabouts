import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  createFramework,
  formatDecimal,
  loadLocale,
  decimalAdd as rootAdd,
} from '@billie-coop/hereabouts';
import { decimal, decimalAdd, decimalToString } from '@billie-coop/hereabouts/decimal';
import { tzZoneIds } from '@billie-coop/hereabouts/timezone';

const packs = createRequire(import.meta.url)
  .resolve('@billie-coop/hereabouts/packs/en.json')
  .replace(/en\.json$/, '');
const de = loadLocale(
  createFramework({ loader: (l) => readFileSync(packs + l + '.json', 'utf8') }),
  'de-DE',
);
console.log(
  JSON.stringify([
    formatDecimal(de, '1234.567', { maximumFractionDigits: 2 }),
    decimalToString(decimalAdd(decimal('0.1'), '0.2')),
    rootAdd === decimalAdd,
    tzZoneIds().length > 300,
  ]),
);
