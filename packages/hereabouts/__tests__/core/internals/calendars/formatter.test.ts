import {
  decimalNumberingSystem,
  type GregorianDate,
  gregorianDateFromUnixEpoch,
} from '../../../../src/core';
import type { ContextTransformInfo, NumberSymbols } from '../../../../src/core/common/private';
import type {
  CalendarContext,
  CalendarFormatter,
} from '../../../../src/core/internals/calendars/formatter';
import { calendarFormat } from '../../../../src/core/internals/calendars/formatterimpl';
import { stringValue } from '../../../../src/core/utils/render';
import { languageBundle } from '../../_helpers';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SYMBOLS: NumberSymbols = {
  decimal: '.',
  group: ',',
} as NumberSymbols;

test('calendar formatter', () => {
  const en = languageBundle('en');
  const value = stringValue();
  const impl: CalendarFormatter = { cal: en.schema.Gregorian, tz: en.schema.TimeZones };
  const system = decimalNumberingSystem('latn', DIGITS, SYMBOLS, 1, 3, 3);

  let date: GregorianDate;

  date = gregorianDateFromUnixEpoch(0, 'America/New_York', 1, 1);
  const ctx: CalendarContext<GregorianDate> = {
    alt: {},
    bundle: en,
    date,
    system,
    latnSystem: system,
    transform: {} as ContextTransformInfo,
  };

  calendarFormat(impl, value, ctx, [['M', 3]]);
  expect(value.render()).toEqual('Dec');

  // Unknown field
  calendarFormat(impl, value, ctx, [['M', 3], ['R', 4], ' ', ['d', 2]]);
  expect(value.render()).toEqual('Dec 31');

  // Era widths
  calendarFormat(impl, value, ctx, [['G', 4]]);
  expect(value.render()).toEqual('Anno Domini');

  calendarFormat(impl, value, ctx, [['G', 5]]);
  expect(value.render()).toEqual('A');

  // Month standalone
  calendarFormat(impl, value, ctx, [['L', 3]]);
  expect(value.render()).toEqual('Dec');

  // Weekday local
  calendarFormat(impl, value, ctx, [['e', 3]]);
  expect(value.render()).toEqual('Wed');

  calendarFormat(impl, value, ctx, [['e', 4]]);
  expect(value.render()).toEqual('Wednesday');

  // Weekday standalone
  calendarFormat(impl, value, ctx, [['E', 3]]);
  expect(value.render()).toEqual('Wed');

  calendarFormat(impl, value, ctx, [['E', 4]]);
  expect(value.render()).toEqual('Wednesday');

  // Timezone Z
  calendarFormat(impl, value, ctx, [['Z', 5]]);
  expect(value.render()).toEqual('-05:00');

  calendarFormat(impl, value, ctx, [['Z', 6]]);
  expect(value.render()).toEqual('');

  // Day period extended
  calendarFormat(impl, value, ctx, [['b', 3]]);
  expect(value.render()).toEqual('PM');

  ctx.date = gregorianDateFromUnixEpoch(0, 'Asia/Tokyo', 1, 1);
  calendarFormat(impl, value, ctx, [['Z', 5]]);
  expect(value.render()).toEqual('+09:00');

  // Day period extended
  calendarFormat(impl, value, ctx, [['b', 3]]);
  expect(value.render()).toEqual('AM');

  ctx.date = gregorianDateFromUnixEpoch(120000, 'Asia/Tokyo', 1, 1);
  // Day period extended
  calendarFormat(impl, value, ctx, [['b', 3]]);
  expect(value.render()).toEqual('AM');
});
