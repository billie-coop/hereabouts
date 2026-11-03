import { toGregorianDate } from '../../../../src/core';

import {
  calendarPatterns,
  patternsAvailablePattern,
  patternsDatePattern,
  patternsIntervalPattern,
  patternsMatchInterval,
  patternsParseSkeleton,
  patternsTimePattern,
  patternsWrapperPattern,
} from '../../../../src/core/internals/calendars/patterns';
import type { DateSkeleton } from '../../../../src/core/internals/calendars/skeleton';
import { calendarsApi, languageBundle } from '../../_helpers';

// March 11, 2018 7:00:25 AM UTC
const MARCH_11_2018_070025_UTC = 1520751625000;

test('calendar patterns', () => {
  let skel: DateSkeleton;

  const bundle = languageBundle('en');
  const api = calendarsApi('en');

  const impl = calendarPatterns(bundle, bundle.schema.Buddhist, false);

  const date = toGregorianDate(api, { date: MARCH_11_2018_070025_UTC, zoneId: 'America/New_York' });
  skel = patternsParseSkeleton(impl, 'y');
  const pattern = patternsAvailablePattern(impl, date, skel);
  expect(pattern).toEqual([['y', 1], ' ', ['G', 1]]);

  // Interval matching has minutes resolution
  skel = patternsMatchInterval(impl, patternsParseSkeleton(impl, 'mm'))!.skeleton!;
  expect(skel.skeleton).toEqual('Hm');
  expect(skel.isTime).toEqual(true);
});

test('edge cases', () => {
  const bundle = languageBundle('en');
  const impl = calendarPatterns(bundle, bundle.schema.Buddhist, false, 3);
  const api = calendarsApi('en');
  const date = toGregorianDate(api, { date: MARCH_11_2018_070025_UTC, zoneId: 'America/New_York' });

  expect(patternsDatePattern(impl, 'missing-width')).toEqual([]);
  expect(patternsTimePattern(impl, 'missing-width')).toEqual([]);
  expect(patternsWrapperPattern(impl, 'missing-width', true)).toEqual('');
  expect(patternsWrapperPattern(impl, 'missing-width', false)).toEqual('');

  expect(patternsAvailablePattern(impl, date, { skeleton: 'xyz' } as DateSkeleton)).toEqual([]);
  expect(patternsAvailablePattern(impl, date, { pattern: 'foo' } as DateSkeleton)).toEqual(['foo']);

  expect(patternsIntervalPattern(impl, 'x', 'xyz')).toEqual([]);
  expect(patternsIntervalPattern(impl, 'x', 'yMd')).toEqual([]);
});
