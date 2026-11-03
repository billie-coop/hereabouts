# Moving from date-fns to `@phensley/datetime`

date-fns works on JavaScript `Date`, which is always an instant read in the device's time zone.
A due date stored as `2026-01-31` becomes "midnight on the 31st *here*", which is a different
moment on another device and the wrong day on a server running in UTC. `@phensley/datetime`
keeps the kinds of value apart, so that can't happen:

| Value | Type | Stored as | For |
|---|---|---|---|
| Day | `Day` `{ year, month, day }` | `2026-01-31` (`date` column) | due dates, issue dates |
| Time of day | `TimeOfDay` `{ hour, minute, second, millis }` | `09:00` (`time` column) | "remind me at 9:00" |
| Instant | `number` (epoch ms) | `timestamptz` / epoch ms | payments, `created_at` |
| Zone | IANA id string | `'America/Vancouver'` | whose "today" / "9:00" |

Only a few functions take a zone: `dayToday`, `dayFromInstant`, `timeOfDayFromInstant`,
`dayAtTime`, `dayStartInstant`, `instantParse`/`instantToString` (optional), and the
`formatInstant*` formatters. Everything else is exact integer math and never shifts.

`@phensley/datetime` depends only on `@phensley/timezone`. Measured with rollup + terser
(min+gzip): day math alone is 1.3 KB; using the zone functions adds the tz database, 32 KB in
all; `formatDay` with a loaded locale is 89 KB (most of it the shared date formatter). Locale-aware
formatting (`formatDay`, `formatTimeOfDay`, `formatDayInterval`, `formatDayRelative`,
`formatInstant`, `formatInstantRelative`) lives in `@phensley/cldr-core` / `@phensley/cldr`.

## Function by function

Day math (date-fns on `Date` → `@phensley/datetime` on `Day`):

| date-fns | `@phensley/datetime` | Notes |
|---|---|---|
| `parseISO('2026-01-31')` | `dayParse('2026-01-31')` / `dayFromString` | undefined / throws for `2026-02-30` instead of rolling over |
| `format(d, 'yyyy-MM-dd')` | `dayToString(d)` | |
| `format(d, 'yyyy-MM')` | `dayToString(d).slice(0, 7)` | |
| `addDays(d, n)`, `subDays` | `dayAdd(d, { days: n })`, `daySubtract` | |
| `addWeeks`, `addMonths`, `addYears`, `add`, `sub*` | `dayAdd(d, { weeks, months, years })` | same month-end clamping |
| `differenceInDays(a, b)`, `differenceInCalendarDays(a, b)` | `dayUntil(b, a)` | note the argument order: from, to |
| `differenceInWeeks(a, b)` | `dayUntil(b, a, 'weeks')` | |
| `differenceInMonths(a, b)`, `differenceInYears(a, b)` | `dayUntil(b, a, 'months' \| 'years')` | can differ at month ends, see below (matters for ages and anniversaries from Feb 29) |
| `isBefore`, `isAfter`, `isSameDay`, `compareAsc` | `dayIsBefore`, `dayIsAfter`, `dayEquals`, `dayCompare` | `days.sort(dayCompare)` |
| `isSameMonth(a, b)` | `a.year === b.year && a.month === b.month` | |
| `startOfMonth`, `endOfMonth`, `startOfYear`, `endOfYear` | `dayStartOf(d, 'month' \| 'year')`, `dayEndOf` | |
| `startOfWeek(d, { weekStartsOn: 1 })`, `endOfWeek` | `dayStartOfWeek(d, 2)`, `dayEndOfWeek` | first day is 1 = Sunday … 7 = Saturday; use `firstDayOfWeek(locale)` |
| `getDay(d)` | `dayOfWeek(d) - 1` | `dayOfWeek` is 1 = Sunday … 7 = Saturday |
| `getDayOfYear`, `getDaysInMonth`, `isLeapYear` | `dayOfYear`, `dayDaysInMonth`, `dayIsLeapYear` | |
| `getMonth(d)` | `d.month - 1` | plain fields: `d.year`, `d.month` (1-12), `d.day` |
| `eachDayOfInterval({ start, end })` | `dayRange(start, end)` | |
| `eachWeekOfInterval({ start, end }, { weekStartsOn })` | `dayRange(dayStartOfWeek(start, first), end, { weeks: 1 })` | |
| `eachMonthOfInterval` | `dayRange(dayStartOf(start, 'month'), end, { months: 1 })` | |
| `isValid` | `isDay(x)` / `dayParse(s) !== undefined` | |

Zones, "today" and scheduled times:

| date-fns / Date | `@phensley/datetime` |
|---|---|
| `startOfDay(new Date())` | `dayToday(zone)` |
| `isToday(d)`, `isTomorrow(d)` | `dayUntil(dayToday(zone), d) === 0` / `=== 1` |
| `new Date().getHours()` | `timeOfDayFromInstant(Date.now(), zone).hour` |
| `d.setHours(9, 0, 0, 0); d.getTime()` | `dayAtTime(d, timeOfDay(9), zone)` |
| `parseISO('2026-01-31T09:00:00Z')` | `instantParse(s)` (or `instantParse(s, zone)` when there is no offset) |
| `new Date(ms).toISOString()` | `instantToString(ms)` / `instantToString(ms, zone)` |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | `systemTimeZone()` |

Formatting (in `@phensley/cldr`, locale-aware instead of English-only patterns):

| date-fns | `@phensley/cldr` |
|---|---|
| `format(d, 'MMM d, yyyy')` | `formatDay(locale, d)` → "Jan 31, 2026" / "31.01.2026" |
| `format(d, 'MMMM yyyy')` | `formatDay(locale, d, { skeleton: 'yMMMM' })` |
| `format(d, 'd')` | `String(d.day)` (or `formatDay(locale, d, { skeleton: 'd' })` for native digits) |
| `format(t, 'h:mm a')` | `formatTimeOfDay(locale, t)` → "6:30 AM" / "06:30" |
| `format(ms, 'MMM d, h:mm a')` | `formatInstant(locale, ms, zone, { skeleton: 'MMMdjm' })` |
| `formatDistanceToNow(ms, { addSuffix: true })` | `formatInstantRelative(locale, ms, Date.now(), zone)` → "2 hours ago" |
| "due in 3 days" | `formatDayRelative(locale, due, dayToday(zone))` → "in 3 days", "tomorrow", "übermorgen" |
| `format(a, …) + ' – ' + format(b, …)` | `formatDayInterval(locale, a, b)` → "Jan 1 – 31, 2026" |

## Checked against date-fns

The day functions were compared with date-fns 4.1.0 on 1.2 million cases (every day 1999-2031
plus 20,000 random days 1750-2190, random offsets; every `weekStartsOn`): identical except
`differenceInMonths` in 4 end-of-month cases, where date-fns says 28 Feb → 28 Mar is 0 months.
`dayUntil(…, 'months' | 'years')` counts the months (years) you can add without passing the end
date, so it agrees with `dayAdd`: 28 Mar minus 1 month is 28 Feb, which is 1 month; and
2024-02-29 to 2025-02-28 is 1 year (date-fns `differenceInYears`: 0). The random sample didn't
include a Feb 29 anniversary, so `differenceInYears` showed no difference there.

## Replacing a `date-utils` module

[`date-utils.ts`](./date-utils.ts) replaces an app's date helper module that kept a date-fns
based `DateUtils` object (string dates in `YYYY-MM-DD`, "today" in the device's zone). The
`DateUtils` object keeps the same functions and results, so code that calls `DateUtils.*`
doesn't change, and there is no date-fns dependency. It is not a whole-module drop-in: if the
old module also re-exported date-fns functions (`format`, `addDays`, `startOfWeek`, ...), the
code importing those moves to `@phensley/datetime` (tables above) in the same change.

When the platform doesn't report a time zone the data knows (Node with a POSIX `TZ=UTC+8`),
it falls back to the host's local clock as the date-fns version did, not to UTC. Fractional
amounts (`addDays` by 1.5) behave as in date-fns.

Compared with the date-fns version under 11 `TZ` settings (UTC, Los Angeles, New York,
St John's, London, Kolkata, Tokyo, Auckland, Kiritimati, POSIX `UTC+8`, `EST5EDT`) with a mocked
clock over 2018-2030, and 99 fractional / NaN / infinite amounts: identical for every
`YYYY-MM-DD` input. It differs only where the old one was wrong or lenient:

- invalid days (`2025-02-30`) are invalid instead of rolling over to March; partial ISO forms
  (`2025-12`, `20251208`) and `T24:00` are not accepted;
- for a timestamp input (not a date), `getDaysUntil` counts calendar days, where date-fns
  counted whole 24-hour periods (yesterday afternoon was "0 days ago");
- `isThisWeek` includes all of Saturday, where date-fns stopped at Saturday 00:00.
