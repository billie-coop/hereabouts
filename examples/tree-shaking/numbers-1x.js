// 1.x: the same number formatting through the 1.x API.
import { CLDRFramework } from '@phensley/cldr';

const cldr = new CLDRFramework({ loader: (language) => globalThis.loadPack(language) }).get('en');

console.log(cldr.Numbers.formatDecimal('1234567.891', { maximumFractionDigits: 2 }));
console.log(cldr.Numbers.formatCurrency('1234.5', 'EUR'));
