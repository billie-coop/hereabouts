import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONFORMANCE_DIR,
  generatorNames,
  loadGenerator,
} from '../../scripts/conformance/_registry';
import { renderCases } from '../../scripts/conformance/_shared';

// The shared cases in conformance/*.json record what the TypeScript functions return. If one
// of these fails, a change altered behaviour that the cases cover: check that the change is
// intended, then regenerate with `yarn conformance <name>` and commit the file.
describe('conformance cases match the TypeScript implementation', () => {
  for (const name of generatorNames()) {
    test(`conformance/${name}.json`, async () => {
      const current = readFileSync(join(CONFORMANCE_DIR, `${name}.json`), 'utf-8');
      const fresh = renderCases((await loadGenerator(name))());
      expect(current === fresh).toBe(true);
    });
  }
});
