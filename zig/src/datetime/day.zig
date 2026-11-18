//! Port of `packages/hereabouts/src/datetime/day.ts`.
//!
//! Days are stored as their year, month and day, so they read well in logs. Arithmetic goes
//! through the day number (days since 1970-01-01), which is exact: adding days is addition, the
//! days between two dates is subtraction.
//!
//! Durations are i64; sums of them are computed in i128, so no input overflows. (The
//! TypeScript works in doubles, exact up to 2^53.)

const std = @import("std");
const Allocator = std.mem.Allocator;
const types = @import("types.zig");
const Scanner = @import("scan.zig").Scanner;

const Day = types.Day;
const DayDuration = types.DayDuration;
const DayUnit = types.DayUnit;
const DayPeriod = types.DayPeriod;
const Error = types.Error;

/// Wide integers for intermediate results.
const N = i128;

// Same range as JavaScript Date: +/- 100,000,000 days around 1970-01-01.
const MAX_EPOCH_DAY = 100000000;

fn leap(year: N) bool {
    return (@rem(year, 4) == 0 and @rem(year, 100) != 0) or @rem(year, 400) == 0;
}

/// True if the year is a leap year in the proleptic Gregorian calendar.
pub fn isLeapYear(year: i64) bool {
    return leap(year);
}

const MONTH_DAYS = [_]u8{ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };

fn monthDays(year: N, month: N) u8 {
    return if (month == 2 and leap(year)) 29 else MONTH_DAYS[@intCast(month - 1)];
}

/// Number of days in the month of the year. `month` must be 1-12.
pub fn daysInMonth(year: i64, month: i64) u8 {
    std.debug.assert(month >= 1 and month <= 12);
    return monthDays(year, month);
}

// Days since 1970-01-01 for a valid year, month and day (Howard Hinnant's days_from_civil).
fn toEpochDay(year: N, m: N, d: N) N {
    const y = if (m <= 2) year - 1 else year;
    const era = @divFloor(y, 400);
    const yoe = y - era * 400;
    const doy = @divFloor(153 * (if (m > 2) m - 3 else m + 9) + 2, 5) + d - 1;
    const doe = yoe * 365 + @divFloor(yoe, 4) - @divFloor(yoe, 100) + doy;
    return era * 146097 + doe - 719468;
}

// Year, month and day for a day number in range (Howard Hinnant's civil_from_days).
fn fromEpochDay(n: i64) Day {
    const z = n + 719468;
    const era = @divFloor(z, 146097);
    const doe = z - era * 146097;
    const yoe = @divFloor(doe - @divFloor(doe, 1460) + @divFloor(doe, 36524) - @divFloor(doe, 146096), 365);
    const doy = doe - (365 * yoe + @divFloor(yoe, 4) - @divFloor(yoe, 100));
    const mp = @divFloor(5 * doy + 2, 153);
    const d = doy - @divFloor(153 * mp + 2, 5) + 1;
    const month = if (mp < 10) mp + 3 else mp - 9;
    const year = yoe + era * 400 + @as(i64, if (month <= 2) 1 else 0);
    return .{ .year = @intCast(year), .month = @intCast(month), .day = @intCast(d) };
}

fn inRange(n: N) bool {
    return n >= -MAX_EPOCH_DAY and n <= MAX_EPOCH_DAY;
}

fn valid(year: N, month: N, d: N) bool {
    return month >= 1 and month <= 12 and d >= 1 and d <= monthDays(year, month) and
        inRange(toEpochDay(year, month, d));
}

fn checked(n: N) Error!Day {
    if (!inRange(n)) return error.DayOutOfRange;
    return fromEpochDay(@intCast(n));
}

/// The day number of `d`, or `error.InvalidDay` unless it is a valid day. Every function that
/// takes a Day checks it, so a hand-built `.{ .month = 2, .day = 30 }` fails loudly instead of
/// rolling over.
pub fn epochOf(d: Day) Error!i64 {
    if (!valid(d.year, d.month, d.day)) return error.InvalidDay;
    return @intCast(toEpochDay(d.year, d.month, d.day));
}

/// Create a day from its year, month (1-12) and day of month (1-31). `error.InvalidDay` if the
/// day doesn't exist, such as 2026-02-30, or is outside the supported range.
pub fn day(year: i64, month: i64, dayOfMonth: i64) Error!Day {
    if (!valid(year, month, dayOfMonth)) return error.InvalidDay;
    return .{ .year = @intCast(year), .month = @intCast(month), .day = @intCast(dayOfMonth) };
}

/// True if `d` names a day that exists, within the supported range.
pub fn isDay(d: Day) bool {
    return valid(d.year, d.month, d.day);
}

/// The day number: days since 1970-01-01 (negative before it).
pub fn dayToEpochDay(d: Day) Error!i64 {
    return epochOf(d);
}

/// The day for a day number (days since 1970-01-01). `error.DayOutOfRange` beyond +/-1e8.
pub fn dayFromEpochDay(n: i64) Error!Day {
    return checked(n);
}

/// Parse an ISO 8601 calendar date, `YYYY-MM-DD` (or `±YYYYYY-MM-DD` for years outside
/// 0000-9999). Null if the text isn't in that form or names a day that doesn't exist. No time
/// zone is involved.
pub fn dayParse(s: []const u8) ?Day {
    var p: Scanner = .{ .s = s };
    const year = p.year() orelse return null;
    if (!p.eat('-')) return null;
    const month = p.digits(2) orelse return null;
    if (!p.eat('-')) return null;
    const d = p.digits(2) orelse return null;
    if (!p.done()) return null;
    return day(year, month, d) catch null;
}

/// Like `dayParse`, but `error.InvalidDay` if the text isn't a valid day.
pub fn dayFromString(s: []const u8) Error!Day {
    return dayParse(s) orelse error.InvalidDay;
}

/// Format as ISO 8601 `YYYY-MM-DD` (`±YYYYYY-MM-DD` for years outside 0000-9999) into `buf`,
/// which needs 13 bytes.
pub fn formatDay(buf: []u8, d: Day) Error![]u8 {
    _ = try epochOf(d);
    const y = d.year;
    const m: u32 = @intCast(d.month);
    const dd: u32 = @intCast(d.day);
    if (y >= 0 and y <= 9999) {
        return std.fmt.bufPrint(buf, "{d:0>4}-{d:0>2}-{d:0>2}", .{ @as(u32, @intCast(y)), m, dd }) catch unreachable;
    }
    const sign: u8 = if (y < 0) '-' else '+';
    return std.fmt.bufPrint(buf, "{c}{d:0>6}-{d:0>2}-{d:0>2}", .{ sign, @abs(y), m, dd }) catch unreachable;
}

/// Format as ISO 8601 `YYYY-MM-DD` (`±YYYYYY-MM-DD` for years outside 0000-9999). The caller
/// owns the result.
pub fn dayToString(gpa: Allocator, d: Day) (Error || Allocator.Error)![]u8 {
    var buf: [16]u8 = undefined;
    return gpa.dupe(u8, try formatDay(&buf, d));
}

/// Day number of a valid day plus a number of months (clamping the day of month to the end of a
/// shorter month) and then days. Not range checked: callers check the result they return, so an
/// intermediate value outside the supported range never fails by itself.
fn addEpoch(d: Day, months: N, days: N) N {
    var y: N = d.year;
    var m: N = d.month;
    var dd: N = d.day;
    if (months != 0) {
        const total = y * 12 + (m - 1) + months;
        y = @divFloor(total, 12);
        m = total - y * 12 + 1;
        dd = @min(dd, monthDays(y, m));
    }
    return toEpochDay(y, m, dd) + days;
}

fn addParts(d: Day, months: N, days: N) Error!Day {
    _ = try epochOf(d);
    return if (months != 0 or days != 0) checked(addEpoch(d, months, days)) else d;
}

fn monthsOf(x: DayDuration) N {
    return @as(N, x.years) * 12 + x.months;
}

fn daysOf(x: DayDuration) N {
    return @as(N, x.weeks) * 7 + x.days;
}

/// Add a calendar duration. Years and months are added first, clamping the day of month to the
/// end of a shorter month (2026-01-31 plus 1 month is 2026-02-28), then weeks and days. This
/// matches date-fns `add` and Temporal `PlainDate.add`.
pub fn dayAdd(d: Day, duration: DayDuration) Error!Day {
    return addParts(d, monthsOf(duration), daysOf(duration));
}

/// Subtract a calendar duration: `dayAdd` with every field negated.
pub fn daySubtract(d: Day, duration: DayDuration) Error!Day {
    return addParts(d, -monthsOf(duration), -daysOf(duration));
}

/// Compare two days: -1 if `a` is before `b`, 0 if they are the same day, 1 if after.
pub fn dayCompare(a: Day, b: Day) Error!i32 {
    const c = try epochOf(a) - try epochOf(b);
    return if (c < 0) -1 else if (c > 0) 1 else 0;
}

/// True if `a` and `b` are the same day.
pub fn dayEquals(a: Day, b: Day) Error!bool {
    return try dayCompare(a, b) == 0;
}

/// True if `a` is before `b`.
pub fn dayIsBefore(a: Day, b: Day) Error!bool {
    return try dayCompare(a, b) < 0;
}

/// True if `a` is after `b`.
pub fn dayIsAfter(a: Day, b: Day) Error!bool {
    return try dayCompare(a, b) > 0;
}

/// Whole units from `from` to `to`: positive if `to` is later, negative if earlier.
///
/// - `days`: the difference in day numbers, so `dayUntil(today, due, .days)` is the number of
///   days left before a due date.
/// - `weeks`: whole weeks (days / 7, rounded toward zero).
/// - `months` / `years`: the largest whole number of months (years) that can be added to `from`
///   with `dayAdd` without passing `to`. So 2026-01-31 to 2026-02-28 is 1 month, and 2026-01-15
///   to 2026-02-14 is 0 months. Because of month-end clamping this can differ from date-fns
///   `differenceInMonths` / `differenceInYears` at month ends: 2024-02-29 to 2025-02-28 is 1
///   year here (adding a year to Feb 29 gives Feb 28) and 0 in date-fns.
pub fn dayUntil(from: Day, to: Day, unit: DayUnit) Error!i64 {
    const a = try epochOf(from);
    const b = try epochOf(to);
    switch (unit) {
        .days => return b - a,
        .weeks => return @divTrunc(b - a, 7),
        .months, .years => {
            const sign: N = if (b > a) 1 else if (b < a) -1 else 0;
            if (sign == 0) return 0;
            // Start from the difference in calendar months, then step back while adding that
            // many months to `from` passes `to` (at most once, because of end-of-month clamping).
            var m: N = (@as(N, to.year) - from.year) * 12 + (@as(N, to.month) - from.month);
            if (unit == .years) m -= @rem(m, 12);
            const step: N = if (unit == .years) 12 else 1;
            while (m != 0 and (addEpoch(from, m, 0) - b) * sign > 0) m -= sign * step;
            return @intCast(if (unit == .years) @divExact(m, 12) else m);
        },
    }
}

/// Day of the week, 1 = Sunday through 7 = Saturday: the CLDR numbering used for the first day
/// of a locale's week.
pub fn dayOfWeek(d: Day) Error!u8 {
    // 1970-01-01 was a Thursday (5).
    return @intCast(@mod(try epochOf(d) + 4, 7) + 1);
}

/// Day of the year, 1-366.
pub fn dayOfYear(d: Day) Error!u16 {
    return @intCast(try epochOf(d) - toEpochDay(d.year, 1, 1) + 1);
}

/// Number of days in the day's month.
pub fn dayDaysInMonth(d: Day) Error!u8 {
    _ = try epochOf(d);
    return monthDays(d.year, d.month);
}

/// True if the day falls in a leap year.
pub fn dayIsLeapYear(d: Day) Error!bool {
    _ = try epochOf(d);
    return leap(d.year);
}

fn checkFirstDay(firstDay: i64) Error!void {
    if (firstDay < 1 or firstDay > 7) return error.InvalidFirstDay;
}

/// The first day of the week containing `d`. `firstDay` is the day the week starts on,
/// 1 = Sunday through 7 = Saturday.
pub fn dayStartOfWeek(d: Day, firstDay: i64) Error!Day {
    try checkFirstDay(firstDay);
    const back = @mod(@as(i64, try dayOfWeek(d)) - firstDay + 7, 7);
    return if (back != 0) checked(try epochOf(d) - back) else d;
}

/// The last day of the week containing `d`. See `dayStartOfWeek`.
pub fn dayEndOfWeek(d: Day, firstDay: i64) Error!Day {
    return checked(@as(N, try epochOf(try dayStartOfWeek(d, firstDay))) + 6);
}

/// The first day of the day's month or year.
pub fn dayStartOf(d: Day, unit: DayPeriod) Error!Day {
    _ = try epochOf(d);
    return if (unit == .year) day(d.year, 1, 1) else day(d.year, d.month, 1);
}

/// The last day of the day's month or year.
pub fn dayEndOf(d: Day, unit: DayPeriod) Error!Day {
    _ = try epochOf(d);
    return if (unit == .year) day(d.year, 12, 31) else day(d.year, d.month, monthDays(d.year, d.month));
}

/// Every day from `start` to `end`, both included, in steps of `step` (`.{ .days = 1 }` for
/// every day). Each step is added to `start`, not to the previous day, so monthly steps from the
/// 31st stay on the last day of shorter months without drifting. Empty if `end` is before
/// `start`. The caller owns the result.
///
/// For the weeks of a month view, start from `dayStartOfWeek`:
/// `dayRange(gpa, try dayStartOfWeek(first, firstDay), last, .{ .weeks = 1 })`.
pub fn dayRange(gpa: Allocator, start: Day, end: Day, step: DayDuration) (Error || Allocator.Error)![]Day {
    _ = try epochOf(start);
    const last = try epochOf(end);
    const months = monthsOf(step);
    const days = daysOf(step);
    if (months < 0 or days < 0 or (months == 0 and days == 0)) return error.InvalidStep;
    var r: std.ArrayList(Day) = .empty;
    errdefer r.deinit(gpa);
    var i: N = 0;
    while (true) : (i += 1) {
        // Between start and end, so always in range; the first one past the end is never built.
        const n = addEpoch(start, months * i, days * i);
        if (n > last) return r.toOwnedSlice(gpa);
        try r.append(gpa, fromEpochDay(@intCast(n)));
    }
}
