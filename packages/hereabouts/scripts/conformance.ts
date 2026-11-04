/**
 * Writes the shared test cases in `conformance/` at the repository root. Run after changing
 * anything those cases cover: `yarn conformance`.
 */
import * as fs from 'fs';
import { join } from 'path';
import { decimalCases, renderCases } from './conformance/decimal';

const root = join(__dirname, '..', '..', '..', 'conformance');
const out = join(root, 'decimal.json');
const cases = decimalCases();
fs.writeFileSync(out, renderCases(cases));
console.log(`wrote ${cases.length} cases to ${out}`);
