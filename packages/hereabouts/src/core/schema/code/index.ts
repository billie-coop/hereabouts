import type { KeyIndex, KeyIndexMap } from '../../../types';
import { keyIndex, type Origin, origin } from '../instructions';
import { AltIndex, DayPeriodAltIndex, EraAltIndex, PluralIndex } from '../schema/enums';
import {
  BUDDHIST,
  BUDDHIST_INDICES,
  CALENDAR_INDICES,
  GREGORIAN,
  GREGORIAN_INDICES,
  JAPANESE,
  JAPANESE_INDICES,
  PERSIAN,
  PERSIAN_INDICES,
} from './calendars';
import { CURRENCIES } from './currencies';
import { DATEFIELDS, DATEFIELDS_INDICES } from './datefields';
import { CONTEXT_TRANSFORM, GENERAL_INDICES, LAYOUT, LIST_PATTERNS } from './general';
import { NAMES } from './names';
import { NUMBERS, NUMBERS_INDICES } from './numbers';
import { TIMEZONE, TIMEZONE_INDICES } from './timezones';
import { UNITS } from './units';

const EMPTY_INDEX = /*#__PURE__*/ keyIndex([]);

const emptyCalendarIndex = (name: string): KeyIndexMap => ({
  [`${name}-available-format`]: EMPTY_INDEX,
  [`${name}-plural-format`]: EMPTY_INDEX,
  [`${name}-era`]: EMPTY_INDEX,
  [`${name}-interval-format`]: EMPTY_INDEX,
  [`${name}-month`]: EMPTY_INDEX,
});

/**
 * @public
 */
export interface SchemaConfig {
  /**
   * Calendar types to include. Note that 'gregory' for the
   * gregorian calendar will be included by default, even if
   * omitted from this list.
   *
   * Ex: ['buddhist', 'japanese', 'persian']
   */
  calendars?: string[];

  /**
   * Control which skeleton date time formats are available at runtime.
   */
  ['gregorian-available-format']?: string[];
  ['gregorian-plural-format']?: string[];
  ['gregorian-interval-format']?: string[];

  ['buddhist-available-format']?: string[];
  ['buddhist-plural-format']?: string[];
  ['buddhist-interval-format']?: string[];

  ['japanese-available-format']?: string[];
  ['japanese-plural-format']?: string[];
  ['japanese-interval-format']?: string[];

  ['persian-available-format']?: string[];
  ['persian-plural-format']?: string[];
  ['persian-interval-format']?: string[];

  /**
   * Currency codes to include.
   *
   * Ex: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', ... ]
   */
  ['currency-id']?: string[];

  /**
   * Language identifiers to include. This only controls
   * inclusion of language display name data.
   */
  ['language-id']?: string[];

  /**
   * Script identifiers to include. This only controls
   * inclusion of script display name data.
   */
  ['script-id']?: string[];

  /**
   * Region identifiers to include. This only controls
   * inclusion of region display name data.
   */
  ['region-id']?: string[];

  /**
   * Units to include.
   *
   * Ex: ['meter', 'kilogram', 'foot']
   */
  ['unit-id']?: string[];

  /**
   * CLDR stable timezone identifiers to include. This only
   * controls inclusion of exemplar city data. All timezone
   * ids and offset data will work even if this array is
   * empty.
   *
   * Ex: ['America/New_York', 'America/Adak', ... ]
   */
  ['timezone-id']?: string[];

  /**
   * Number system names to include. Note that 'latn' will be
   * included by default, even if omitted from this list.
   *
   * Ex: ['arab', 'laoo']
   */
  ['number-system-name']?: string[];
}

type SchemaConfigKey = keyof SchemaConfig;

const COPY: SchemaConfigKey[] = [
  'currency-id',
  'language-id',
  'script-id',
  'region-id',
  'unit-id',
  'timezone-id',
];

/**
 * Creates the origin of the code that builds the schema accessor for a config: the schema
 * instructions plus the key indices they refer to.
 *
 * @public
 */
export const buildOrigin = (config: SchemaConfig): Origin => {
  const indices: { [name: string]: KeyIndex<string> } = {
    'alt-key': AltIndex,
    'day-period-alt-key': DayPeriodAltIndex,
    'era-alt-key': EraAltIndex,
    'plural-key': PluralIndex,
    ...CALENDAR_INDICES,
    ...GREGORIAN_INDICES,
    ...emptyCalendarIndex('buddhist'),
    ...emptyCalendarIndex('japanese'),
    ...emptyCalendarIndex('persian'),
    ...DATEFIELDS_INDICES,
    ...GENERAL_INDICES,
    ...NUMBERS_INDICES,
    ...TIMEZONE_INDICES,
  };

  // Set the key index with the given name.
  const make = (name: string, keys: string[]): void => {
    indices[name] = keyIndex<string>(keys);
  };
  const copy = (name: SchemaConfigKey): void => {
    indices[name] = keyIndex<string>((config[name] as string[]) || []);
  };
  const add = (map: KeyIndexMap): void => {
    for (const name of Object.keys(map)) {
      indices[name] = map[name];
    }
  };

  for (const key of COPY) {
    make(key, config[key] || []);
  }

  // Ensure 'latn' is always defined since its our fallback
  let numberSystemNames = config['number-system-name'] || [];
  if (numberSystemNames.indexOf('latn') === -1) {
    numberSystemNames = numberSystemNames.concat(['latn']);
  }
  make('number-system-name', numberSystemNames);

  const code: any[] = [
    NAMES,
    NUMBERS,
    DATEFIELDS,
    LAYOUT,
    LIST_PATTERNS,
    BUDDHIST,
    GREGORIAN,
    JAPANESE,
    PERSIAN,
    TIMEZONE,
    CURRENCIES,
    UNITS,
    CONTEXT_TRANSFORM,
  ];

  // TODO: upgrading to CLDR 48 BETA 3 caused some tests to fail when
  // the calendar list was empty. For now we ensure it always contains
  // 'gregory'.
  if (!config.calendars || !config.calendars.length) {
    config.calendars = ['gregory'];
  }

  for (const name of config.calendars || []) {
    switch (name) {
      case 'buddhist':
        add(BUDDHIST_INDICES);
        copy('buddhist-available-format');
        copy('buddhist-plural-format');
        copy('buddhist-interval-format');
        break;
      case 'japanese':
        add(JAPANESE_INDICES);
        copy('japanese-available-format');
        copy('japanese-plural-format');
        copy('japanese-interval-format');
        break;
      case 'persian':
        add(PERSIAN_INDICES);
        copy('persian-available-format');
        copy('persian-plural-format');
        copy('persian-interval-format');
        break;
    }
  }

  copy('gregorian-available-format');
  copy('gregorian-plural-format');
  copy('gregorian-interval-format');
  return origin(code, indices);
};
