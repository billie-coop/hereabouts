# website

Live examples of the library: numbers, currency, decimal math, days / times / zones, units,
lists and messages, and locale matching. Every example shows the call next to its result, for
any of the 429 locales and any time zone. Vite + React + Tailwind.

```sh
yarn build      # from the repo root: builds the packages and the locale packs
yarn website    # dev server
yarn website:build   # static site in apps/website/dist (relative paths, works under any base URL)
```

Locale packs are loaded on demand, one chunk per language, straight from
`packages/hereabouts/packs`. The app imports the built packages (`lib-es`), so rebuild a package
after changing it.

The page's own text is translated with the library's translator (`src/i18n`): an English source
catalog keyed by its text, one catalog per language (de, fr, es, pt, ja, zh, zh-Hant, ar), and
`src/i18n/i18n.test.ts` checking them with `checkCatalogs`. The text follows the chosen locale.
To add a message, add it to `en.ts`, use it with `t(...)` (TypeScript checks the key and its
placeholders), and add it to each catalog; the test fails until every catalog has it.

It replaces the old `cldr-engine-react-demo` (Create React App + Redux) with the 2.x function
API and adds the `@phensley/datetime` examples.
