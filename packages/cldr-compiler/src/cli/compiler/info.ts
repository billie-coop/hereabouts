import type yargs from 'yargs';
import { availableLocales } from '../../../../hereabouts/src/core';
import { getProjectInfo } from './util';

// biome-ignore lint/suspicious/noEmptyInterface: the info command takes no arguments
export interface InfoArgs {}

export const runInfo = (_args: yargs.ArgumentsCamelCase<InfoArgs>) => {
  const pkg = getProjectInfo();
  console.log(`Library version ${pkg.version}`);
  console.log(`CLDR version ${pkg.cldrVersion}`);
  const locales = availableLocales();
  console.log(`Available locales: ${locales.length}`);
};
