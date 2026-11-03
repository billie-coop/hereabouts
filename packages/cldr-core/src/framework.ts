import type { KeyIndexMap, Schema } from '@phensley/cldr-types';
import { createLRU, type LRU, lruGet, lruSet, lruSize } from '@phensley/cldr-utils';
import { type LanguageTag, tagCompact, tagLanguage } from '@phensley/language-tag';
import { type Locale, resolveLanguageTag } from '@phensley/locale';

import { buildSchema } from './internals/schema';
import { type LocaleData, localeData } from './locale-data';
import { checksumIndices } from './resource/checksum';
import { loadPack, type Pack, packGet } from './resource/pack';
import { buildOrigin, type SchemaConfig } from './schema/code/index';
import { VERSION } from './utils/version';

const enum Messages {
  CHECKSUM = 'Checksum mismatch on resource pack! The schema config used to ' +
    'generate the resource pack must be identical to the one used at runtime.',
  LOCALE_UNDEFINED = 'The "locale" argument is undefined',
  NO_ASYNC_LOADER = 'A Promise-based resource loader is not defined',
  NO_SYNC_LOADER = 'A synchronous resource loader is not defined',
}

/**
 * Options to initialize the library.
 *
 * @public
 */
export interface CLDROptions {
  /**
   * Log some messages.
   */
  debug?: boolean;

  /**
   * Customizing of the schema.
   */
  config?: SchemaConfig;

  /**
   * Given a language identifier, fetch the resource pack from the
   * filesystem, webserver, etc, and return the raw decompressed string.
   */
  loader?: (language: string) => any;

  asyncLoader?: (language: string) => Promise<any>;

  /**
   * Number of language-wide resource packs to keep in memory.
   *
   * Note: a language pack will only be garbage collected once all instances
   * using it are garbage collected, so if you hold onto instances the cache
   * may be ineffective.
   */
  packCacheSize?: number;

  /**
   * Number of loaded locales to keep, so loading the same locale again returns the same
   * locale data (and its derived caches: number params, date patterns, message formatter).
   * Default 64.
   */
  localeCacheSize?: number;

  /**
   * Size of internal pattern caches. Accepted for compatibility; the pattern caches are now
   * shared module-level caches of a fixed size.
   */
  patternCacheSize?: number;

  /**
   * Skip calculting the schema checksums. The checksum detects when the schema
   * does not match the loaded resource pack and throws an error.
   */
  skipChecksum?: boolean;
}

/**
 * Loader state: the schema built from the config, and a cache of loaded resource packs.
 * Create one with `createFramework()` and load locales with `loadLocale()`.
 *
 * @public
 */
export interface Framework {
  readonly options: CLDROptions;
  readonly config: SchemaConfig;
  readonly schema: Schema;
  readonly indices: KeyIndexMap;
  /** Checksum of the schema config, compared with each pack's. Empty when skipChecksum is set. */
  readonly checksum: string;
  readonly packCache: LRU<Pack>;
  /** Locale data already built, by locale id and resolved tag. */
  readonly localeCache: LRU<LocaleData>;
}

const EMPTY_CONFIG: SchemaConfig = {};

/**
 * Build the schema for the options' config (or the given default config) and set up the pack
 * cache.
 *
 * @public
 */
export const createFramework = (options: CLDROptions, defaultConfig?: SchemaConfig): Framework => {
  const config = options.config || defaultConfig || EMPTY_CONFIG;
  const origin = buildOrigin(config);
  return {
    options,
    config,
    schema: buildSchema(origin, options.debug),
    indices: origin.indices,
    checksum: options.skipChecksum ? '' : checksumIndices(VERSION, origin.indices),
    packCache: createLRU<Pack>(options.packCacheSize || 2),
    localeCache: createLRU<LocaleData>(options.localeCacheSize || 64),
  };
};

/**
 * Synchronously load the resource pack for a locale (or use the cached one) and return the
 * locale data. Mainly used when you want to load a language statically when your application's
 * state store is initialized.
 *
 * @public
 */
export const loadLocale = (framework: Framework, locale: Locale | string): LocaleData => {
  const { loader } = framework.options;
  must(loader, Messages.NO_SYNC_LOADER);
  must(locale, Messages.LOCALE_UNDEFINED);
  const resolved = typeof locale === 'string' ? resolveLocale(locale) : locale;
  const key = cacheKey(resolved);
  const cached = lruGet(framework.localeCache, key);
  if (cached !== undefined) {
    return cached;
  }
  const language = tagLanguage(resolved.tag);

  let pack = lruGet(framework.packCache, language);
  if (pack === undefined) {
    const data = loader!(language);
    pack = loadPack(data);
    check(framework, pack);
    lruSet(framework.packCache, language, pack);
  }
  return remember(framework, key, build(framework, resolved, pack));
};

/**
 * Asynchronously load the resource pack for a locale (or use the cached one) and return the
 * locale data.
 *
 * @public
 */
export const loadLocaleAsync = (
  framework: Framework,
  locale: Locale | string,
): Promise<LocaleData> => {
  const { asyncLoader } = framework.options;
  must(asyncLoader, Messages.NO_ASYNC_LOADER);
  must(locale, Messages.LOCALE_UNDEFINED);
  const resolved = typeof locale === 'string' ? resolveLocale(locale) : locale;
  const key = cacheKey(resolved);
  const cached = lruGet(framework.localeCache, key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }
  const language = tagLanguage(resolved.tag);

  return new Promise<LocaleData>((resolve, reject) => {
    const pack = lruGet(framework.packCache, language);
    if (pack !== undefined) {
      resolve(remember(framework, key, build(framework, resolved, pack)));
      return;
    }

    // Resolve via the promise loader
    asyncLoader!(language)
      .then((raw) => {
        const _pack = loadPack(raw);
        check(framework, _pack);
        lruSet(framework.packCache, language, _pack);
        resolve(remember(framework, key, build(framework, resolved, _pack)));
      })
      .catch(reject);
  });
};

/**
 * Number of resource packs currently cached, as a string for diagnostics.
 *
 * @public
 */
export const frameworkInfo = (framework: Framework): string =>
  `packs loaded: ${lruSize(framework.packCache)}`;

/**
 * Return the library version.
 *
 * @public
 */
export const cldrVersion = (): string => VERSION;

/**
 * Parse a locale identifier and resolve it. This returns a Locale object
 * that includes the original id string or tag's compact form, and
 * a resolved LanguageTag.
 *
 * @public
 */
export const resolveLocale = (id: string | LanguageTag): Locale => {
  const _id = typeof id === 'string' ? id : tagCompact(id);
  const tag = resolveLanguageTag(id);
  return { id: _id, tag };
};

// The id as given ('en_CA' and 'en-CA' are different ids) and the tag it resolved to.
const cacheKey = (locale: Locale): string => `${locale.id}\u0000${tagCompact(locale.tag)}`;

const remember = (framework: Framework, key: string, data: LocaleData): LocaleData => {
  lruSet(framework.localeCache, key, data);
  return data;
};

const build = (framework: Framework, locale: Locale, pack: Pack): LocaleData =>
  localeData(
    locale,
    packGet(pack, locale.tag),
    framework.schema,
    framework.indices,
    framework.config,
  );

/**
 * Verify the resource pack is compatible with the schema config checksum.
 */
const check = (framework: Framework, pack: Pack): void => {
  if (!framework.options.skipChecksum && pack.checksum !== framework.checksum) {
    throw new Error(Messages.CHECKSUM);
  }
};

const must = (arg: any, message: string): void => {
  if (arg === undefined) {
    throw new Error(message);
  }
};
