import * as core from '../src';

// Implementation helpers that were protected in 1.x stay internal to their modules.
test('implementation helpers are not exported', () => {
  for (const name of ['gregorianDaysInYear', 'gregorianResolveFields', 'negatePeriod']) {
    expect(name in core).toBe(false);
  }
});

test('public calendar functions are exported', () => {
  const names = [
    'gregorianCalendar',
    'gregorianDateFromFields',
    'gregorianDateFromUnixEpoch',
    'isGregorianDate',
    'dateAdd',
    'dateSubtract',
    'dateDifference',
  ];
  for (const name of names) {
    expect(typeof (core as any)[name]).not.toBe('undefined');
  }
});
