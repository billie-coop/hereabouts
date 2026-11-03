import {
  dateHourOfDay,
  dateTimeZoneOffset,
  dateUnixEpoch,
  dateWithZone,
  gregorianDateFromUnixEpoch,
} from '../../../../src/core';

// Dates are immutable: their zone info is readonly at every level in the types. The checks are
// the @ts-expect-error lines (the lint step type-checks the tests); they are never executed.
test('date zone info is readonly', () => {
  const d = gregorianDateFromUnixEpoch(0, 'UTC');
  const mutate = () => {
    // @ts-expect-error -- readonly
    d.zoneInfo.offset = 3600000;
    // @ts-expect-error -- readonly
    d.zoneInfo.zoneid = 'Europe/Paris';
    // @ts-expect-error -- readonly
    // biome-ignore lint/correctness/noSelfAssign: checks the field is readonly
    d.zoneInfo = d.zoneInfo;
    // @ts-expect-error -- readonly
    d.fields[0] = 1;
  };
  expect(typeof mutate).toBe('function');
  expect(dateUnixEpoch(d)).toEqual(0);

  // The supported way to change the zone.
  const p = dateWithZone(d, 'Europe/Paris');
  expect(dateUnixEpoch(p)).toEqual(0);
  expect(dateTimeZoneOffset(p)).toEqual(3600000);
  expect(dateHourOfDay(p)).toEqual(1);
  expect(dateHourOfDay(d)).toEqual(0);
});
