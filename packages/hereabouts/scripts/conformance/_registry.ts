import * as fs from 'fs';
import { join } from 'path';
import type { ConformanceCase } from './_shared';

/** Directory of the generated case files, at the repository root. */
export const CONFORMANCE_DIR = join(__dirname, '..', '..', '..', '..', 'conformance');

/** Names of the generators in this directory: `decimal` for `decimal.ts`. */
export const generatorNames = (): string[] =>
  fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .map((f) => f.slice(0, -3))
    .sort();

export const loadGenerator = async (name: string): Promise<() => ConformanceCase[]> => {
  const mod = await import(`./${name}`);
  return mod.cases;
};
