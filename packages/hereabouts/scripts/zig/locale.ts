/**
 * Writes `zig/src/locale/autogen.subtags.zig`, `autogen.aliases.zig` and `autogen.flags.zig`:
 * the likely subtags and language aliases from `src/locale/autogen.*.ts` as sorted tables,
 * and the regions with an emoji flag, found by asking `regionFlag` about every A-Z pair.
 */
import { languageAliasRaw } from '../../src/locale/autogen.aliases';
import { likelySubtags } from '../../src/locale/autogen.subtags';
import { regionFlag } from '../../src/locale/flags';
import { stringToObject } from '../../src/locale/util';
import { header, type ZigFile, zigString } from './_emit';

/** A Zig slice literal, formatted as `zig fmt` would. */
const slice = (xs: string[]): string =>
  xs.length === 1 ? `&.{${xs[0]}}` : `&.{ ${xs.join(', ')} }`;

/** A fast tag field: null is undefined (a number in the TypeScript). */
type Field = string | null;
type Triple = [Field, Field, Field];

const field = (v: string | number | undefined): Field => {
  if (typeof v === 'number') {
    return null;
  }
  if (typeof v !== 'string') {
    throw new Error(`unexpected fast tag field ${v}`);
  }
  return v;
};

const triple = (t: Triple): string =>
  `.{ ${t.map((v) => (v === null ? 'null' : zigString(v))).join(', ')} }`;

/** Null sorts first, then strings in byte order (the Zig lookups use the same order). */
const cmpField = (a: Field, b: Field): number => {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
};

const cmpTriple = (a: Triple, b: Triple): number =>
  cmpField(a[0], b[0]) || cmpField(a[1], b[1]) || cmpField(a[2], b[2]);

/** Object keys '0', '1' and '2' stand for the undefined language, script and region. */
const keyField = (k: string, undef: string): Field => (k === undef ? null : k);

const subtagsFile = (): string => {
  const scripts: string[] = likelySubtags._;
  const rows: [Triple, Triple][] = [];
  for (const l of Object.keys(likelySubtags)) {
    if (l === '_') {
      continue;
    }
    for (const s of Object.keys(likelySubtags[l])) {
      for (const r of Object.keys(likelySubtags[l][s])) {
        const raw = likelySubtags[l][s][r];
        const key: Triple = [keyField(l, '0'), keyField(s, '1'), keyField(r, '2')];
        let value: Triple;
        if (Array.isArray(raw)) {
          // Already expanded by an earlier lookup in this process.
          value = [field(raw[0]), field(raw[1]), field(raw[2])];
        } else {
          // Same expansion as `likelyGet` in resolver.ts: an empty language or region is the
          // query's, the script is an index into the script table.
          const p = raw.split('-');
          if (p.length !== 3 || !p[1] || scripts[Number(p[1])] === undefined) {
            throw new Error(`unexpected likely subtags value ${raw}`);
          }
          value = [p[0] ? p[0] : key[0], scripts[Number(p[1])], p[2] ? p[2] : key[2]];
        }
        rows.push([key, value]);
      }
    }
  }
  rows.sort((a, b) => cmpTriple(a[0], b[0]));
  const lines = rows.map(([k, v]) => `    .{ .key = ${triple(k)}, .value = ${triple(v)} },`);
  return (
    header('locale', 'src/locale/autogen.subtags.ts') +
    'pub const Triple = [3]?[]const u8;\n' +
    'pub const Likely = struct { key: Triple, value: Triple };\n\n' +
    '/// Likely subtags: language, script and region (null is undefined), sorted by key with\n' +
    '/// null first.\n' +
    `pub const likely_subtags = [_]Likely{\n${lines.join('\n')}\n};\n`
  );
};

/** Same as `parseFastTag` in resolver.ts. */
const parseFastTag = (s: string): Triple => {
  const p = s.split('-');
  return [p[0] ? p[0] : null, p[1] ? p[1] : null, p[2] ? p[2] : null];
};

const aliasesFile = (): string => {
  // Same grouping as `buildLanguageAliasMap` in resolver.ts, keeping each language's order.
  const languageAlias = stringToObject(languageAliasRaw, '|', ':');
  const groups = new Map<string, [Triple, Triple][]>();
  for (const k of Object.keys(languageAlias)) {
    const from = parseFastTag(k);
    const to = parseFastTag(languageAlias[k]);
    const language = from[0];
    if (language === null) {
      throw new Error(`language alias without a language: ${k}`);
    }
    const list = groups.get(language) ?? [];
    list.push([from, to]);
    groups.set(language, list);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const lines = keys.map((k) => {
    const pairs = groups.get(k)!.map(([f, t]) => `.{ .from = ${triple(f)}, .to = ${triple(t)} }`);
    return `    .{ .language = ${zigString(k)}, .pairs = ${slice(pairs)} },`;
  });
  return (
    header('locale', 'src/locale/autogen.aliases.ts') +
    'pub const Triple = [3]?[]const u8;\n' +
    'pub const Pair = struct { from: Triple, to: Triple };\n' +
    'pub const LanguageAliases = struct { language: []const u8, pairs: []const Pair };\n\n' +
    '/// Language aliases grouped by language, sorted by language.\n' +
    `pub const language_aliases = [_]LanguageAliases{\n${lines.join('\n')}\n};\n`
  );
};

const flagsFile = (): string => {
  const regions: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (regionFlag(code) !== undefined) {
        regions.push(code);
      }
    }
  }
  const rows: string[] = [];
  for (let i = 0; i < regions.length; i += 16) {
    rows.push(
      `    ${regions
        .slice(i, i + 16)
        .map(zigString)
        .join(', ')},`,
    );
  }
  return (
    header('locale', 'regionFlag in src/locale/flags.ts') +
    '/// Regions with an emoji flag (recommended for general interchange), sorted.\n' +
    `pub const rgi_regions = [_]*const [2]u8{\n${rows.join('\n')}\n};\n`
  );
};

export const files = (): ZigFile[] => [
  { path: 'locale/autogen.subtags.zig', content: subtagsFile() },
  { path: 'locale/autogen.aliases.zig', content: aliasesFile() },
  { path: 'locale/autogen.flags.zig', content: flagsFile() },
];
