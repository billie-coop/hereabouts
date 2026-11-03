import { createFramework, formatDecimal, loadLocale } from '@billie-coop/hereabouts';
import { decimal, decimalAdd, decimalToString } from '@billie-coop/hereabouts/decimal';

const de = loadLocale(createFramework({ loader: (l) => globalThis.loadPack(l) }), 'de-DE');
console.log(
  JSON.stringify([
    formatDecimal(de, '1234.567', { maximumFractionDigits: 2 }),
    decimalToString(decimalAdd(decimal('0.1'), '0.2')),
  ]),
);
