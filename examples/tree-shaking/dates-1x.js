// 1.x: the same date formatting through the 1.x API.
import { CLDRFramework } from '@phensley/cldr';

const cldr = new CLDRFramework({ loader: (language) => globalThis.loadPack(language) }).get('en');

const date = { date: Date.UTC(2026, 10, 1, 15, 30), zoneId: 'America/New_York' };
console.log(cldr.Calendars.formatDate(date, { datetime: 'long' }));
console.log(cldr.Calendars.formatDate(date, { skeleton: 'yMMMEd' }));
