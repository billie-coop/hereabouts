import * as fs from 'fs';
import { join } from 'path';
import type { ZigFile } from './_emit';

/** `zig/src/` at the repository root. */
export const ZIG_SRC = join(__dirname, '..', '..', '..', '..', 'zig', 'src');

/** Names of the generators in this directory. */
export const generatorNames = (): string[] =>
  fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .map((f) => f.slice(0, -3))
    .sort();

export const loadGenerator = async (name: string): Promise<() => ZigFile[]> => {
  const mod = await import(`./${name}`);
  return mod.files;
};
