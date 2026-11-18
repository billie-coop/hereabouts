import { calendarIds, calendarPrefData } from '../../src/core/internals/calendars/autogen.calprefs';
import {
  dayPeriodKeys,
  dayPeriodRules,
} from '../../src/core/internals/calendars/autogen.dayperiods';
import { timeData, timeStrings } from '../../src/core/internals/calendars/autogen.timedata';
import { weekFirstDay, weekMinDays } from '../../src/core/internals/calendars/autogen.weekdata';
import { FIELD_TYPES } from '../../src/core/internals/calendars/fields';
import { header, type ZigFile, zigString } from './_emit';

const array = (xs: string[]): string =>
  xs.length === 0 ? '&.{}' : xs.length === 1 ? `&.{${xs[0]}}` : `&.{ ${xs.join(', ')} }`;

export const files = (): ZigFile[] => {
  let s = header('core-dates', 'src/core/internals/calendars/') + 'const std = @import("std");\n\n';
  const map = (name: string, type: string, rows: [string, string][]) => {
    s += `pub const ${name} = std.StaticStringMap(${type}).initComptime(.{\n`;
    for (const [k, v] of rows) s += `    .{ ${zigString(k)}, ${v} },\n`;
    s += '});\n\n';
  };
  for (const [name, obj] of [
    ['week_first', weekFirstDay],
    ['week_min', weekMinDays],
  ] as const)
    map(
      name,
      'i64',
      Object.entries(obj).map(([k, v]) => [k, String(v)]),
    );
  map(
    'calendar_prefs',
    '[]const u8',
    Object.entries(calendarPrefData).map(([k, v]) => [k, array(v.map(String))]),
  );
  s +=
    'pub const calendar_ids = [_][]const u8{ ' + calendarIds.map(zigString).join(', ') + ' };\n\n';
  map(
    'time_data',
    '[]const u8',
    Object.entries(timeData).flatMap(([lang, regions]) =>
      Object.entries(regions).map(([r, n]): [string, string] => [
        lang + ':' + r,
        zigString(timeStrings[n]),
      ]),
    ),
  );
  s += 'pub const DayRule = struct { minutes: []const i64, keys: []const []const u8 };\n';
  map(
    'day_rules',
    'DayRule',
    Object.entries(dayPeriodRules).map(([k, v]) => {
      const [keys, minutes] = v.split('|');
      return [
        k,
        'DayRule{ .minutes = ' +
          array(minutes.split(' ').map((n) => String(parseInt(n, 36)))) +
          ', .keys = ' +
          array(keys.split(' ').map((n) => zigString(dayPeriodKeys[Number(n)]))) +
          ' }',
      ];
    }),
  );
  s +=
    'pub const FieldType = struct { char: u8, field: usize, sub: i32, repeat: usize, width: usize };\n';
  s += 'pub const field_types = [_]FieldType{\n';
  for (const [ch, f, sub, repeat, width] of FIELD_TYPES)
    s += `    .{ .char = '${ch}', .field = ${f}, .sub = ${sub}, .repeat = ${repeat}, .width = ${width} },\n`;
  s += '};\n';
  // Match JS exponentiation rounding in the raw fractional-second formatter.
  s += 'pub const powers_of_ten = [_]f64{\n';
  for (let i = 0; i <= 308; i++) s += `    ${10 ** i},\n`;
  s += '};\n';
  return [{ path: 'core/internals/calendars/autogen.dates.zig', content: s }];
};
