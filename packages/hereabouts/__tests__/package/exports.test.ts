/**
 * Checks of the built package (run `yarn build` first): the export map points at files that
 * exist, and the CommonJS entries share one copy of every module.
 */
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const load = createRequire(join(ROOT, 'package.json'));

type Conditions = { types: string; module: string; default: string };
const entries = Object.entries(pkg.exports as Record<string, Conditions | string>).filter(
  (e): e is [string, Conditions] => typeof e[1] === 'object',
);
const subpaths = entries.map(([key]) => key).filter((key) => key !== '.');

test('export map files exist', () => {
  const missing: string[] = [];
  for (const [key, conditions] of entries) {
    for (const [condition, file] of Object.entries(conditions)) {
      if (!existsSync(join(ROOT, file))) {
        missing.push(`${key} ${condition} ${file}`);
      }
    }
  }
  expect(missing).toEqual([]);
});

test('typesVersions lists every subpath', () => {
  const typesVersions = pkg.typesVersions['*'] as Record<string, string[]>;
  expect(Object.keys(typesVersions).sort()).toEqual(subpaths.map((s) => s.slice(2)).sort());
  for (const [key, conditions] of entries) {
    if (key !== '.') {
      expect(typesVersions[key.slice(2)]).toEqual([conditions.types]);
    }
  }
});

test('subpaths and the root share one copy of each export (CommonJS)', () => {
  const root = load(join(ROOT, pkg.exports['.'].default));
  const different: string[] = [];
  let shared = 0;
  for (const key of subpaths) {
    const sub = load(join(ROOT, pkg.exports[key].default));
    for (const name of Object.keys(sub)) {
      if (name in root) {
        shared++;
        if (root[name] !== sub[name]) {
          different.push(`${key} ${name}`);
        }
      }
    }
  }
  expect(different).toEqual([]);
  expect(shared).toBeGreaterThan(100);
});

test('CommonJS function exports are plain values, not getters', () => {
  // A getter would add a call to every use of the function. (Compiled TypeScript enums, such
  // as LanguageTagField, reassign their variable, so rollup exports them through a getter.
  // They are objects read rarely, so that is fine.)
  const getters: string[] = [];
  for (const [key, conditions] of entries) {
    const m = load(join(ROOT, conditions.default));
    for (const name of Object.keys(m)) {
      const d = Object.getOwnPropertyDescriptor(m, name);
      if (d?.get && typeof m[name] === 'function') {
        getters.push(`${key} ${name}`);
      }
    }
  }
  expect(getters).toEqual([]);
});

test('one copy of module state: the root and ./timezone read the same tz database', () => {
  const root = load(join(ROOT, pkg.exports['.'].default));
  const tz = load(join(ROOT, pkg.exports['./timezone'].default));
  // Both return the database's own (module-level) id list, so the same object means one
  // database: setTimeZoneData from ./timezone changes what the root's formatters read.
  expect(root.timeZoneIds()).toBe(tz.tzZoneIds());
});
