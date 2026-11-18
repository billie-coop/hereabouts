/**
 * Writes `zig/src/core/schema/autogen.schema.zig`: the schema accessor tree for the shipped
 * schema config (`src/config.ts`), as Zig constants.
 *
 * It runs the TypeScript `buildOrigin(config)` and `buildSchema(origin)` and emits the result:
 * the key indices (with a sorted permutation for lookups), every arrow's offsets and the config
 * checksum. The TypeScript stays the single definition of the resource pack layout; the Zig
 * types the tree is written into live in `zig/src/core/types/schema.zig`.
 */
import { config } from '../../src/config';
import { buildSchema } from '../../src/core/internals/schema';
import { checksumIndices } from '../../src/core/resource/checksum';
import { buildOrigin, type SchemaConfig } from '../../src/core/schema/code';
import { VERSION } from '../../src/core/utils/version';
import type { KeyIndex } from '../../src/types';
import { header, type ZigFile, zigIdent, zigString } from './_emit';

/** Positions of the keys in UTF-8 byte order; for a repeated key only its last position. */
const sortedPositions = (keys: readonly string[]): number[] => {
  const last = new Map<string, number>();
  keys.forEach((k, i) => last.set(k, i));
  return Array.from(last.entries())
    .sort((a, b) => Buffer.compare(Buffer.from(a[0], 'utf8'), Buffer.from(b[0], 'utf8')))
    .map((e) => e[1]);
};

/** An array literal spaced as `zig fmt` spaces it. */
const list = (xs: (string | number)[]): string =>
  xs.length === 0 ? '&.{}' : xs.length === 1 ? `&.{${xs[0]}}` : `&.{ ${xs.join(', ')} }`;

export const files = (): ZigFile[] => {
  // buildOrigin may fill in defaults, so give it a copy.
  const cfg = JSON.parse(JSON.stringify(config)) as SchemaConfig;
  const origin = buildOrigin(cfg);
  const schema = buildSchema(origin) as any;
  const indices = origin.indices;
  const names = Object.keys(indices);

  // Arrows refer to the key index objects; name them (several names can share one object).
  const nameOf = new Map<KeyIndex<string>, string>();
  for (const n of names) {
    if (!nameOf.has(indices[n])) {
      nameOf.set(indices[n], n);
    }
  }
  const ref = (ki: KeyIndex<string>): string => {
    const n = nameOf.get(ki);
    if (n === undefined) {
      throw new Error('arrow refers to an unknown key index');
    }
    return `&indices.${zigIdent(n)}`;
  };

  let out = '';
  const emit = (s: string): void => {
    out += s;
  };

  const value = (v: any, indent: string): string => {
    const inner = `${indent}    `;
    switch (v.kind) {
      case 'field':
        return `.{ .offset = ${v.offset} }`;
      case 'vector':
        return (
          `.{ .offset = ${v.offset}, .keysets = ${list(v.keysets.map(ref))}, ` +
          `.factors = ${list(v.factors)} }`
        );
      case 'digits':
        return `.{ .offset = ${v.offset}, .index = ${ref(v.index)}, .len = ${v.values.length} }`;
      case 'scope': {
        const keys = Object.keys(v.map);
        const owner = names.find((n) => {
          const k = indices[n].keys;
          return k.length === keys.length && k.every((x: string, i: number) => x === keys[i]);
        });
        if (owner === undefined) {
          throw new Error(`no key index for scope keys ${keys.join(',')}`);
        }
        const vals = keys.map((k) => `${inner}    ${value(v.map[k], `${inner}    `)}, // ${k}`);
        return (
          `.{\n${inner}.keys = &indices.${zigIdent(owner)},\n${inner}.values = &.{\n` +
          `${vals.join('\n')}\n${inner}},\n${indent}}`
        );
      }
      default: {
        const fields = Object.keys(v).map(
          (k) => `${inner}.${zigIdent(k)} = ${value(v[k], inner)},`,
        );
        return `.{\n${fields.join('\n')}\n${indent}}`;
      }
    }
  };

  emit(header('core-schema', 'src/core/schema (buildOrigin and buildSchema on src/config.ts)'));
  emit('const KeyIndex = @import("instructions.zig").KeyIndex;\n');
  emit('const Schema = @import("../types/schema.zig").Schema;\n\n');
  emit('/// Library version the packs are built for (`VERSION`).\n');
  emit(`pub const version = ${zigString(VERSION)};\n\n`);
  emit(
    "/// Checksum of the key indices, compared with each resource pack's (`checksumIndices`).\n",
  );
  emit(`pub const checksum = ${zigString(checksumIndices(VERSION, indices))};\n\n`);
  emit('/// Key indices of the shipped schema config, by name.\n');
  emit('pub const indices = struct {\n');
  for (const n of names) {
    const ki = indices[n];
    const keys = ki.keys.map((k: string) => zigString(k));
    emit(`    pub const ${zigIdent(n)}: KeyIndex = .{\n`);
    emit(`        .keys = ${list(keys)},\n`);
    emit(`        .sorted = ${list(sortedPositions(ki.keys))},\n`);
    emit('    };\n');
  }
  emit('};\n\n');
  emit('/// Names of the key indices, in the order `buildOrigin` creates them.\n');
  emit('pub const index_names = [_][]const u8{\n');
  for (const n of names) {
    emit(`    ${zigString(n)},\n`);
  }
  emit('};\n\n');
  emit('/// The key index with the given name.\n');
  emit('pub fn index(name: []const u8) ?*const KeyIndex {\n');
  emit('    const eql = @import("std").mem.eql;\n');
  for (const n of names) {
    emit(`    if (eql(u8, name, ${zigString(n)})) return &indices.${zigIdent(n)};\n`);
  }
  emit('    return null;\n}\n\n');
  emit("/// The schema accessor tree: where each value lives in a bundle's string table.\n");
  emit(`pub const schema: Schema = ${value(schema, '')};\n`);
  return [{ path: 'core/schema/autogen.schema.zig', content: out }];
};
