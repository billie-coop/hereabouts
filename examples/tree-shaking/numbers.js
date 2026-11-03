// 2.x: number formatting only, using the functions directly.
import { createFramework, formatCurrency, formatDecimal, loadLocale } from '@phensley/cldr';

const framework = createFramework({ loader: (language) => globalThis.loadPack(language) });
const en = loadLocale(framework, 'en');

console.log(formatDecimal(en, '1234567.891', { maximumFractionDigits: 2 }));
console.log(formatCurrency(en, '1234.5', 'EUR'));
