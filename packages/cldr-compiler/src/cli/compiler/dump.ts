import {
  buildOrigin,
  isDigitsArrow,
  isFieldArrow,
  isScopeArrow,
  isVectorArrow,
  type Origin,
} from '@phensley/cldr-core';
import { buildSchema as buildSchemaTree } from '@phensley/cldr-core/lib/internals/schema';
import { checksumIndices } from '@phensley/cldr-core/lib/resource/checksum';
import { VERSION } from '@phensley/cldr-core/lib/utils/version';
import type { Schema } from '@phensley/cldr-types';
import * as fs from 'fs';
import { join } from 'path';
import type * as yargs from 'yargs';
import * as CONFIG from './config.json';

export const loader = (lang: string) => {
  const path = join(__dirname, `../../../../hereabouts/packs/${lang}.json`);
  return fs.readFileSync(path).toString('utf-8');
};

export const buildSchema = (origin: Origin, debug: boolean = false): Schema =>
  buildSchemaTree(origin, debug);

type Entry = [number, string, number, number] | [number, string];

interface Options {
  verbose: boolean;
  indices?: boolean;
}

/**
 * Scan the schema and collect the scope names and start/end offsets.
 */
const scan = (o: any, depth: number, opts: Options): Entry[] => {
  let e: Entry[] = [];
  if (isDigitsArrow(o)) {
    const start = o.offset;
    e.push([depth, 'DigitsArrow', start, start + o.index.size * o.size2]);
  } else if (isFieldArrow(o)) {
    e.push([depth, 'FieldArrow', o.offset, o.offset + 1]);
  } else if (isVectorArrow(o)) {
    const start = o.offset - 1;
    const size = o.keysets.reduce((p, c) => c.size * p, 1);
    e.push([depth, 'VectorArrow', start, start + size + 1]);
  } else if (isScopeArrow(o)) {
    e.push([depth, 'ScopeArrow']);
    for (const key of Object.keys(o.map)) {
      e.push([depth, key]);
      e = e.concat(scan(o.map[key], depth + 1, opts));
    }
  } else {
    for (const key of Object.keys(o)) {
      e.push([depth, key]);
      e = e.concat(scan(o[key], depth + 1, opts));
    }
  }
  return e;
};

/**
 * Display the schema entries.
 */
const display = (entries: Entry[], strings: string[], indices?: boolean) => {
  for (const e of entries) {
    if (e.length === 2) {
      const [depth, key] = e;
      console.log(`${' '.repeat(depth)}${key}`);
    } else {
      const [depth, key, start, end] = e;
      let s = `${' '.repeat(depth)}${key}`;
      if (indices) {
        s += ` (${start}, ${end})`;
      }
      console.log(s);
      console.log(' '.repeat(depth), JSON.stringify(strings.slice(start, end)));
    }
  }
};

interface DumpArgs {
  pack: string;
  indices?: boolean;
  config?: string;
}

export const runDump = (argv: yargs.ArgumentsCamelCase<DumpArgs>) => {
  let raw: string;
  let config: any = CONFIG;

  if (argv.config) {
    raw = fs.readFileSync(argv.config).toString('utf-8');
    config = JSON.parse(raw);
  }

  raw = fs.readFileSync(argv.pack).toString('utf-8');
  const data = JSON.parse(raw);

  const origin = buildOrigin(config);
  const ck = checksumIndices(VERSION, origin.indices);
  console.log(`Checksum ${ck}`);

  const schema = buildSchemaTree(origin, false);

  const opts = { verbose: false, indices: argv.indices };
  Object.keys(data.scripts).forEach((name) => {
    const strings = data.scripts[name].strings.split('_');
    const entries = scan(schema, 1, opts);
    display(entries, strings, opts.indices);
  });
};
