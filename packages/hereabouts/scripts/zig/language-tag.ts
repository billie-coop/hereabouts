/**
 * Writes `zig/src/language_tag/autogen.aliases.zig` and `autogen.subtags.zig` from the
 * territory aliases and grandfathered tags in `src/language-tag/autogen.*.ts`, as sorted
 * tables searched with binary search.
 */
import { territoryAliasRaw } from '../../src/language-tag/autogen.aliases';
import { grandfatheredRaw } from '../../src/language-tag/autogen.subtags';
import { stringToObject } from '../../src/language-tag/util';
import { header, type ZigFile, zigString } from './_emit';

/** A Zig slice literal, formatted as `zig fmt` would. */
const slice = (xs: string[]): string =>
  xs.length === 1 ? `&.{${xs[0]}}` : `&.{ ${xs.join(', ')} }`;

/** Byte order, which is also UTF-16 order for these ASCII keys. */
const byKey = <T>(rows: [string, T][]): [string, T][] =>
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const aliasesFile = (): string => {
  // Same split as `buildTerritoryAliasMap` in util.ts.
  const rows = byKey(
    territoryAliasRaw.split('|').map((e): [string, string[]] => {
      const [k, v] = e.split(':');
      return [k, v.split(/\s+/g)];
    }),
  );
  const lines = rows.map(
    ([k, v]) => `    .{ .key = ${zigString(k)}, .regions = ${slice(v.map(zigString))} },`,
  );
  return (
    header('language-tag', 'src/language-tag/autogen.aliases.ts') +
    'pub const TerritoryAlias = struct { key: []const u8, regions: []const []const u8 };\n\n' +
    '/// Territory aliases sorted by key: old or 3-letter region codes and their replacements.\n' +
    `pub const territory_aliases = [_]TerritoryAlias{\n${lines.join('\n')}\n};\n`
  );
};

const subtagsFile = (): string => {
  const o = stringToObject(grandfatheredRaw, '|', ':');
  const rows = byKey(Object.keys(o).map((k): [string, string] => [k, o[k]]));
  const lines = rows.map(
    ([k, v]) => `    .{ .key = ${zigString(k)}, .preferred = ${zigString(v)} },`,
  );
  return (
    header('language-tag', 'src/language-tag/autogen.subtags.ts') +
    'pub const Grandfathered = struct { key: []const u8, preferred: []const u8 };\n\n' +
    '/// Grandfathered tags from the IANA registry, sorted by key. Keys keep their case: the\n' +
    '/// parser looks up the lowercased input, so mixed-case keys never match (as in the\n' +
    '/// TypeScript).\n' +
    `pub const grandfathered = [_]Grandfathered{\n${lines.join('\n')}\n};\n`
  );
};

export const files = (): ZigFile[] => [
  { path: 'language_tag/autogen.aliases.zig', content: aliasesFile() },
  { path: 'language_tag/autogen.subtags.zig', content: subtagsFile() },
];
