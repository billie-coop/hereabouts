import * as yargs from 'yargs';
import { codeOptions } from './code';
import { preprocessOptions } from './preprocess';
import { schemaOptions } from './schema';
import { statsOptions } from './stats';
import { unicodeOptions } from './unicode';

export const main = () => {
  const argv = yargs.option('n', { alias: 'dry-run', type: 'boolean', description: 'Dry run' });

  codeOptions(argv);
  preprocessOptions(argv);
  schemaOptions(argv);
  statsOptions(argv);
  unicodeOptions(argv);

  argv.demandCommand(1, 'Please specify a command').help('help').alias('h', 'help').parse();
};
