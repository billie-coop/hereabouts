export * from './exports';

import { config } from './config';
import {
  type CLDRFramework,
  type CLDROptions,
  cldrFramework as coreCLDRFramework,
  createFramework as coreCreateFramework,
  type Framework,
} from './core';

// The resource packs shipped with this package are built with `config`, so it is the default
// schema config here. (1.x set it globally with CLDRFramework.setDefaultConfig on import.)

/**
 * Create a framework for loading locale data. Uses this package's schema config unless the
 * options give one.
 *
 * @public
 */
export const createFramework = (options: CLDROptions): Framework =>
  coreCreateFramework(options, config);

/**
 * Create the convenience loader (`framework.get('en').Numbers.formatDecimal(...)`). Uses this
 * package's schema config unless the options give one.
 *
 * @public
 */
export const cldrFramework = (options: CLDROptions): CLDRFramework =>
  coreCLDRFramework(options, config);

export { config };
