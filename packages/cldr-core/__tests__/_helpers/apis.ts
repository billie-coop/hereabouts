import { config as defaultconfig } from '../../../hereabouts/src/config';
import type { LocaleData, SchemaConfig } from '../../src';
import { VERSION as _VERSION } from '../../src/utils/version';
import { languageBundle } from './bundle';

export const VERSION = _VERSION;

export const buildConfig = (cfg: SchemaConfig): SchemaConfig =>
  ({ ...defaultconfig, ...cfg }) as SchemaConfig;

// The 1.x helpers built a separate API object per area; with the function API they all return
// the locale data that the functions take as their first argument.

export const calendarsApi = (tag: string, config?: SchemaConfig): LocaleData =>
  languageBundle(tag, config);

export const generalApi = (tag: string, config?: SchemaConfig): LocaleData =>
  languageBundle(tag, config);

export const numbersApi = (tag: string, config?: SchemaConfig): LocaleData =>
  languageBundle(tag, config);

export const unitsApi = (tag: string, config?: SchemaConfig): LocaleData =>
  languageBundle(tag, config);
