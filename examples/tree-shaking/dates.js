// 2.x: date formatting only, using the functions directly.
import { createFramework, formatDate, loadLocale } from '@billie-coop/hereabouts';

const framework = createFramework({ loader: (language) => globalThis.loadPack(language) });
const en = loadLocale(framework, 'en');

const date = { date: Date.UTC(2026, 10, 1, 15, 30), zoneId: 'America/New_York' };
console.log(formatDate(en, date, { datetime: 'long' }));
console.log(formatDate(en, date, { skeleton: 'yMMMEd' }));
