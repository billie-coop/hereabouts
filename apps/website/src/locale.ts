import {
  availableLocales,
  createFramework,
  createLocaleMatcher,
  type LocaleData,
  loadLocaleAsync,
  matchLocale,
} from '@billie-coop/hereabouts';

// Each language's resource pack is its own chunk, fetched the first time a locale of that
// language is chosen. The packs come from the @billie-coop/hereabouts build (`yarn build`).
const PACKS = '../../../packages/hereabouts/packs/';
const packs = import.meta.glob<string>('../../../packages/hereabouts/packs/*.json', {
  query: '?raw',
  import: 'default',
});

/** The CLDR release the packs were built from, read from the first pack loaded. */
export let cldrDataVersion = '';

const loadPack = async (language: string): Promise<string> => {
  const load = packs[`${PACKS}${language}.json`] ?? packs[`${PACKS}en.json`];
  if (!load) {
    throw new Error('No resource packs found. Run `yarn build` first.');
  }
  const raw = await load();
  cldrDataVersion ||= /"cldr":"([^"]+)"/.exec(raw.slice(0, 200))?.[1] ?? '';
  return raw;
};

const framework = createFramework({ asyncLoader: loadPack });

/** Locale data for a locale id; each language's pack is downloaded once. */
export const loadLocale = (id: string): Promise<LocaleData> => loadLocaleAsync(framework, id);

/** Every locale the packs cover, e.g. 'en-US', 'sr-Latn', 'zh-Hant-TW'. */
export const LOCALES: string[] = availableLocales().map((l) => l.id);

/** The supported locale closest to the browser's languages. */
export const initialLocale = (): string => {
  const wanted = typeof navigator !== 'undefined' ? [...navigator.languages] : [];
  const match = matchLocale(
    createLocaleMatcher(['en-US', ...LOCALES]),
    wanted.length ? wanted : 'en-US',
  );
  return match.locale.id;
};
