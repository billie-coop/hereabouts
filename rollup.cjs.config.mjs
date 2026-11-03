// Bundles a package's ES module build (lib-es/) into a single CommonJS entry point
// (lib/index.js), replacing the one tsc emitted. Run from the package directory:
//
//   rollup -c ../../rollup.cjs.config.mjs
//
// Why: tsc's CommonJS output reads every name re-exported through an `export *` barrel via
// a getter function, so each call across modules or packages pays an extra call. Rollup
// emits plain `exports.name = name` assignments, and `externalLiveBindings: false` makes
// `export * from '@phensley/...'` copy the values instead of defining getters. Our exports
// are never reassigned, so copies behave the same as live bindings.
//
// The rest of lib/ (per-module .js files and the .d.ts declarations) is still emitted by
// tsc, so type declarations and deep imports such as '@phensley/cldr-core/lib/...' keep
// working. Deep imports load the per-module files, not the bundle.
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute } from 'path';

// Load each module together with its tsc source map, so the bundle's source map points
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
  input: 'lib-es/index.js',
  // Other packages (and tslib) stay external: only this package's own modules are bundled.
  external: (id) => !id.startsWith('.') && !isAbsolute(id),
  plugins: [loadSourceMaps, resolve(), json({ preferConst: true })],
  onwarn(warning, warn) {
    // Expected and harmless here:
    // - CIRCULAR_DEPENDENCY: a few internal modules import each other (as in the UMD build).
    // - AMBIGUOUS_EXTERNAL_NAMESPACES: rollup can't see which names each `export * from
    //   '@phensley/...'` provides. The generated code copies a name only if it isn't already
    //   exported, the same first-wins rule as tsc's __exportStar.
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' ||
      warning.code === 'AMBIGUOUS_EXTERNAL_NAMESPACES'
    ) {
      return;
    }
    warn(warning);
  },
  output: {
    file: 'lib/index.js',
    format: 'cjs',
    exports: 'named',
    esModule: true,
    externalLiveBindings: false,
    freeze: false,
    generatedCode: 'es5',
    sourcemap: true,
  },
};
