import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generatorNames, loadGenerator, ZIG_SRC } from '../../scripts/zig/_registry';

// Zig source generated from the TypeScript's data tables must match the tables. If this fails,
// the data changed: run `yarn zig-data` and commit the result.
test('generated Zig data matches the TypeScript', async () => {
  const stale: string[] = [];
  for (const name of generatorNames()) {
    for (const f of (await loadGenerator(name))()) {
      const path = join(ZIG_SRC, f.path);
      const current = existsSync(path) ? readFileSync(path, 'utf-8') : '';
      if (current !== f.content) {
        stale.push(f.path);
      }
    }
  }
  expect(stale).toEqual([]);
});
