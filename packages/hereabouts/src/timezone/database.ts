import { binarySearch } from '../utils';
import type { RawData, ZoneInfo, ZoneMeta } from './types';

/**
 * A single local time type of a zone: abbreviation, dst flag and UTC offset.
 *
 * @internal
 */
export interface ZoneInfoRec {
  readonly abbr: string;
  readonly dst: number;
  readonly offset: number;
}

/**
 * Decoded data for a single time zone.
 *
 * @internal
 */
export interface ZoneRecord {
  // metadata
  readonly stdoff: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly countries: string[];

  readonly localtime: readonly ZoneInfoRec[];
  readonly types: readonly number[];
  readonly untils: number[];
}

/**
 * Decoded time zone database. The indices are built when the database is
 * created; individual zone records are decoded on first access and cached
 * in `records`.
 *
 * @internal
 */
export interface TzDatabase {
  /** Mapping of canonical time zone ids to index */
  readonly zoneindex: ReadonlyMap<string, number>;

  /** Mapping of proper- and lower-cased time zone and alias ids to canonical time zone id */
  readonly linkindex: ReadonlyMap<string, string>;

  /** Array of time zone ids */
  readonly zoneids: string[];

  /** Array of untils and deltas */
  readonly untilindex: readonly number[];

  /** Raw un-decoded zone info */
  readonly rawzoneinfo: readonly string[];

  /** Decoded zone records, filled in lazily */
  readonly records: (ZoneRecord | undefined)[];
}

const numarray = (s: string) => (s ? s.split(' ').map((n) => parseInt(n, 36)) : []);

/**
 * Build the time zone database indices from the raw data. Zone records are
 * not decoded here. The raw data is not modified.
 *
 * @internal
 */
export const createTzDatabase = (raw: RawData): TzDatabase => {
  const zoneindex = new Map<string, number>();
  const linkindex = new Map<string, string>();
  const zoneids: string[] = [];

  const ids = raw.zoneids.split('|');

  const addlink = (src: string, dst: string) => {
    // index a few supported forms of the time zone id or alias
    linkindex.set(src, dst);
    linkindex.set(src.toLowerCase(), dst);
  };

  ids.forEach((id, i) => {
    zoneids.push(id);
    zoneindex.set(id, i);

    // index the zone id as a link to itself, including the lowercase form.
    addlink(id, id);
  });

  raw.links.split('|').forEach((e) => {
    const [alias, j] = e.split(':');
    addlink(alias, ids[Number(j)]);
  });

  return {
    zoneindex,
    linkindex,
    zoneids,
    untilindex: numarray(raw.index),
    rawzoneinfo: raw.zoneinfo,
    records: new Array(raw.zoneinfo.length),
  };
};

/**
 * Decode a single zone info record.
 */
const decodeInfo = (raw: string): ZoneInfoRec => {
  const [abbr, _dst, _offset] = raw.split(':');
  return {
    abbr,
    dst: Number(_dst),
    offset: parseInt(_offset, 36) * 1000,
  };
};

/**
 * Decode the packed data for a single zone.
 */
const decodeZoneRecord = (raw: string, index: readonly number[]): ZoneRecord => {
  const [_std, _lat, _lon, _countries, _info, _types, _untils] = raw.split('_');
  const untils = numarray(_untils);

  // Type indices are single base-36 digits [0-9A-Z]
  const types = _types ? _types.split('').map((t) => parseInt(t, 36)) : [];

  // Decode initial until and the deltas
  const len = untils.length;
  if (len > 0) {
    untils[0] = index[untils[0]] * 1000;
    for (let i = 1; i < len; i++) {
      untils[i] = untils[i - 1] + index[untils[i]] * 1000;
    }
  }

  return {
    stdoff: parseInt(_std, 36) * 1000,
    latitude: parseInt(_lat, 36) / 1e6,
    longitude: parseInt(_lon, 36) / 1e6,
    countries: _countries ? _countries.split(',') : [],
    localtime: _info.split('|').map(decodeInfo),
    types,
    untils,
  };
};

/**
 * Find the record for a time zone id or alias, decoding it on first access.
 * Returns the canonical time zone id with its record.
 *
 * @internal
 */
export const tzdbRecord = (db: TzDatabase, zoneid: string): [string, ZoneRecord] | undefined => {
  const id = db.linkindex.get(zoneid);
  // Failed to match a time zone or alias in any of the supported forms
  if (id === undefined) {
    return undefined;
  }

  // Find the offset to the record for this zone.
  const i = db.zoneindex.get(id)!;

  // See if we've already decoded this zone
  let rec = db.records[i];
  if (rec === undefined) {
    rec = decodeZoneRecord(db.rawzoneinfo[i], db.untilindex);
    db.records[i] = rec;
  }

  // Return canonical time zone id with its record
  return [id, rec];
};

/**
 * Resolve the zone info using a UTC timestamp.
 */
const recordFromUTC = (rec: ZoneRecord, utc: number): [number, ZoneInfoRec] => {
  const i = binarySearch(rec.untils, true, utc);
  const type = i === -1 ? 0 : rec.types[i];
  return [utc, rec.localtime[type]];
};

/**
 * Resolve the zone info using a wall clock timestamp in the given zone.
 *
 * We have to determine the nearest DST transition boundary in wall clock
 * time, and choose one side of the boundary based on whether the clock moved
 * backwards or forwards, and where our wall time falls relative to
 * the boundary, or within the transitional gap.
 */
const recordFromWall = (rec: ZoneRecord, wall: number): [number, ZoneInfoRec] => {
  // Find the until one day before our wall time
  let i = binarySearch(rec.untils, true, wall - 86400000);
  const r0 = rec.localtime[i === -1 ? 0 : rec.types[i]];
  i++;

  // Check if we hit the end of the untils array and return
  if (i === rec.types.length) {
    return [wall - r0.offset, r0];
  }

  // Get the next until.
  const r1 = rec.localtime[rec.types[i]];
  const u1 = rec.untils[i];

  // Adjust the next until using the prior offset to find the wall clock time of the boundary.
  //
  // Example for New York on Mar 8, 2020 with DST boundary at 7:00 AM UTC:
  //   1:59 AM NY time is UTC 6:59 AM minus 5 hours
  //
  // 1 minute later the offset changes to -04:00:
  //   2:00 AM NY time is UTC 7:00 AM minus 5 hours, so local time becomes 3:00 AM
  //
  // Example for New York on Nov 1, 2020 with DST boundary at 7:00 AM UTC:
  //   1:59 AM NY time is UTC 5:59 AM minus 4 hours
  //
  // 1 minute later the offset changes to -05:00:
  //   2:00 AM NY time is UTC 6:00 AM minus 4 hours, so local time becomes 1:00 AM

  // Wall time instantaneously at zone boundary
  const w0 = u1 + r0.offset;

  // New wall time after boundary is crossed
  const w1 = u1 + r1.offset;

  // Wall time is before the gap, return pre-boundary offset
  if (wall < w0 && wall < w1) {
    return [wall - r0.offset, r0];
  }

  // When local time jumps forward, the resulting gap contains many "impossible"
  // times. In our example for New York, Mar 8 2020 at 2:30 AM is invalid.
  // We return a UTC timestamp and offset that will make the local time 3:30 AM.
  if (w0 < w1) {
    // Wall time is either in the gap of impossible times or after the gap.
    return wall < w1 ? [wall - r0.offset, r1] : [wall - r1.offset, r1];
  }

  // When local time jumps backwards, many times occur twice.
  // In our example for New York, Nov 1 2020, 1:30 AM occurs once as local
  // time moves towards 2:00 AM, and occurs again after the time has been
  // moved back to 1:00 AM.
  return wall < w0 ? [wall - r0.offset, r0] : [wall - r1.offset, r1];
};

/**
 * Lookup the time zone record and return the UTC timestamp and zone info.
 *
 * @internal
 */
export const tzdbLookup = (
  db: TzDatabase,
  id: string,
  t: number,
  isutc: boolean,
): [number, ZoneInfo] | undefined => {
  const rec = tzdbRecord(db, id);
  if (rec) {
    const [zoneid, r] = rec;
    const [utc, res] = isutc ? recordFromUTC(r, t) : recordFromWall(r, t);
    return [
      utc,
      {
        ...res,
        zoneid,
      },
    ];
  }
  return undefined;
};

/**
 * Metadata for a time zone id or alias.
 *
 * @internal
 */
export const tzdbZoneMeta = (db: TzDatabase, id: string): ZoneMeta | undefined => {
  const rec = tzdbRecord(db, id);
  if (rec) {
    return {
      zoneid: rec[0],
      stdoffset: rec[1].stdoff,
      latitude: rec[1].latitude,
      longitude: rec[1].longitude,
      countries: rec[1].countries,
    };
  }
  return;
};
