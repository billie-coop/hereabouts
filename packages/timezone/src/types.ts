/**
 * Raw time zone data, as generated from the tz database. See setTimeZoneData.
 *
 * @public
 */
export interface RawData {
  /**
   * Compressed index of until deltas.
   */
  index: string;

  /**
   * Time zone ids.
   */
  zoneids: string;

  /**
   * Time zone links.
   */
  links: string;

  /**
   * Array of packed zone infos sorted to match zone ids.
   */
  zoneinfo: string[];
}

/**
 * Represents abbreviation, daylight savings and timezone offset for
 * a single time zone.
 *
 * @public
 */
export interface ZoneInfo {
  /**
   * Time zone identifier.
   */
  zoneid: string;

  /**
   * Time zone 3-character abbreviation.
   */
  abbr: string;

  /**
   * Flag indicating the zone is currently in daylight savings time.
   */
  dst: number;

  /**
   * Time zone offset from UTC.
   */
  offset: number;
}

/**
 * Represents metadata associated with a timezone.
 *
 * @public
 */
export interface ZoneMeta {
  /**
   * Time zone identifier. Corrected if the metadata was looked up using an alias.
   */
  zoneid: string;

  /**
   * Current standard offset from UTC, in milliseconds.
   */
  stdoffset: number;

  /**
   * Latitude of the zone's "principal location".
   */
  latitude: number;

  /**
   * Longitude of the zone's "principal location".
   */
  longitude: number;

  /**
   * ISO 3166 2-character country code for all countries which
   * overlap the timezone.
   */
  countries: string[];
}
