//! Adding time periods to dates (`add.ts`).

const C = @import("constants.zig");
const calendar = @import("calendar.zig");
const core = @import("core.zig");
const F = @import("fields.zig").DateField;
const interval = @import("interval.zig");
const math = @import("math.zig");
const timezone = @import("timezone.zig");
const types = @import("types.zig");
const util = @import("util.zig");

const CalendarDate = types.CalendarDate;
const Error = types.Error;
const TimePeriod = interval.TimePeriod;
const YearMonthDay = math.YearMonthDay;

/// Add the period to the date, returning a new date. Fractional fields are truncated.
/// `error.InvalidDate` if the result is not a finite instant (an infinite period, or one so large
/// it overflows).
pub fn dateAdd(d: *const CalendarDate, fields: TimePeriod) Error!CalendarDate {
    const jd, const ms = add(d, fields);
    return core.newDateFromJD(d.database, d.calendar, jd, ms, d.zoneInfo.zoneid, d.firstDay, d.minDays);
}

/// Subtract the period from the date, returning a new date.
pub fn dateSubtract(d: *const CalendarDate, fields: TimePeriod) Error!CalendarDate {
    return dateAdd(d, math.negatePeriod(fields));
}

/// Add years, days, hours, etc. to a date, returning the Julian day and milliseconds in the day
/// of the result in UTC.
///
/// Compatible with the Temporal API (except for rounding; this only truncates):
/// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/add
pub fn add(orig: *const CalendarDate, added: TimePeriod) struct { f64, f64 } {
    // Check if only date or time fields are present.
    const hasTime = util.truthy(added.hour) or util.truthy(added.minute) or
        util.truthy(added.second) or util.truthy(added.millis);
    const hasDate = util.truthy(added.year) or util.truthy(added.month) or
        util.truthy(added.week) or util.truthy(added.day);

    // Procedure:
    // 1. Add YEARS and MONTHS to the base date.
    // 2. Clamp the original day so the new date is valid, e.g. "Jan 31, 2024" + 1 month gives
    //    "Feb 29, 2024" instead of "Feb 31, 2024" or "Mar 2, 2024".
    // 3. Add the WEEKS and DAYS to the new date.
    // 4. Combine the new date with the original time of day.
    // 5. Calculate the UNIX epoch of the new date, disambiguating the wall time to select the
    //    correct time zone offset.
    // 6. Finally add the time to the new epoch.

    // Julian day and milliseconds in UTC
    var jd = orig.fields[F.JULIAN_DAY];
    const millis = orig.fields[F.MILLIS_IN_DAY];
    const offset: f64 = @floatFromInt(orig.zoneInfo.offset);

    // If nothing is being added, the original date.
    if (!hasDate and !hasTime) return .{ jd, millis - offset };

    // Add integers only
    const truncated = math.truncateFields(added);

    // If only time is being added, skip the year/month logic and add directly to the timestamp.
    if (!hasDate) {
        const timeDays, const ms = math.adjustTime(millis - offset, truncated);
        jd += timeDays;
        return .{ jd, ms };
    }

    // Work in UTC then translate back later
    const date = calendar.dateSet(orig, .{ .zoneId = "UTC" });

    // Add years and months directly to the date fields.
    var ymd = math.toYMD(&date);

    // Break milliseconds down into days, hours, minutes, etc.
    const time = millisToTimePeriod(millis);

    ymd = addYMD(ymd, truncated);

    // Julian day of the year and month, plus the days.
    jd = date.calendar.monthStart(ymd.year, ymd.month - 1, false) + ymd.day + time.day;

    // Unix epoch of the Julian day and milliseconds, to find the time zone offset.
    var epoch = math.unixEpochFromJD(jd, millis);

    // The wall clock offset in the date's zone, which always resolves (dates are only made
    // with resolved zones); if the time zone data was replaced since, keep the epoch.
    epoch = timezone.utcFromWall(orig.database, orig.zoneInfo.zoneid, epoch) orelse epoch;

    // Add the time components.
    epoch += math.timeToMillis(truncated);

    // Back to Julian day and milliseconds in the day.
    return math.jdFromUnixEpoch(epoch);
}

/// Add the date parts of a period to a year, month and day.
pub fn addYMD(date: YearMonthDay, added: TimePeriod) YearMonthDay {
    var year = date.year + added.year;
    var month = date.month + added.month;

    // Add excess months to years
    const ym = math.adjustYM(year, month);
    year = ym.year;
    month = ym.month;

    // Ensure the day falls into a valid range for the new year and month.
    var r = math.clampYMD(year, month, date.day);

    // Add days from all sources
    r.day += added.week * 7 + added.day;
    return r;
}

/// Break milliseconds into hours, minutes, seconds and milliseconds (days are left 0).
pub fn millisToTimePeriod(millis: f64) TimePeriod {
    var r: TimePeriod = .{};
    r.millis = millis;
    r.hour = util.toInt32(r.millis / C.ONE_HOUR_MS);
    r.millis -= r.hour * C.ONE_HOUR_MS;
    r.minute = util.toInt32(r.millis / C.ONE_MINUTE_MS);
    r.millis -= r.minute * C.ONE_MINUTE_MS;
    r.second = util.toInt32(r.millis / C.ONE_SECOND_MS);
    r.millis -= r.second * C.ONE_SECOND_MS;
    return r;
}
