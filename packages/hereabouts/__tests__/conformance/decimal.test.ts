import { readFileSync } from 'fs';
import { join } from 'path';
import { decimalCases, renderCases } from '../../scripts/conformance/decimal';

// The shared cases in conformance/decimal.json record what the TypeScript functions return.
// If this fails, a change altered decimal behaviour: check that the change is intended, then
// regenerate the file with `yarn conformance`.
test('conformance/decimal.json matches the TypeScript implementation', () => {
  const path = join(__dirname, '..', '..', '..', '..', 'conformance', 'decimal.json');
  const current = readFileSync(path, 'utf-8');
  const fresh = renderCases(decimalCases());
  expect(current === fresh).toBe(true);
});
