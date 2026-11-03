import { rawdata } from './autogen.zonedata';
import { createTzDatabase, type TzDatabase, tzdbLookup, tzdbZoneMeta } from './database';
import type { RawData, ZoneInfo, ZoneMeta } from './types';

/**
 * The time zone data bundled with this package, generated from the tz database.
 * This is the active data unless replaced with {@link setTimeZoneData}.
 *
 * @public
 */
export const defaultTimeZoneData: RawData = rawdata;

// Active raw data, and its decoded form, built on first use.
let active: RawData = rawdata;
let database: TzDatabase | undefined;

const db = (): TzDatabase => database || (database = createTzDatabase(active));

/**
 * Replace the active time zone data used by the `tz*` functions. The new data
 * is decoded on first use. Pass {@link defaultTimeZoneData} to restore the
 * bundled data.
 *
 * @public
 */
export const setTimeZoneData = (raw: RawData): void => {
  active = raw;
  database = undefined;
};

const UTC_INFO: ZoneInfo = { zoneid: 'Etc/UTC', abbr: 'UTC', dst: 0, offset: 0 };

/**
 * Get the info for a time zone using a UTC timestamp.
 *
 * @public
 */
export const tzFromUTC = (zoneid: string, utc: number): ZoneInfo | undefined => {
  const r = tzdbLookup(db(), zoneid, utc, true);
  return r ? r[1] : r;
};

/**
 * Get the info for a time zone using a Wall Clock timestamp. This returns
 * the corresponding UTC timestamp and the timezone info record, or undefined
 * if the zone lookup fails.
 *
 * Since daylight savings time can result in a clock being moved backwards,
 * there is some ambiguity in resolving a wall clock time to the corresponding
 * UTC time. For example, on November 8 2020 in New York, the time 1:30 AM
 * occurs twice: once before the timezone boundary of 2:00 AM is reached, and
 * again after the clock is set back 1 hour to 1:00 AM. This function attempts
 * to resolve the ambiguity in the most intuitive way.
 *
 * @public
 */
export const tzFromWall = (zoneid: string, wall: number): [number, ZoneInfo] | undefined =>
  tzdbLookup(db(), zoneid, wall, false);

/**
 * Resolve a lowercase time zone id or alias into the canonical proper-cased id.
 *
 * @public
 */
export const tzResolveId = (id: string): string | undefined => db().linkindex.get(id);

/**
 * UTC zone info.
 *
 * @public
 */
export const tzUtcZone = (): ZoneInfo => UTC_INFO;

/**
 * Metadata related to a zone, such as the list of country codes that overlap with
 * the zone, the latitude and longitude, and the current standard offset, in milliseconds.
 * These can be used to display user interfaces for selecting a zone.
 *
 * If the zone identifier does not match a known zone or alias this returns undefined.
 *
 * @public
 */
export const tzZoneMeta = (id: string): ZoneMeta | undefined => tzdbZoneMeta(db(), id);

/**
 * Returns an array of time zone ids.
 *
 * @public
 */
export const tzZoneIds = (): string[] => db().zoneids;
