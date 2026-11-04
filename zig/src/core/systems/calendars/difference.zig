//! Temporal-compatible date difference, underpinning `dateUntil` and `dateSince`
//! (`difference.ts`).
//!
//! The Temporal specification and polyfill have a bug affecting dates spanning the fall DST
//! boundary, where clocks are set back so some wall clock times occur twice, e.g.
//! 2025-11-02 01:01:00-07:00 followed by 01:01:00-08:00 one hour later: both the polyfill and
//! Firefox throw a RangeError, and times around the boundary can be off by an hour.
//! https://github.com/js-temporal/temporal-polyfill/issues/347
//! https://github.com/tc39/proposal-temporal/issues/3141
//!
//! This avoids both by detecting dates on the same calendar day and skipping the
//! date-differencing logic for a pure time-of-day difference.

const add_ = @import("add.zig");
const C = @import("constants.zig");
const calendar = @import("calendar.zig");
const F = @import("fields.zig").DateField;
const gm = @import("gregorianmath.zig");
const interval = @import("interval.zig");
const math = @import("math.zig");
const timezone = @import("timezone.zig");
const types = @import("types.zig");
const util = @import("util.zig");

const CalendarDate = types.CalendarDate;
const DateDiffOptions = calendar.DateDiffOptions;
const TimePeriod = interval.TimePeriod;
const TimePeriodField = interval.TimePeriodField;
const Flag = interval.TimePeriodFieldFlag;
const YearMonthDay = math.YearMonthDay;

const DEFAULT_FLAGS = Flag.YEAR | Flag.MONTH |
    // No WEEK by default
    Flag.DAY | Flag.HOUR | Flag.MINUTE | Flag.SECOND | Flag.MILLIS;

/// State of a difference calculation; `two` is updated as it proceeds.
const DifferenceState = struct {
    date1: *const CalendarDate,
    date2: *const CalendarDate,
    options: DateDiffOptions,

    // Dates as year, month, day
    one: YearMonthDay,
    two: YearMonthDay,
    epoch2: f64,

    // Time of day in milliseconds
    ms1: f64,
    ms2: f64,

    zoneId: []const u8,

    // -1 if date1 < date2, 1 if date1 > date2, 0 if equal
    sign: f64,

    // The negation of the sign: the number of years / months added to date1 to approach date2.
    incr: f64,

    // Whether fractional fields are allowed. If the caller asks for the result in
    // ['year', 'month'] with fractions, any additional days are added to the months.
    fractions: bool,

    // Fields to set in the result.
    flags: u8,

    // Smallest flag requested.
    smallestFlag: u8,

    // Number of months in a year
    monthCount: f64,

    fn has(self: *const DifferenceState, flag: u8) bool {
        return (flag & self.flags) != 0;
    }

    fn smallest(self: *const DifferenceState, flag: u8) bool {
        return flag == self.smallestFlag;
    }
};

fn differenceState(date1: *const CalendarDate, date2: *const CalendarDate, options: DateDiffOptions) DifferenceState {
    const sign: f64 = @floatFromInt(calendar.dateCompare(date1, date2));
    const flags, const smallestFlag = interval.timePeriodFieldFlags(options.fields);
    return .{
        .date1 = date1,
        .date2 = date2,
        .options = options,
        .one = math.toYMD(date1),
        .two = math.toYMD(date2),
        .epoch2 = calendar.unixEpoch(date2),
        .ms1 = date1.fields[F.MILLIS_IN_DAY],
        .ms2 = date2.fields[F.MILLIS_IN_DAY],
        .zoneId = date1.zoneInfo.zoneid,
        .sign = sign,
        .incr = -sign,
        .fractions = options.rollupFractional,
        .flags = if (flags != 0) flags else DEFAULT_FLAGS,
        .smallestFlag = smallestFlag,
        .monthCount = @floatFromInt(date1.calendar.monthCount),
    };
}

fn wallToUTC(zoneId: []const u8, wall: f64) f64 {
    return timezone.utcFromWall(zoneId, wall) orelse wall;
}

/// The difference between two dates in years, months, days, etc.
///
/// Algorithm: https://tc39.es/proposal-temporal/#sec-temporal-differencezoneddatetime
pub fn difference(date1: *const CalendarDate, date2: *const CalendarDate, options: DateDiffOptions) TimePeriod {
    var result: TimePeriod = .{};

    var state = differenceState(date1, date2, options);

    // If equal, zero.
    if (state.sign == 0) return result;

    const sameDay = isSameDay(state.one, state.two);

    // Compute the time difference and adjust the end date for shifts due to daylight saving
    // time first, since the time difference can shift the days in the date difference.
    var millis: f64 = undefined;
    if (sameDay) {
        // Special case: Temporal fails with "mixed-sign values not allowed as duration fields"
        // for zone "America/Vancouver", date1 = 1762074000000 "2025-11-02 01:00:00-08:00",
        // date2 = 1762070460000 "2025-11-02 01:01:00-07:00", date1.until(date2).
        millis = state.epoch2 - calendar.unixEpoch(state.date1);
    } else {
        // Scan for the time difference, adjust the end date.
        state.two, millis = timeDifference(&state);

        // The difference between the date fields, into the result.
        differenceOfDates(&state, &result);
    }

    // ==> YEAR, MONTH, WEEK and DAY are set in the result.

    result.millis = millis;

    // If DAY is not requested, roll days into time
    if (!state.has(Flag.DAY)) {
        result.millis += result.day * C.ONE_DAY_MS;
        result.day = 0;
    }

    if (state.fractions) {
        if (state.smallestFlag <= Flag.DAY) {
            rollDateFractions(&state, &result);
        } else {
            rollTimeFractions(&state, &result);
        }
        return result;
    }

    // Rounding edge case
    if (state.has(Flag.DAY) and @abs(result.millis) >= 23 * C.ONE_HOUR_MS and
        @abs(result.millis) <= 25 * C.ONE_HOUR_MS)
    {
        roundResult(&state, &result);
    }

    // Set all time fields from the milliseconds field.
    rollTime(&state, &result);
    return result;
}

fn differenceOfDates(state: *const DifferenceState, result: *TimePeriod) void {
    const one = state.one;
    const two = state.two;
    const incr = state.incr;

    if (state.has(Flag.YEAR) or state.has(Flag.MONTH)) {
        // Use date 1 as the base and add or subtract years and months to approach date 2
        // without exceeding it.

        // Initial guess for the years difference.
        var guessYears = two.year - one.year;
        if (guessYears != 0) guessYears -= incr;

        // Adjust the year to approach the end date without exceeding it.
        while (!greaterThanYMD(incr, one.year + guessYears, one.month, one.day, two)) {
            result.year = guessYears;
            guessYears += incr;
        }

        // Initial guess for the months difference.
        var guessMonths = incr;
        var seek = math.adjustYM(one.year + result.year, one.month + guessMonths);

        // Adjust the month to approach the end date without exceeding it.
        while (!greaterThanYMD(incr, seek.year, seek.month, one.day, two)) {
            result.month = guessMonths;
            guessMonths += incr;
            seek = math.adjustYM(seek.year, seek.month + incr);
        }

        if (!state.has(Flag.YEAR)) {
            // MONTH but not YEAR: translate years to months.
            result.month += result.year * 12;
            result.year = 0;
        } else if (!state.has(Flag.MONTH)) {
            // YEAR but not MONTH. If YEAR is the smallest field and fractions are not rolled up,
            // or YEAR is not the smallest field, zero the months; they are rolled into the days.
            if ((!state.fractions and state.smallest(Flag.YEAR)) or !state.smallest(Flag.YEAR)) {
                result.month = 0;
            }
        }
    }

    // Final years and months, clamped to a valid range.
    const seek = math.adjustYM(one.year + result.year, one.month + result.month);
    const clamped = math.clampYMD(seek.year, seek.month, one.day);

    // Final number of days. If years and months weren't set above, the days span the range.
    var day = gm.ymdToJD(two.year, two.month, two.day, state.monthCount) -
        gm.ymdToJD(clamped.year, clamped.month, clamped.day, state.monthCount);

    // Optionally translate weeks to days
    var week: f64 = 0;
    if ((state.options.includeWeeks and (state.flags == 0 or state.flags == DEFAULT_FLAGS)) or
        state.has(Flag.WEEK))
    {
        week = @trunc(day / 7);
        day = @rem(day, 7);
    }

    result.day = day;
    result.week = week;
}

/// The time difference, and the end date adjusted for daylight saving time shifts.
fn timeDifference(state: *const DifferenceState) struct { YearMonthDay, f64 } {
    const two = state.two;
    const incr = state.incr;

    // Intermediate date approaching the end date without exceeding it.
    var intermediate: YearMonthDay = undefined;

    // Amount to shift the day
    var dayshift: f64 = 0;

    // Maximum day shift
    const maxshift: f64 = if (incr == 1) 2 else 1;

    // Check if the end time is lower than the start time.
    var delta = state.ms2 - state.ms1;
    if (util.sign(delta) == -incr) dayshift += 1;

    // Loop, moving the end date and computing a difference between start and end times.
    // Always loops at least once.
    while (dayshift <= maxshift) : (dayshift += 1) {
        intermediate = adjustDays(two.year, two.month, two.day - dayshift * incr);
        const jd = gm.ymdToJD(intermediate.year, intermediate.month, intermediate.day, state.monthCount);
        const epoch = wallToUTC(state.zoneId, math.unixEpochFromJD(jd, state.ms1));
        delta = state.epoch2 - epoch;
        if (util.sign(delta) != -state.incr) break;
    }
    return .{ intermediate, delta };
}

fn isSameDay(one: YearMonthDay, two: YearMonthDay) bool {
    return one.year == two.year and one.month == two.month and one.day == two.day;
}

/// Round the result: if the time part is longer than the last full day (23 to 25 hours
/// depending on daylight saving time shifts), add a day.
fn roundResult(state: *const DifferenceState, result: *TimePeriod) void {
    // Start of the day, e.g. "2025-03-09 01:59:00" becomes "2025-03-09 00:00:00".
    const startOfDay = calendar.dateStartOf(state.date1, .day);
    const date = math.toYMD(&startOfDay);

    // Add the date components, e.g. "2025-03-09 00:00:00" + "1 year, 1 month, 22 days" becomes
    // "2025-10-31 00:00:00".
    const start = add_.addYMD(date, .{ .year = result.year, .month = result.month, .week = result.week, .day = result.day });

    // Wall clock epoch of the start day at the start time of day.
    const jd = gm.ymdToJD(start.year, start.month, start.day, state.monthCount);
    const startEpoch = wallToUTC(state.date1.zoneInfo.zoneid, math.unixEpochFromJD(jd, state.ms1));

    // The same for the day +/- 1 after the start, in the direction of the comparison.
    const end = adjustDays(start.year, start.month, start.day + state.incr);
    const endJd = gm.ymdToJD(end.year, end.month, end.day, state.monthCount);
    const endEpoch = wallToUTC(state.date1.zoneInfo.zoneid, math.unixEpochFromJD(endJd, state.ms1));

    const delta = endEpoch - startEpoch;

    // If the milliseconds exceed the length of the last full day, roll them into 1 day.
    if (state.has(Flag.DAY) and @abs(result.millis) >= @abs(delta)) {
        const days = util.toInt32(result.millis / (state.incr * delta));
        const remainder = result.millis - delta;
        result.day += days;
        result.millis = remainder;
    }
}

/// Correct the day for underflow and overflow of the month. Only for small day adjustments
/// (1 or 2 days): e.g. adding 3 days to "2024-01-30" gives "2024-02-02".
pub fn adjustDays(yearArg: f64, monthArg: f64, dayArg: f64) YearMonthDay {
    var ym = math.adjustYM(yearArg, monthArg);
    var day = dayArg;
    if (day < 1) {
        ym = math.adjustYM(ym.year, ym.month - 1);
        day += gm.daysInMonth(ym.year, gm.monthIndex(ym.month - 1));
    }
    if (day > gm.daysInMonth(ym.year, gm.monthIndex(ym.month - 1))) {
        day -= gm.daysInMonth(ym.year, gm.monthIndex(ym.month - 1));
        ym = math.adjustYM(ym.year, ym.month + 1);
    }
    return .{ .year = ym.year, .month = ym.month, .day = day };
}

/// True if (y1, m1, d1) is beyond date2 in the direction of `sign`.
fn greaterThanYMD(sign: f64, y1: f64, m1: f64, d1: f64, date2: YearMonthDay) bool {
    if (y1 != date2.year) {
        if (sign * (y1 - date2.year) > 0) return true;
    } else if (m1 != date2.month) {
        if (sign * (m1 - date2.month) > 0) return true;
    } else if (d1 != date2.day) {
        if (sign * (d1 - date2.day) > 0) return true;
    }
    return false;
}

/// Roll the milliseconds into the time fields.
fn rollTime(state: *const DifferenceState, result: *TimePeriod) void {
    if (state.has(Flag.HOUR)) {
        result.hour = util.toInt32(result.millis / C.ONE_HOUR_MS);
        result.millis -= result.hour * C.ONE_HOUR_MS;
    }
    if (state.has(Flag.MINUTE)) {
        result.minute = util.toInt32(result.millis / C.ONE_MINUTE_MS);
        result.millis -= result.minute * C.ONE_MINUTE_MS;
    }
    if (state.has(Flag.SECOND)) {
        result.second = util.toInt32(result.millis / C.ONE_SECOND_MS);
        result.millis -= result.second * C.ONE_SECOND_MS;
    }
    if (!state.has(Flag.MILLIS)) result.millis = 0;
}

/// A date field is the smallest requested: roll the smaller fields into a fraction of it.
fn rollDateFractions(state: *const DifferenceState, result: *TimePeriod) void {
    // Roll milliseconds into days.
    const days = result.day + result.millis / C.ONE_DAY_MS;
    result.millis = 0;

    if (state.smallest(Flag.YEAR)) {
        result.year += result.month / state.monthCount + (result.week * 7 + days) / 365.25;
        result.month = 0;
        result.week = 0;
        result.day = 0;
    } else if (state.smallest(Flag.MONTH)) {
        result.month += (result.week * 7 + days) / 30.44;
        result.week = 0;
        result.day = 0;
    } else if (state.smallest(Flag.WEEK)) {
        result.week += days / 7;
        result.day = 0;
    } else if (state.smallest(Flag.DAY)) {
        result.day = days;
    }
}

/// A time field is the smallest requested: roll the smaller fields into a fraction of it.
fn rollTimeFractions(state: *const DifferenceState, result: *TimePeriod) void {
    if (state.smallest(Flag.HOUR)) {
        result.hour += (result.minute * C.ONE_MINUTE_MS + result.second * C.ONE_SECOND_MS + result.millis) /
            C.ONE_HOUR_MS;
        result.minute = 0;
        result.second = 0;
    }
    if (state.smallest(Flag.MINUTE)) {
        result.minute = (result.second * C.ONE_MINUTE_MS + result.millis) / C.ONE_MINUTE_MS;
        result.second = 0;
    }
    if (state.smallest(Flag.SECOND)) {
        result.second = result.millis / C.ONE_SECOND_MS;
    }
    // Finally if MILLIS was not requested, zero it.
    if (!state.smallest(Flag.MILLIS)) result.millis = 0;
}

/// The largest non-zero field of a period, or millis.
fn relativeField(p: TimePeriod) TimePeriodField {
    for (interval.TIME_PERIOD_FIELDS) |f| {
        if (util.truthy(p.get(f))) return f;
    }
    return .millis;
}

/// A relative time: the field and the amount.
pub const RelativeTime = struct {
    field: TimePeriodField,
    value: f64,
};

/// The relative time between two dates, in terms of the given field, or if null the largest
/// field of their difference.
pub fn dateRelativeTime(d: *const CalendarDate, other: *const CalendarDate, fieldArg: ?TimePeriodField, options: DateDiffOptions) RelativeTime {
    var field: TimePeriodField = undefined;
    if (fieldArg) |f| {
        field = f;
    } else {
        // Calculate the difference in all fields and select the largest.
        var o = options;
        o.rollupFractional = false;
        o.fields = null;
        field = relativeField(difference(d, other, o));
    }

    // The difference in terms of the field.
    const fields = [_]TimePeriodField{field};
    var o = options;
    o.fields = &fields;
    const result = difference(d, other, o);
    return .{ .field = field, .value = util.orZero(result.get(field)) };
}

/// The period of time since the other date: the negation of `dateUntil(d, other)`. For example
/// `dateSince("2024-03-03", "2024-01-30")` is "1 month 4 days" and
/// `dateSince("2024-01-30", "2024-03-03")` is "-1 month -3 days"; durations are not
/// symmetrical due to calendar math, e.g. end-of-month alignment with months of different
/// lengths.
pub fn dateSince(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
    return math.negatePeriod(difference(d, other, options));
}

/// The period of time until the other date (negative if it is earlier). For example
/// `dateUntil("2024-01-30", "2024-03-30")` is "1 month 3 days" and
/// `dateUntil("2024-03-03", "2024-01-30")` is "-1 month -4 days".
pub fn dateUntil(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
    return difference(d, other, options);
}

/// The time period between two dates, as an absolute value.
pub fn dateDifference(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
    const result = difference(d, other, options);
    return if (calendar.dateCompare(d, other) == 1) math.negatePeriod(result) else result;
}

/// The time period between two dates; negative if the other date is earlier.
pub fn dateDifferenceSigned(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
    return dateUntil(d, other, options);
}
