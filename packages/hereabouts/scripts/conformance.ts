/**
 * Writes the shared test cases in `conformance/` at the repository root, one file per
 * generator in `scripts/conformance/`. Run after changing anything those cases cover:
 *
 *   yarn conformance            all generators
 *   yarn conformance plurals    just conformance/plurals.json
 */
import * as fs from 'fs';
import { join } from 'path';
import { CONFORMANCE_DIR, generatorNames, loadGenerator } from './conformance/_registry';
import { renderCases } from './conformance/_shared';

const main = async (): Promise<void> => {
  const only = process.argv.slice(2);
  const names = generatorNames().filter((n) => only.length === 0 || only.includes(n));
  if (names.length === 0) {
    throw new Error(`no generators match: ${only.join(' ')}`);
  }
  for (const name of names) {
    const cases = (await loadGenerator(name))();
    const out = join(CONFORMANCE_DIR, `${name}.json`);
    fs.writeFileSync(out, renderCases(cases));
    console.log(`wrote ${cases.length} cases to ${out}`);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
