import type { DateZoneInfo } from './timezone';

/**
 * The internal type name for Gregorian calendar is "gregory" so that it can fit
 * into a language tag ("zh-u-ca-gregory") as "gregorian" exceeds the 8-char
 * limit.
 * See https://www.unicode.org/reports/tr35/#Key_And_Type_Definitions_
 *
 * @public
 */
export type CalendarType = 'buddhist' | 'gregory' | 'iso8601' | 'japanese' | 'persian';

/**
 * Fields on a CalendarDate.
 *
 * @public
 */
export interface CalendarDateFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millis: number;
  zoneId: string;
}

/**
 * The rules of a calendar system: the calendar-specific arithmetic shared by all of its dates.
 * One record exists per calendar (`gregorianCalendar`, `iso8601Calendar`, `buddhistCalendar`,
 * `japaneseCalendar`, `persianCalendar`); every date carries a reference to its record.
 *
 * @public
 */
export interface CalendarSystem {
  /** Calendar type, e.g. 'gregory'. */
  readonly type: CalendarType;

  /** Name used by `dateToString`, e.g. 'Gregorian'. */
  readonly name: string;

  /** Number of months in a year. */
  readonly monthCount: number;

  /** Amount added to the extended year to give the related (Gregorian) year. */
  readonly relatedYearOffset: number;

  /**
   * Fixed `[firstDay, minDays]` week rule that overrides the locale's (ISO-8601), if any.
   */
  readonly weekRule?: readonly [number, number];

  /** Fields assumed by `dateFromFields` for any the caller leaves out. */
  readonly defaultFields: Readonly<Partial<CalendarDateFields>>;

  /** Number of days in the zero-based month `m` of extended year `y`. */
  readonly daysInMonth: (y: number, m: number) => number;

  /** Number of days in extended year `y`. */
  readonly daysInYear: (y: number) => number;

  /** Julian day of the day before the first day of the zero-based `month` of extended year `eyear`. */
  readonly monthStart: (eyear: number, month: number, useMonth: boolean) => number;

  /**
   * Compute the calendar-specific fields (era, year, month, day, day of year, leap) of a field
   * array whose Julian day and time fields have been set. Only ever called on a fresh array.
   */
  readonly computeFields: (f: number[]) => void;

  /**
   * Resolve a complete set of wall-clock fields to a UTC epoch and the zone id of the resulting
   * date. `zoneId` and `offset` are those of the date the fields are being set on.
   */
  readonly resolveFields: (
    f: Partial<CalendarDateFields>,
    zoneId: string,
    offset: number,
  ) => [number, string];
}

/**
 * A date and time in a given calendar system and time zone. Plain immutable data; use the
 * `date*` functions to read and operate on it.
 *
 * @public
 */
export interface CalendarDate {
  /** Rules of the calendar this date belongs to. */
  readonly calendar: CalendarSystem;

  /** Computed date fields (internal layout, indexed by `DateField`). */
  readonly fields: readonly number[];

  /** Time zone the date is expressed in. */
  readonly zoneInfo: DateZoneInfo;

  /** First day of the week, 1 = Sunday .. 7 = Saturday. */
  readonly firstDay: number;

  /** Minimum days in the first week of the year. */
  readonly minDays: number;
}
