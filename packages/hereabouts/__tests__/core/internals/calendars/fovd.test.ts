import { dateAdd, dateSubtract, newGregorianDate } from '../../../../src/core';
import { getCalendarPatterns, maskedFOVD } from '../../../../src/core/internals/calendars/manager';
import { patternsParseSkeleton } from '../../../../src/core/internals/calendars/patterns';
import type { DateSkeleton } from '../../../../src/core/internals/calendars/skeleton';
import type { DateTimePatternFieldType } from '../../../../src/types';
import { languageBundle } from '../../_helpers';

test('masked fovd', () => {
  const bundle = languageBundle('en');
  const manager = bundle;
  const patterns = getCalendarPatterns(manager, 'gregory');
  const api = bundle;
  let skeleton: DateSkeleton;
  let fovd: DateTimePatternFieldType;

  const date = newGregorianDate(api, {
    year: 2024,
    month: 3,
    day: 10,
    hour: 10,
    minute: 20,
    second: 30,
  });
  skeleton = patternsParseSkeleton(patterns, 'yMMMd');

  fovd = maskedFOVD(manager, date, dateAdd(date, { hour: 3 }), skeleton);
  expect(fovd).toEqual('d'); // smallest field in skeleton

  fovd = maskedFOVD(manager, date, dateAdd(date, { day: 13 }), skeleton);
  expect(fovd).toEqual('d');

  fovd = maskedFOVD(manager, date, dateAdd(date, { day: 30 }), skeleton);
  expect(fovd).toEqual('M');

  fovd = maskedFOVD(manager, date, dateAdd(date, { day: 365 }), skeleton);
  expect(fovd).toEqual('y');

  // mask doesn't contain era, so choose year
  fovd = maskedFOVD(manager, date, dateSubtract(date, { year: 2030 }), skeleton);
  expect(fovd).toEqual('y');

  skeleton = patternsParseSkeleton(patterns, 'GyM');
  fovd = maskedFOVD(manager, date, dateSubtract(date, { year: 2030 }), skeleton);
  expect(fovd).toEqual('G');

  skeleton = patternsParseSkeleton(patterns, 'Km');

  // 12-hour cycle
  fovd = maskedFOVD(manager, date, dateAdd(date, { hour: 1 }), skeleton);
  expect(fovd).toEqual('h');

  fovd = maskedFOVD(manager, date, dateAdd(date, { second: 30 }), skeleton);
  expect(fovd).toEqual('m');

  skeleton = patternsParseSkeleton(patterns, 'km');

  // 24-hour cycle
  fovd = maskedFOVD(manager, date, dateAdd(date, { hour: 1 }), skeleton);
  expect(fovd).toEqual('H');

  skeleton = patternsParseSkeleton(patterns, 'Bj');

  // preferred hour cycle
  fovd = maskedFOVD(manager, date, dateAdd(date, { hour: 1 }), skeleton);
  expect(fovd).toEqual('h');

  fovd = maskedFOVD(manager, date, dateAdd(date, { hour: 7 }), skeleton);
  expect(fovd).toEqual('B');
});
