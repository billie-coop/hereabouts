import { type CalendarType, createFramework, type SchemaConfig } from '../../../src/core';
import {
  getCalendarFormatter,
  selectCalendar,
} from '../../../src/core/internals/calendars/internal';
import { languageBundle } from '../_helpers';

test('skip checksum', () => {
  const framework = createFramework({ config: {} as SchemaConfig, skipChecksum: true });
  expect(framework.checksum).toEqual('');
});

test('calendar lookup', () => {
  const formatter = getCalendarFormatter(languageBundle('en'), 'x' as CalendarType);
  console.log(formatter);
});

test('select calendar', () => {
  const bundle = languageBundle('und-TH');
  console.log(bundle.languageRegion);
  const cal = selectCalendar(bundle);
  expect(cal).toEqual('buddhist');
});
