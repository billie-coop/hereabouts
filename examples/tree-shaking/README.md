# Tree-shaking comparison

Small entry points that use one area of the library, bundled with rollup + terser, compared
with the same usage against 1.x.

```bash
yarn build                                          # build lib-es for every package
node examples/tree-shaking/measure.mjs --v1 <path>  # <path>: a built 1.x checkout (v1.16.0)
```

`@phensley/*` imports are resolved to `<root>/packages/<name>` using each package's `module`
build and its `sideEffects` flag, the way a bundler resolves them from `node_modules`. Each
bundle is then run (with a pack loader reading `packages/cldr/packs`) to check it works; the
outputs are in the last column. Resource packs are loaded at runtime and are not part of any
bundle.

Options: `MODULES=20` lists the largest modules in each bundle; `PROBE=1` also bundles
`side-effects-probe.js`, which uses a single trivial export and should come out at a few bytes
if no module has import-time side effects.

## Results (2026-11-01)

| entry | what it does | 2.x min | 2.x gzip | 1.x min | 1.x gzip |
|---|---|---|---|---|---|
| `numbers.js` / `numbers-1x.js` | load 'en', formatDecimal + formatCurrency | 106.9 KB | **41.8 KB** | 363.9 KB | 111.5 KB |
| `dates.js` / `dates-1x.js` | load 'en', formatDate (standard + skeleton) | 270.8 KB | **86.4 KB** | 364.0 KB | 111.5 KB |
| `decimal.js` / `decimal-1x.js` | Decimal arithmetic only (`@phensley/decimal`) | 6.1 KB | **2.7 KB** | 17.4 KB | 5.9 KB |
| `convenience.js` | 2.x convenience object (`cldrFramework().get('en').Numbers...`) | 316.1 KB | 102.4 KB | | |
| `side-effects-probe.js` | only `cldrVersion()` | 0.03 KB | | | |

Notes:

- In 1.x every entry ships the whole library: the `Calendars`/`Numbers`/... classes reference
  everything, and the packages are not marked side-effect free (and can't be: the default
  schema config is installed by an import side effect).
- What remains in the 2.x numbers bundle is what loading a resource pack and formatting a number
  needs: the schema config the packs were built with (~27 KB minified, the list of locale,
  currency, unit and zone ids), plural rules, likely-subtags data, Decimal, and the number
  formatting functions.
- Dates also need the time zone database (~128 KB before minification) and every calendar
  system, since the calendar is chosen at runtime from the locale (`-u-ca-...`) or options.
- The convenience object binds every function, so it is about the size of 1.x.
