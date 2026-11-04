/**
 * Zig data for the timezone module, from `src/timezone/autogen.zonedata.ts`:
 *
 * - `timezone/autogen.zonedata.zig`: the bundled data already decoded (by the TypeScript decoder),
 *   so the Zig port needs no allocation or start-up work for it. Transition times keep the
 *   TypeScript's compact form (indexes into a shared table of gaps) and are summed at comptime.
 * - `timezone/autogen.rawdata.zig`: the raw strings, the Zig `defaultTimeZoneData`, for code that
 *   decodes the data itself.
 */
import * as fs from 'fs';
import { join } from 'path';
import { rawdata } from '../../src/timezone/autogen.zonedata';
import { createTzDatabase, tzdbRecord } from '../../src/timezone/database';
import { header, type ZigFile, zigString, zigStringArray } from './_emit';

// The version noted at the top of the TypeScript data file.
const tzdbVersion = (): string => {
  const src = fs.readFileSync(join(__dirname, '../../src/timezone/autogen.zonedata.ts'), 'utf-8');
  return /tzdb version (\S+)/.exec(src)![1];
};

/** An inline list literal, spaced as `zig fmt` spaces it. */
const list = (xs: readonly string[]): string =>
  xs.length > 1 ? `.{ ${xs.join(', ')} }` : `.{${xs.join('')}}`;

/** Rows of `perLine` items, columns aligned as `zig fmt` aligns them. */
const lines = (xs: readonly string[], perLine: number, indent = '    '): string => {
  const width: number[] = [];
  xs.forEach((x, i) => {
    width[i % perLine] = Math.max(width[i % perLine] || 0, x.length + 1);
  });
  const out: string[] = [];
  for (let i = 0; i < xs.length; i += perLine) {
    const row = xs.slice(i, i + perLine).map((x, j) => (x + ',').padEnd(width[j]));
    out.push(indent + row.join(' ').trimEnd());
  }
  return out.join('\n');
};

const zonedata = (): string => {
  const db = createTzDatabase(rawdata);
  const index = db.untilindex;

  const zones = db.zoneids.map((id, i) => {
    const rec = tzdbRecord(db, id)![1];
    const fields = rawdata.zoneinfo[i].split('_');
    // The packed until indexes, before the TypeScript sums them.
    const packed = (fields[6] || '')
      .split(' ')
      .filter((s) => s)
      .map((s) => parseInt(s, 36));
    // Millionths of a degree, as packed; the TypeScript divides by 1e6.
    const lat = parseInt(fields[1], 36);
    const lon = parseInt(fields[2], 36);
    const localtime = rec.localtime.map((r) => `lt(${zigString(r.abbr)}, ${r.dst}, ${r.offset})`);
    return (
      `        .{ // ${id}\n` +
      `            .stdoff = ${rec.stdoff},\n` +
      `            .latitude = ${lat},\n` +
      `            .longitude = ${lon},\n` +
      `            .countries = &${list(rec.countries.map(zigString))},\n` +
      `            .localtime = &${list(localtime)},\n` +
      `            .types = &types(${zigString(rec.types.map((t) => t.toString(36)).join(''))}),\n` +
      `            .untils = &untils(&${list(packed.map(String))}),\n` +
      '        },'
    );
  });

  // Every spelling the TypeScript indexes (ids and aliases, as given and lower case), sorted
  // for binary search. The Map keeps the last value set for a key, as the Zig decoder does.
  const links = Array.from(db.linkindex.entries())
    .map(([key, id]) => [key, db.zoneindex.get(id)!] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, i]) => `        link(${zigString(key)}, ${i}),`);

  return (
    header('timezone', 'src/timezone/autogen.zonedata.ts') +
    `//! The bundled time zone data (tzdb ${tzdbVersion()}), decoded.\n\n` +
    'const database = @import("database.zig");\n\n' +
    'const Database = database.Database;\n' +
    'const Zone = database.Zone;\n' +
    'const Link = database.Link;\n\n' +
    '/// Seconds between transitions; zones list indexes into it (see `database.untilsFromIndex`).\n' +
    'const index = [_]i64{\n' +
    lines(
      index.map((n) => String(n)),
      10,
    ) +
    '\n};\n\n' +
    'fn untils(comptime packed_untils: []const u16) [packed_untils.len]i64 {\n' +
    '    return database.untilsFromIndex(&index, packed_untils);\n' +
    '}\n\n' +
    'const types = database.typesFromString;\n\n' +
    'fn lt(abbr: []const u8, dst: u8, offset: i64) database.LocalTime {\n' +
    '    return .{ .abbr = abbr, .dst = dst, .offset = offset };\n' +
    '}\n\n' +
    'fn link(key: []const u8, zone: u32) Link {\n' +
    '    return .{ .key = key, .zone = zone };\n' +
    '}\n\n' +
    `const zoneids = ${zigStringArray(db.zoneids)};\n\n` +
    'const zones = blk: {\n' +
    '    @setEvalBranchQuota(1_000_000);\n' +
    `    break :blk [_]Zone{\n${zones.join('\n')}\n    };\n};\n\n` +
    'const links = blk: {\n' +
    '    @setEvalBranchQuota(1_000_000);\n' +
    `    break :blk [_]Link{\n${links.join('\n')}\n    };\n};\n\n` +
    'pub const data: Database = .{ .zoneids = zoneids, .zones = &zones, .links = &links };\n'
  );
};

const rawfile = (): string =>
  header('timezone', 'src/timezone/autogen.zonedata.ts') +
  '//! The bundled time zone data in its packed form (`defaultTimeZoneData`).\n\n' +
  'const RawData = @import("database.zig").RawData;\n\n' +
  'pub const data: RawData = .{\n' +
  `    .zoneids = ${zigString(rawdata.zoneids)},\n` +
  `    .links = ${zigString(rawdata.links)},\n` +
  `    .index = ${zigString(rawdata.index)},\n` +
  `    .zoneinfo = ${zigStringArray(rawdata.zoneinfo, '        ').replace(/\n}$/, '\n    }')},\n` +
  '};\n';

export const files = (): ZigFile[] => [
  { path: 'timezone/autogen.zonedata.zig', content: zonedata() },
  { path: 'timezone/autogen.rawdata.zig', content: rawfile() },
];
