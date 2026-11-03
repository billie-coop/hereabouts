import * as fs from 'fs';
import { join } from 'path';

import { type CLDRFramework, type CLDROptions, cldrFramework } from '../../../src';

const packPath = (language: string) =>
  join(__dirname, '..', '..', '..', 'packs', `${language}.json`);

export const loader = (language: string): any =>
  fs.readFileSync(packPath(language)).toString('utf-8');

const defaultOptions: CLDROptions = {
  debug: true,
  loader,
  packCacheSize: 3,
  patternCacheSize: 50,
};

export const getCLDR = (options: CLDROptions = defaultOptions): CLDRFramework => {
  const merged = Object.assign({}, defaultOptions, options);
  return cldrFramework(merged);
};
