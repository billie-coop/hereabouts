// Bundles the ES module build (dist/esm/) into CommonJS entry points (dist/cjs/), one per
// export of package.json: dist/cjs/index.js for the root, dist/cjs/decimal.js for
// './decimal', and so on.
//
// All entries are built in one rollup run. Modules used by more than one entry go into shared
// chunks (dist/cjs/chunks/), so each module exists once: `setTimeZoneData` from
// './timezone' changes the data the root's `formatDate` reads, and caches aren't duplicated.
// Building each entry on its own would inline a separate copy of shared modules into each.
//
// Rollup emits plain `exports.name = name` assignments, and `externalLiveBindings: false`
// avoids getters for re-exports (tsc's CommonJS output reads every re-exported name through
// a getter, which made cross-module calls slower). Our exports are never reassigned, so
// copies behave the same as live bindings.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// { index: 'dist/esm/index.js', decimal: 'dist/esm/decimal/index.js', ... } from the export map
const input = {};
for (const [key, value] of Object.entries(pkg.exports)) {
  if (typeof value === 'object' && value.module) {
    const name = key === '.' ? 'index' : key.slice(2);
    input[name] = value.module;
  }
}

// Load each module together with its tsc source map, so the bundles' source maps point
// back to the TypeScript sources.
const loadSourceMaps = {
  name: 'load-source-maps',
  load(id) {
    if (!id.endsWith('.js')) {
      return null;
    }
    const code = readFileSync(id, 'utf8');
    const map = id + '.map';
    return existsSync(map) ? { code, map: readFileSync(map, 'utf8') } : code;
  },
};

export default {
  input,
  // tslib stays a dependency
  external: (id) => !id.startsWith('.') && !isAbsolute(id),
  plugins: [loadSourceMaps, resolve(), json({ preferConst: true })],
  onwarn(warning, warn) {
    // The sources have harmless import cycles (barrels importing each other's modules).
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      return;
    }
    warn(warning);
  },
  output: {
    dir: 'dist/cjs',
    format: 'cjs',
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name].js',
    exports: 'named',
    esModule: true,
    externalLiveBindings: false,
    freeze: false,
    generatedCode: 'es5',
    sourcemap: true,
  },
};
