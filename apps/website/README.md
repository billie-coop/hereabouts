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
`packages/hereabouts/packs`. The app imports the built package (`dist/esm`), so rebuild the library
after changing it.

The page's own text is translated with the library's translator (`src/i18n`): an English source
catalog keyed by its text, one catalog per language (de, fr, es, pt, ja, zh, zh-Hant, ar), and
`src/i18n/i18n.test.ts` checking them with `checkCatalogs`. The text follows the chosen locale.
To add a message, add it to `en.ts`, use it with `t(...)` (TypeScript checks the key and its
placeholders), and add it to each catalog; the test fails until every catalog has it.

It replaces the old `cldr-engine-react-demo` (Create React App + Redux) with the function
API and adds the day / time / zone examples.

The overview has a responsive feature mosaic: each card shows two live examples and expands
with **More examples** to show the rest. The locale and time zone apply to every card. The
shared Billie co-op shell stays light; the demo content follows the selected locale, including
right-to-left Arabic. The introduction and documentation are in English.

Documentation lives at `#docs` with section links such as `#docs/locale-data`, so direct links
work on GitHub Pages without a server fallback. The guide in `src/Docs.tsx` follows the root
README and links to it for the full reference; keep its examples in sync when the API changes.
