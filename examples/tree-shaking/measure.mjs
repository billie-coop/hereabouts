// Bundle each example with rollup + terser and report minified / gzipped sizes, then run the
// bundle to check it works.
//
//   node examples/tree-shaking/measure.mjs [--v1 <path to a built 1.x checkout>]
//
// `@billie-coop/hereabouts` and its subpaths are resolved through the export map's `module`
// condition (the ES module build in packages/hereabouts/dist/esm), honouring the package's
// `sideEffects` flag, as a bundler resolving it from node_modules would. A 1.x checkout's
// @phensley/* packages are resolved to `<root>/packages/<name>`. Build first (`yarn build`).

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const require = createRequire(join(repo, 'package.json'));
const { rollup } = require('rollup');
const terser = require('@rollup/plugin-terser');
const json = require('@rollup/plugin-json');

const args = process.argv.slice(2);
const v1Ix = args.indexOf('--v1');
const v1Root = v1Ix >= 0 ? resolve(args[v1Ix + 1]) : undefined;

// Resolve @phensley/<name> to <root>/packages/<name>/<module> and record each package's
// sideEffects flag so tree-shaking treats modules the way the published package declares.
const phensley = (root) => {
  const pkgs = new Map();
  const pkgFor = (name) => {
    if (!pkgs.has(name)) {
      const dir = join(root, 'packages', name);
      const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      pkgs.set(name, { dir, json });
    }
    return pkgs.get(name);
  };
  return {
    name: 'phensley-resolve',
    resolveId(source, importer) {
      // @billie-coop/hereabouts and its subpaths: the `module` condition of the export map
      const h = /^@billie-coop\/hereabouts(\/[^/]+)?$/.exec(source);
      if (h) {
        const { dir, json } = pkgFor('hereabouts');
        return join(dir, json.exports[h[1] ? `.${h[1]}` : '.'].module);
      }
      const m = /^@phensley\/([^/]+)(\/.*)?$/.exec(source);
      if (m) {
        const { dir, json } = pkgFor(m[1]);
        return m[2] ? join(dir, m[2]) + '.js' : join(dir, json.module);
      }
      if (source === 'tslib') {
        return require.resolve('tslib/tslib.es6.js', {
          paths: [join(root, 'packages', 'cldr-core')],
        });
      }
      if (importer && (source.startsWith('./') || source.startsWith('../'))) {
        const p = resolve(dirname(importer), source);
        if (existsSync(p) && statSync(p).isDirectory()) return join(p, 'index.js');
        return p.endsWith('.js') || p.endsWith('.json') ? p : p + '.js';
      }
      return null;
    },
    // Modules of a package with "sideEffects": false can be dropped when unused.
    moduleSideEffects: undefined,
    _sideEffects(id) {
      const m = /\/packages\/([^/]+)\//.exec(id);
      if (!m || !id.startsWith(root)) return true;
      return pkgFor(m[1]).json.sideEffects !== false;
    },
  };
};

const measure = async (entry, root, label) => {
  const plugin = phensley(root);
  const bundle = await rollup({
    input: join(here, entry),
    plugins: [plugin, json({ preferConst: true })],
    treeshake: { moduleSideEffects: (id) => plugin._sideEffects(id) },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({
    format: 'es',
    plugins: [terser({ format: { comments: false } })],
  });
  const code = output[0].code;
  if (process.env.MODULES) {
    const mods = Object.entries(output[0].modules)
      .map(([id, m]) => [m.renderedLength, id.replace(root, '')])
      .sort((a, b) => b[0] - a[0])
      .slice(0, Number(process.env.MODULES));
    console.log(label, mods.map(([n, id]) => `${(n / 1024).toFixed(1)}K ${id}`).join('\n  '));
  }
  mkdirSync(join(here, 'dist'), { recursive: true });
  const file = join(here, 'dist', label + '.js');
  writeFileSync(file, code);
  const min = Buffer.byteLength(code);
  const gz = gzipSync(code, { level: 9 }).length;
  return { label, min, gz, file };
};

// Run a bundle with a pack loader that reads the packs of the given checkout.
const run = (file, root) => {
  const packs = join(root, 'packages', root === repo ? 'hereabouts' : 'cldr', 'packs');
  const prelude = `globalThis.loadPack = (l) => require('fs').readFileSync(${JSON.stringify(packs)} + '/' + l + '.json', 'utf8');`;
  const runner = join(here, 'dist', 'run.cjs');
  const code = readFileSync(file, 'utf8');
  writeFileSync(
    runner,
    prelude + '\n(async () => {\n' + code.replace(/^import .*$/gm, '') + '\n})();',
  );
  return execFileSync(process.execPath, [runner], { encoding: 'utf8' }).trim();
};

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const rows = [];
const cases = [
  ['numbers.js', repo, '2x-numbers'],
  ['dates.js', repo, '2x-dates'],
  ['convenience.js', repo, '2x-convenience'],
  ['decimal.js', repo, '2x-decimal'],
  ...(process.env.PROBE ? [['side-effects-probe.js', repo, 'side-effects-probe']] : []),
];
if (v1Root) {
  cases.push(
    ['numbers-1x.js', v1Root, '1x-numbers'],
    ['dates-1x.js', v1Root, '1x-dates'],
    ['decimal-1x.js', v1Root, '1x-decimal'],
  );
}
for (const [entry, root, label] of cases) {
  const r = await measure(entry, root, label);
  r.output = run(r.file, root);
  rows.push(r);
}

console.log('| bundle | minified | min+gzip | output |');
console.log('|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.label} | ${kb(r.min)} | ${kb(r.gz)} | ${r.output.split('\n').join(' / ')} |`);
}
