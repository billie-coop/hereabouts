import { createLRU, lruGet, lruSet } from '@phensley/cldr-utils';
import { tagLanguage } from '@phensley/language-tag';
import { resolveLanguageTag, resolveLocaleId } from '@phensley/locale';
import * as subprocess from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import { config as defaultconfig } from '../../../cldr/src/config';
import {
  buildOrigin,
  type CLDRFramework,
  cldrFramework,
  type LocaleData,
  localeData,
  packGet,
  loadPack as parsePack,
  type SchemaConfig,
} from '../../src';
import { buildSchema } from '../../src/internals/schema';
import type { Pack } from '../../src/resource';
import { VERSION } from '../../src/utils/version';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json');

const TEMPROOT = join(__dirname, '..', '..', '.custom-packs');

const bundleCache = createLRU<LocaleData>(15);

interface PackSpec {
  hash: string;
  config: string;
}

const makedir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir);
    } catch (err) {
      // error if this block is entered by concurrent processes
      console.log(`concurrent mkdir attempt: ${err}`);
    }
  }
};

/**
 * Configure a framework with a loader that will load a custom resource pack.
 * This allows us to test purposefully-mismatched resource pack and framework
 * checksums;
 */
export const customFramework = (path: string, config: SchemaConfig): CLDRFramework => {
  const loader = (_lang: string) => fs.readFileSync(path).toString('utf-8');
  return cldrFramework({
    config,
    debug: true,
    loader,
  });
};

/**
 * Ensure a custom resource pack is created and return its filesystem path.
 */
export const customPack = (tag: string, config: SchemaConfig): string => {
  const locale = resolveLanguageTag(tag);
  const language = tagLanguage(locale);
  const json = JSON.stringify(config);
  const hash = createHash('sha256').update(json).update(VERSION).digest('hex');
  return buildPack(language, { hash, config: json });
};

/**
 * Create a resource pack on the fly with the given config.
 */
const buildPack = (lang: string, spec: PackSpec): string => {
  const { hash, config } = spec;
  makedir(TEMPROOT);
  makedir(join(TEMPROOT, hash));

  const configpath = join(TEMPROOT, hash, 'config.json');
  if (!fs.existsSync(configpath)) {
    fs.writeFileSync(configpath, config, { encoding: 'utf-8' });
  }

  const outdir = join(TEMPROOT, hash);
  const path = join(outdir, `${lang}.json`);
  if (!fs.existsSync(path)) {
    // compile the pack with the workspace's built compiler (no node_modules/.bin lookup, so it
    // works with any package manager layout)
    const compiler = join(__dirname, '..', '..', '..', 'cldr-compiler', 'bin', 'compiler.js');
    const args = [compiler, 'pack', '-l', lang, '-o', outdir, '-c', configpath];
    subprocess.execFileSync(process.execPath, args, { cwd: __dirname });
  }
  return path;
};

/**
 * Load a resource pack for a given language.
 */
export const loadPack = (language: string, spec?: PackSpec): Pack => {
  let path: string;
  if (spec === undefined) {
    path = join(__dirname, '..', '..', '..', 'cldr', 'packs', `${language}.json`);
  } else {
    path = buildPack(language, spec);
  }
  const raw = fs.readFileSync(path).toString('utf-8');
  return parsePack(raw);
};

// Schema accessors per config, built once per config (1.x built them per Internals instance).
const schemaCache = new Map<string, Pick<LocaleData, 'schema' | 'indices' | 'config'>>();

const schemaFor = (config: SchemaConfig) => {
  const key = JSON.stringify(config);
  let s = schemaCache.get(key);
  if (s === undefined) {
    const origin = buildOrigin(config);
    s = { schema: buildSchema(origin), indices: origin.indices, config };
    schemaCache.set(key, s);
  }
  return s;
};

/**
 * Load the locale data for a given language tag: the resource bundle plus the schema for the
 * config. If resource file does not exist it is generated.
 */
export const languageBundle = (tag: string, config?: SchemaConfig): LocaleData => {
  const locale = resolveLanguageTag(tag);
  const language = tagLanguage(locale);
  let spec: PackSpec | undefined;
  let key = tag;
  if (config !== undefined) {
    const raw = JSON.stringify(config);
    const hash = createHash('sha256').update(raw).update(VERSION).digest('hex');
    spec = { hash, config: raw };
    key = `${hash}-${pkg.version}-${tag}`;
  }

  let bundle = lruGet(bundleCache, key);
  if (bundle === undefined) {
    const pack = loadPack(language, spec);
    const s = schemaFor(config || defaultconfig);
    bundle = localeData(resolveLocaleId(tag), packGet(pack, locale), s.schema, s.indices, s.config);
    lruSet(bundleCache, key, bundle);
  }
  return bundle;
};
