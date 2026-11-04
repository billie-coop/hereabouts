/**
 * Writes Zig source generated from the TypeScript's data tables, one generator per file in
 * `scripts/zig/`:
 *
 *   yarn zig-data            all generators
 *   yarn zig-data plurals    just one
 */
import * as fs from 'fs';
import { dirname, join } from 'path';
import { generatorNames, loadGenerator, ZIG_SRC } from './zig/_registry';

const main = async (): Promise<void> => {
  const only = process.argv.slice(2);
  const names = generatorNames().filter((n) => only.length === 0 || only.includes(n));
  if (names.length === 0 && only.length > 0) {
    throw new Error(`no generators match: ${only.join(' ')}`);
  }
  for (const name of names) {
    for (const f of (await loadGenerator(name))()) {
      const out = join(ZIG_SRC, f.path);
      fs.mkdirSync(dirname(out), { recursive: true });
      fs.writeFileSync(out, f.content);
      console.log(`wrote ${out}`);
    }
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
