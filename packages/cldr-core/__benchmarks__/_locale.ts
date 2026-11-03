import { readFileSync } from 'fs';
import { join } from 'path';

import { config } from '../../hereabouts/src/config';
import { createFramework, type LocaleData, loadLocale } from '../src';

// Locale data loaded from the resource packs, as an app would load it.
const loader = (id: string): string =>
  readFileSync(join(__dirname, '..', '..', 'hereabouts', 'packs', `${id}.json`), 'utf-8');

const framework = createFramework({ loader, config });

export const locale = (id: string): LocaleData => loadLocale(framework, id);

/** Number of distinct inputs each benchmark cycles through (power of two). */
export const N = 1024;

/** Returns a counter function cycling through 0..N-1. */
export const counter = (): (() => number) => {
  let i = 0;
  return () => i++ & (N - 1);
};
