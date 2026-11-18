/**
 * Zig data for the calendar time zone code (`src/core/systems/calendars/timezone.ts`):
 *
 * - `core/systems/calendars/autogen.zonedata.zig`: the metazone data of `autogen.zonedata.ts`,
 *   decoded the way `buildMetazones` decodes it (metazone ids, per-zone metazone histories,
 *   CLDR stable ids, and the aliases of the bundled tz data), as comptime tables.
 * - `core/systems/calendars/autogen.aliases.zig`: `timeZoneAliases`, the CLDR zone aliases of
 *   `autogen.aliases.ts` plus the hand-written extras in `timezone.ts`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { metazoneData } from '../../src/core/systems/calendars/autogen.zonedata';
import { timeZoneAliases } from '../../src/core/systems/calendars/timezone';
import { numarray } from '../../src/core/utils/string';
import { defaultTimeZoneData } from '../../src/timezone';
import { header, type ZigFile, zigString } from './_emit';

const byKey = <T>(m: Map<string, T>): [string, T][] =>
  Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

/** The inside of an array literal, spaced as `zig fmt` spaces it: `{}`, `{x}`, `{ x, y }`. */
const items = (xs: string[]): string =>
  xs.length === 0 ? '{}' : xs.length === 1 ? `{${xs[0]}}` : `{ ${xs.join(', ')} }`;

const SOURCE = 'src/core/systems/calendars/autogen.zonedata.ts';

/** A `StaticStringMap` literal, one entry per line. */
const stringMap = (name: string, doc: string, type: string, entries: [string, string][]): string =>
  `/// ${doc}\n` +
  `pub const ${name} = std.StaticStringMap(${type}).initComptime(.{\n` +
  entries.map(([k, v]) => `    .{ ${zigString(k)}, ${v} },`).join('\n') +
  '\n});\n';

const zonedata = (): string => {
  const raw = metazoneData;
  const metazoneids: string[] = raw.metazoneids;

  const index = numarray(raw.index, 36);
  const offsets = numarray(raw.offsets, 36);
  const untils = numarray(raw.untils, 36).map((n) => (n === -1 ? n : n * 1000));
  const records: string[] = [];
  for (let i = 0; i < index.length; i += 2) {
    const s = index[i];
    const e = index[i + 1];
    records.push(
      `    rec(&.${items(offsets.slice(s, e).map(String))}, &.${items(untils.slice(s, e).map(String))}),`,
    );
  }

  // Positional against the bundled canonical zone list, as in `buildMetazones`. Maps keep the
  // last value set for a key.
  const zoneids = defaultTimeZoneData.zoneids.split('|');
  const zoneindex = numarray(raw.zoneindex, 36);
  if (zoneids.length !== zoneindex.length) {
    throw new Error('time zone ids and zone index are not in sync');
  }
  const stableids = new Map<string, string>();
  for (const d of raw.stableids.split('|')) {
    const p = d.split(':');
    stableids.set(zoneids[Number(p[0])], p[1]);
  }
  const zoneToMetazone = new Map<string, number>();
  for (let i = 0; i < zoneindex.length; i++) {
    const mi = zoneindex[i];
    if (mi !== -1) {
      zoneToMetazone.set(zoneids[i], mi);
      zoneToMetazone.set(zoneids[i].toLowerCase(), mi);
    }
  }
  const aliases = new Map<string, string>();
  for (const e of defaultTimeZoneData.links.split('|')) {
    const [alias, j] = e.split(':');
    aliases.set(alias, zoneids[Number(j)]);
  }

  return (
    header('core-calendars', SOURCE) +
    '//! Metazone data for calendar dates, decoded.\n\n' +
    'const std = @import("std");\n\n' +
    '/// The metazone history of a zone: `offsets[j]` (an index into `metazoneids`) applies from\n' +
    '/// `untils[j]` (UTC milliseconds); the first entry applies before every until.\n' +
    'pub const MetazoneRecord = struct {\n' +
    '    offsets: []const u16,\n' +
    '    untils: []const i64,\n' +
    '};\n\n' +
    'fn rec(offsets: []const u16, untils: []const i64) MetazoneRecord {\n' +
    '    return .{ .offsets = offsets, .untils = untils };\n' +
    '}\n\n' +
    '/// Metazone ids.\n' +
    'pub const metazoneids = [_][]const u8{\n' +
    metazoneids.map((m) => `    ${zigString(m)},`).join('\n') +
    '\n};\n\n' +
    '/// Metazone histories, indexed by `zone_metazone`.\n' +
    'pub const metazones = [_]MetazoneRecord{\n' +
    records.join('\n') +
    '\n};\n\n' +
    stringMap(
      'zone_metazone',
      'Index into `metazones` of each bundled canonical zone id that has one, as given and in lower case.',
      'u16',
      byKey(zoneToMetazone).map(([k, v]) => [k, String(v)]),
    ) +
    '\n' +
    stringMap(
      'stable_ids',
      'CLDR stable id of a bundled canonical zone id, used for schema lookups.',
      '[]const u8',
      byKey(stableids).map(([k, v]) => [k, zigString(v)]),
    ) +
    '\n' +
    stringMap(
      'tz_aliases',
      'Aliases of the bundled tz data, mapped to the bundled canonical zone id.',
      '[]const u8',
      byKey(aliases).map(([k, v]) => [k, zigString(v)]),
    )
  );
};

const aliasesfile = (): string =>
  header('core-calendars', 'src/core/systems/calendars/autogen.aliases.ts and timezone.ts') +
  '//! Zone aliases (`timeZoneAliases`): the CLDR aliases plus a few hand-written extras.\n\n' +
  'const std = @import("std");\n\n' +
  stringMap(
    'aliases',
    'Zone alias to the id that replaces it.',
    '[]const u8',
    byKey(new Map(Object.entries(timeZoneAliases))).map(([k, v]) => [k, zigString(v)]),
  );

/** The era table is private in TypeScript; extract its literal without duplicating it. */
export const japaneseEras = (): number[] => {
  const source = readFileSync(
    join(__dirname, '../../src/core/systems/calendars/japanese.ts'),
    'utf8',
  );
  const literal = source.match(/const ERAS: number\[\] = \[([\s\S]*?)\];/)?.[1];
  if (!literal) throw new Error('Japanese era table not found');
  const values = JSON.parse(
    `[${literal.replace(/\/\/[^\n]*/g, '').replace(/,\s*$/, '')}]`,
  ) as number[];
  if (values.length % 3 !== 0 || values.length < 3) throw new Error('Invalid Japanese era table');
  return values;
};

export const files = (): ZigFile[] => [
  { path: 'core/systems/calendars/autogen.zonedata.zig', content: zonedata() },
  { path: 'core/systems/calendars/autogen.aliases.zig', content: aliasesfile() },
  {
    path: 'core/systems/calendars/autogen.eras.zig',
    content:
      header('core-calendars', 'src/core/systems/calendars/japanese.ts') +
      '/// Start (year, month, day) of each Japanese era.\n' +
      'pub const eras = [_]f64{\n' +
      japaneseEras()
        .map((n) => `    ${n},`)
        .join('\n') +
      '\n};\n',
  },
];
