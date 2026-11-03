// Convenience layer: the 1.x-style "batteries included" API, built by binding the locale
// functions to a LocaleData. Importing this module pulls in every locale function; use the
// functions directly (e.g. `formatDecimal(locale, n)`) when bundle size matters.

import type { Schema } from '@phensley/cldr-types';
import { decimal } from '@phensley/decimal';
import { parseLanguageTag } from '@phensley/language-tag';
import type { Locale } from '@phensley/locale';

import type { Calendars, General, Numbers, Units } from './api/api';
import * as cal from './api/calendars';
import * as gen from './api/general';
import * as num from './api/numbers';
import * as uni from './api/units';
import {
  type CLDROptions,
  createFramework,
  type Framework,
  frameworkInfo,
  loadLocale,
  loadLocaleAsync,
  resolveLocale,
} from './framework';
import { getCurrencyForRegion, getCurrencyFractions } from './internals/numbers/util';
import type { LocaleData } from './locale-data';
import type { SchemaConfig } from './schema/code/index';

/**
 * Interface exporting all functionality for a given locale.
 *
 * @public
 */
export interface CLDR {
  /**
   * Calendar functions.
   */
  readonly Calendars: Calendars;

  /**
   * General functions.
   */
  readonly General: General;

  /**
   * Number and currency functions.
   */
  readonly Numbers: Numbers;

  /**
   * Unit quantity functions.
   */
  readonly Units: Units;

  /**
   * UNDOCUMENTED AND EXPERIMENTAL
   *
   * Provides access to the low-level schema for accessing CLDR fields.
   *
   * @internal
   */
  readonly Schema: Schema;

  /**
   * The locale data the functions are bound to. Pass it to the locale functions directly.
   */
  readonly data: LocaleData;
}

/**
 * Bind the calendar functions to a locale.
 *
 * @public
 */
export const bindCalendars = (data: LocaleData): Calendars => ({
  firstDayOfWeek: () => cal.firstDayOfWeek(data),
  minDaysInFirstWeek: () => cal.minDaysInFirstWeek(data),
  dateField: (type, options) => cal.dateField(data, type, options),
  dayPeriods: (options) => cal.dayPeriods(data, options),
  eras: (options) => cal.eras(data, options),
  months: (options) => cal.months(data, options),
  quarters: (options) => cal.quarters(data, options),
  weekdays: (options) => cal.weekdays(data, options),
  toBuddhistDate: (date) => cal.toBuddhistDate(data, date),
  newBuddhistDate: (fields) => cal.newBuddhistDate(data, fields),
  toGregorianDate: (date) => cal.toGregorianDate(data, date),
  newGregorianDate: (fields) => cal.newGregorianDate(data, fields),
  toISO8601Date: (date) => cal.toISO8601Date(data, date),
  newISO8601Date: (fields) => cal.newISO8601Date(data, fields),
  toJapaneseDate: (date) => cal.toJapaneseDate(data, date),
  newJapaneseDate: (fields) => cal.newJapaneseDate(data, fields),
  toPersianDate: (date) => cal.toPersianDate(data, date),
  newPersianDate: (fields) => cal.newPersianDate(data, fields),
  fieldOfVisualDifference: (a, b) => cal.fieldOfVisualDifference(data, a, b),
  formatDate: (date, options) => cal.formatDate(data, date, options),
  formatDateToParts: (date, options) => cal.formatDateToParts(data, date, options),
  formatDateInterval: (start, end, options) => cal.formatDateInterval(data, start, end, options),
  formatDateIntervalToParts: (start, end, options) =>
    cal.formatDateIntervalToParts(data, start, end, options),
  formatRelativeTimeField: (value, field, options) =>
    cal.formatRelativeTimeField(data, value, field, options),
  formatRelativeTime: (start, end, options) => cal.formatRelativeTime(data, start, end, options),
  formatDateRaw: (date, options) => cal.formatDateRaw(data, date, options),
  formatDateRawToParts: (date, options) => cal.formatDateRawToParts(data, date, options),
  formatDateWrapper: (date, time, options) => cal.formatDateWrapper(data, date, time, options),
  formatDateWrapperToParts: (date, time, options) =>
    cal.formatDateWrapperToParts(data, date, time, options),
  now: (zoneId) => cal.now(data, zoneId),
  nowBuddhist: (zoneId) => cal.nowBuddhist(data, zoneId),
  nowGregorian: (zoneId) => cal.nowGregorian(data, zoneId),
  nowISO8601: (zoneId) => cal.nowISO8601(data, zoneId),
  nowJapanese: (zoneId) => cal.nowJapanese(data, zoneId),
  nowPersian: (zoneId) => cal.nowPersian(data, zoneId),
  timeData: () => cal.timeData(data),
  timeZoneIds: cal.timeZoneIds,
  resolveTimeZoneId: cal.resolveTimeZoneId,
  timeZoneInfo: (zoneid) => cal.timeZoneInfo(data, zoneid),
  timePeriodToQuantity: cal.timePeriodToQuantity,
  timeZoneFromUTC: cal.timeZoneFromUTC,
  timeZoneFromWall: cal.timeZoneFromWall,
});

/**
 * Bind the general functions to a locale.
 *
 * @public
 */
export const bindGeneral = (data: LocaleData): General => ({
  characterOrder: () => gen.characterOrder(data),
  lineOrder: () => gen.lineOrder(data),
  bundle: () => data,
  locale: () => data.locale,
  resolveLocale,
  parseLanguageTag,
  messageFormatter: (options) => gen.messageFormatter(data, options),
  measurementSystem: (category) => gen.measurementSystem(data, category),
  formatList: (items, type) => gen.formatList(data, items, type),
  formatListToParts: (items, type) => gen.formatListToParts(data, items, type),
  getLanguageDisplayName: (code, options) => gen.getLanguageDisplayName(data, code, options),
  getScriptDisplayName: (code, options) => gen.getScriptDisplayName(data, code, options),
  getRegionDisplayName: (code, options) => gen.getRegionDisplayName(data, code, options),
});

/**
 * Bind the number and currency functions to a locale.
 *
 * @public
 */
export const bindNumbers = (data: LocaleData): Numbers => ({
  adjustDecimal: (n, options) => num.adjustDecimal(data, n, options),
  parseDecimal: (n) => decimal(n),
  formatDecimal: (n, options) => num.formatDecimal(data, n, options),
  formatDecimalToParts: (n, options) => num.formatDecimalToParts(data, n, options),
  formatCurrency: (n, code, options) => num.formatCurrency(data, n, code, options),
  formatCurrencyToParts: (n, code, options) => num.formatCurrencyToParts(data, n, code, options),
  getCurrencySymbol: (code, width) => num.getCurrencySymbol(data, code, width),
  getCurrencyDisplayName: (code, options) => num.getCurrencyDisplayName(data, code, options),
  getCurrencyPluralName: (n, code, options) => num.getCurrencyPluralName(data, n, code, options),
  getCurrencyFractions,
  getCurrencyForRegion,
  getPluralCardinal: (n, options) => num.getPluralCardinal(data, n, options),
  getPluralOrdinal: (n, options) => num.getPluralOrdinal(data, n, options),
});

/**
 * Bind the unit functions to a locale.
 *
 * @public
 */
export const bindUnits = (data: LocaleData): Units => ({
  availableUnits: () => uni.availableUnits(data),
  getUnitDisplayName: (name, length) => uni.getUnitDisplayName(data, name, length),
  formatQuantity: (q, options) => uni.formatQuantity(data, q, options),
  formatQuantityToParts: (q, options) => uni.formatQuantityToParts(data, q, options),
  formatQuantitySequence: (q, options) => uni.formatQuantitySequence(data, q, options),
  formatQuantitySequenceToParts: (q, options) =>
    uni.formatQuantitySequenceToParts(data, q, options),
});

/**
 * Build the convenience object for a locale. Each group is bound on first access.
 *
 * @public
 */
export const bindCLDR = (data: LocaleData): CLDR => {
  const api = { Schema: data.schema, data } as CLDR;
  // The bound function groups are built on first access. They are non-enumerable so the object
  // compares and serializes as its data.
  const group = <T>(name: string, bind: (d: LocaleData) => T): void => {
    let value: T | undefined;
    Object.defineProperty(api, name, {
      enumerable: false,
      get: () => value || (value = bind(data)),
    });
  };
  group('Calendars', bindCalendars);
  group('General', bindGeneral);
  group('Numbers', bindNumbers);
  group('Units', bindUnits);
  return api;
};

/**
 * Convenience loader: loads locales and returns the bound CLDR object.
 *
 * @public
 */
export interface CLDRFramework {
  /** The underlying framework (schema and pack cache), for use with the locale functions. */
  readonly framework: Framework;

  /** The schema config in use. */
  config(): SchemaConfig;

  /** Diagnostic information. */
  info(): string;

  /**
   * Synchronously load a bundle and construct an instance of an API for
   * a given locale.
   */
  get(locale: Locale | string): CLDR;

  /**
   * Asynchronously load a bundle and construct an instance of an API for
   * a given locale.
   */
  getAsync(locale: Locale | string): Promise<CLDR>;
}

/**
 * Create the convenience loader. The config defaults to the given default config (the
 * @phensley/cldr package passes its bundled config here).
 *
 * @public
 */
export const cldrFramework = (
  options: CLDROptions,
  defaultConfig?: SchemaConfig,
): CLDRFramework => {
  const framework = createFramework(options, defaultConfig);
  // The framework caches locale data, so the same CLDR object is returned for the same locale.
  const bound = new WeakMap<LocaleData, CLDR>();
  const bind = (data: LocaleData): CLDR => {
    let api = bound.get(data);
    if (!api) {
      api = bindCLDR(data);
      bound.set(data, api);
    }
    return api;
  };
  return {
    framework,
    config: () => framework.config,
    info: () => frameworkInfo(framework),
    get: (locale) => bind(loadLocale(framework, locale)),
    getAsync: (locale) => loadLocaleAsync(framework, locale).then(bind),
  };
};
