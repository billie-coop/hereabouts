const fs = require('node:fs');
const h = require('@billie-coop/hereabouts');
const { decimal, decimalAdd, decimalToString } = require('@billie-coop/hereabouts/decimal');
const { tzZoneIds } = require('@billie-coop/hereabouts/timezone');
const { convertUnits } = require('@billie-coop/hereabouts/unit-converter');
const packs = require.resolve('@billie-coop/hereabouts/packs/en.json').replace(/en\.json$/, '');
const fw = h.createFramework({ loader: (l) => fs.readFileSync(packs + l + '.json', 'utf8') });
const de = h.loadLocale(fw, 'de-DE');
console.log(
  JSON.stringify([
    h.formatDecimal(de, '1234.567', { maximumFractionDigits: 2 }),
    decimalToString(decimalAdd(decimal('0.1'), '0.2')),
    h.decimalAdd === decimalAdd,
    h.timeZoneIds() === tzZoneIds(),
    typeof convertUnits,
  ]),
);
