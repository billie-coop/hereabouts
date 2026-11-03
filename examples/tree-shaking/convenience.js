// 2.x: the "batteries included" convenience object (pulls in everything, like 1.x).
import { cldrFramework } from '@phensley/cldr';

const cldr = cldrFramework({ loader: (language) => globalThis.loadPack(language) }).get('en');

console.log(cldr.Numbers.formatDecimal('1234567.891', { maximumFractionDigits: 2 }));
console.log(cldr.Numbers.formatCurrency('1234.5', 'EUR'));
