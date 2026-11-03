/**
 * A calendar day in the proleptic Gregorian calendar, such as 31 January 2026. It has no time
 * and no time zone: a due date or a birthday. `month` is 1-12 and `day` is 1-31.
 *
 * Create one with {@link day} or {@link dayParse}; values are never changed after creation.
 *
 * @public
 */
export interface Day {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * A wall clock time, such as 06:30. It has no day and no time zone: the time an alarm rings
 * or a reminder is sent, whatever zone it is resolved in.
 *
 * Create one with {@link timeOfDay} or {@link timeOfDayParse}; values are never changed after
 * creation.
 *
 * @public
 */
export interface TimeOfDay {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millis: number;
}

/**
 * A single moment, the same everywhere: milliseconds since 1970-01-01T00:00:00Z, as returned
 * by `Date.now()`. Durations between instants are plain milliseconds.
 *
 * @public
 */
export type Instant = number;

/**
 * A calendar duration, added to or subtracted from a {@link Day}. Years and months are applied
 * first (the day of month is clamped to the end of a shorter month), then weeks and days.
 *
 * @public
 */
export interface DayDuration {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
}

/**
 * Units for {@link dayUntil}.
 *
 * @public
 */
export type DayUnit = 'days' | 'weeks' | 'months' | 'years';

/**
 * How to turn a wall clock time into an instant when the clocks change on that day.
 *
 * - `compatible` (default): a skipped time moves forward by the length of the gap (02:30 on a
 *   spring-forward day becomes 03:30); a repeated time takes the first occurrence.
 * - `earlier`: the earlier of the two possible instants.
 * - `later`: the later of the two possible instants.
 * - `reject`: throw a RangeError if the time is skipped or repeated.
 *
 * The names and behaviour match the `disambiguation` option of the JavaScript Temporal API.
 *
 * @public
 */
export type Disambiguation = 'compatible' | 'earlier' | 'later' | 'reject';
