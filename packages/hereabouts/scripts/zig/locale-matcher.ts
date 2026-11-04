/**
 * Writes `zig/src/locale_matcher/autogen.distance.zig` and `autogen.partition.zig` from the
 * language distance tree, paradigm locales and region partitions in
 * `src/locale-matcher/autogen.*.ts`. Each level of the distance tree is a table sorted by
 * (desired, supported); identical subtrees are shared.
 */
import {
  type DistanceMap,
  type DistanceNode,
  distanceMap,
  paradigmLocales,
} from '../../src/locale-matcher/autogen.distance';
import { macroRegions, regions } from '../../src/locale-matcher/autogen.partition';
import { header, type ZigFile, zigString } from './_emit';

/** A Zig slice literal, formatted as `zig fmt` would. */
const slice = (xs: string[]): string =>
  xs.length === 1 ? `&.{${xs[0]}}` : `&.{ ${xs.join(', ')} }`;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Byte order of the UTF-8, which the Zig lookups use. */
const cmpBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

const distanceFile = (): string => {
  const names = new Map<string, string>();
  const decls: string[] = [];

  // Language and script levels hold [distance, submap]; the region level holds numbers.
  const emitMap = (m: DistanceMap, depth: number): string => {
    const rows: [string, string, string][] = [];
    for (const want of Object.keys(m)) {
      const sub = m[want]!;
      for (const have of Object.keys(sub)) {
        const node = sub[have] as DistanceNode;
        let value: string;
        if (depth < 2) {
          if (typeof node === 'number') {
            throw new Error(`expected a subtree at depth ${depth}: ${want} ${have}`);
          }
          value = `.{ .distance = ${node[0]}, .next = ${emitMap(node[1], depth + 1)} }`;
        } else {
          if (typeof node !== 'number') {
            throw new Error(`expected a number at the region level: ${want} ${have}`);
          }
          value = `.{ .distance = ${node} }`;
        }
        rows.push([want, have, value]);
      }
    }
    rows.sort((a, b) => cmpBytes(a[0], b[0]) || cmpBytes(a[1], b[1]));
    const body = rows.map(
      ([w, h, v]) => `    .{ .want = ${zigString(w)}, .have = ${zigString(h)}, .node = ${v} },`,
    );
    const text = `[_]Entry{\n${body.join('\n')}\n}`;
    let name = names.get(text);
    if (name === undefined) {
      name = depth === 0 ? 'distance_map' : `map${names.size}`;
      names.set(text, name);
      decls.push(`${depth === 0 ? 'pub ' : ''}const ${name} = ${text};\n`);
    }
    return `&${name}`;
  };
  emitMap(distanceMap, 0);

  const paradigms = Object.keys(paradigmLocales).sort(
    (a, b) => paradigmLocales[a] - paradigmLocales[b],
  );
  paradigms.forEach((k, i) => {
    if (paradigmLocales[k] !== i) {
      throw new Error('paradigm locale indices are not 0..n-1');
    }
  });

  return (
    header('locale-matcher', 'src/locale-matcher/autogen.distance.ts') +
    '/// A distance and, above the region level, the next level of the tree.\n' +
    'pub const Node = struct { distance: i32, next: []const Entry = &.{} };\n' +
    'pub const Entry = struct { want: []const u8, have: []const u8, node: Node };\n\n' +
    '/// Paradigm locales by compact tag, in priority order.\n' +
    `pub const paradigm_locales = [_][]const u8{ ${paradigms.map(zigString).join(', ')} };\n\n` +
    '/// Language level of the distance tree, sorted by (want, have); "$" is the wildcard.\n' +
    decls.reverse().join('\n')
  );
};

/** Same as `buildArrayMap` in partition.ts: partitions are single UTF-16 characters. */
const arrayMap = (name: string, raw: string): string => {
  const rows = raw.split('|').map((e): [string, string[]] => {
    const [k, vs] = e.split(':');
    return [k, vs.split('')];
  });
  rows.sort((a, b) => cmp(a[0], b[0]));
  const lines = rows.map(
    ([k, v]) => `    .{ .region = ${zigString(k)}, .partitions = ${slice(v.map(zigString))} },`,
  );
  return `pub const ${name} = [_]Partition{\n${lines.join('\n')}\n};\n`;
};

const partitionFile = (): string =>
  header('locale-matcher', 'src/locale-matcher/autogen.partition.ts') +
  'pub const Partition = struct { region: []const u8, partitions: []const []const u8 };\n\n' +
  '/// The partition of each region, sorted by region.\n' +
  arrayMap('regions', regions) +
  '\n/// The partitions of each macro-region, sorted by region.\n' +
  arrayMap('macro_regions', macroRegions);

export const files = (): ZigFile[] => [
  { path: 'locale_matcher/autogen.distance.zig', content: distanceFile() },
  { path: 'locale_matcher/autogen.partition.zig', content: partitionFile() },
];
