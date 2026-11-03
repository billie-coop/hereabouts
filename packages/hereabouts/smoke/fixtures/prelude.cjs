const fs = require('node:fs');
const packs = require.resolve('@billie-coop/hereabouts/packs/en.json').replace(/en\.json$/, '');
globalThis.loadPack = (l) => fs.readFileSync(packs + l + '.json', 'utf8');
