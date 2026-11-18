/**
 * Writes `zig/src/plurals/autogen.rules.zig` and `autogen.ranges.zig` from the CLDR-generated
 * plural tables in `src/plurals/autogen.rules.ts` and `autogen.ranges.ts`, as comptime tables.
 */
import { pluralRanges } from '../../src/plurals/autogen.ranges';
import { cardinalRules, expressions, ordinalRules } from '../../src/plurals/autogen.rules';
import type { Expr, Rule } from '../../src/plurals/types';
import { header, type ZigFile, zigString } from './_emit';

const OPERANDS = ['n', 'i', 'v', 'w', 'f', 't', 'c'];

/** The inside of an array literal, spaced as `zig fmt` spaces it: `{}`, `{x}`, `{ x, y }`. */
const items = (xs: string[]): string =>
  xs.length === 0 ? '{}' : xs.length === 1 ? `{${xs[0]}}` : `{ ${xs.join(', ')} }`;

const expr = (e: Expr, i: number): string => {
  if (!OPERANDS.includes(e[0])) {
    throw new Error(`expressions[${i}]: unknown operand ${e[0]}`);
  }
  const ranges = e[3].map((r) =>
    typeof r === 'number' ? `.{ ${r}, ${r} }` : `.{ ${r[0]}, ${r[1]} }`,
  );
  return `    .{ .operand = .${e[0]}, .mod = ${e[1]}, .eq = ${e[2] ? 'true' : 'false'}, .ranges = &.${items(ranges)} },`;
};

const rule = (r: Rule): string => {
  const conds = r[1].map((c) => `&.${items(c.map(String))}`);
  return `.{ .category = ${r[0]}, .conditions = &.${items(conds)} }`;
};

const ruleMap = (name: string, rules: { [x: string]: Rule[] }): string => {
  const rows = Object.keys(rules).map(
    (k) => `    .{ ${zigString(k)}, &[_]Rule${items(rules[k].map(rule))} },`,
  );
  return `pub const ${name} = std.StaticStringMap([]const Rule).initComptime(.{\n${rows.join('\n')}\n});\n`;
};

const rulesFile = (): string =>
  header('plurals', 'src/plurals/autogen.rules.ts') +
  'const std = @import("std");\n' +
  'const types = @import("types.zig");\n' +
  'const Rule = types.Rule;\n' +
  'const Expr = types.Expr;\n\n' +
  '/// Rules for each language (and a few locales), by id.\n' +
  ruleMap('cardinal_rules', cardinalRules) +
  '\n' +
  ruleMap('ordinal_rules', ordinalRules) +
  '\n/// The expressions rules refer to by index.\n' +
  `pub const expressions = [_]Expr{\n${expressions.map(expr).join('\n')}\n};\n`;

const rangesFile = (): string => {
  const rows = Object.keys(pluralRanges).map((k) => {
    const v = pluralRanges[k];
    if (typeof v === 'number') {
      return `    .{ ${zigString(k)}, RangeMap{ .all = ${v} } },`;
    }
    const entries = Object.keys(v).map((key) => `.{ ${key}, ${v[key]} }`);
    return `    .{ ${zigString(k)}, RangeMap{ .map = &.{ ${entries.join(', ')} } } },`;
  });
  return (
    header('plurals', 'src/plurals/autogen.ranges.ts') +
    'const std = @import("std");\n' +
    'const RangeMap = @import("types.zig").RangeMap;\n\n' +
    '/// Plural range rules by language.\n' +
    `pub const plural_ranges = std.StaticStringMap(RangeMap).initComptime(.{\n${rows.join('\n')}\n});\n`
  );
};

export const files = (): ZigFile[] => [
  { path: 'plurals/autogen.rules.zig', content: rulesFile() },
  { path: 'plurals/autogen.ranges.zig', content: rangesFile() },
];
