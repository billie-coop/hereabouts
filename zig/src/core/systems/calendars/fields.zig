//! Layout of a date's computed fields (`fields.ts`).

/// Days of the week, 1 = Sunday .. 7 = Saturday.
pub const DayOfWeek = struct {
    pub const SUNDAY = 1;
    pub const MONDAY = 2;
    pub const TUESDAY = 3;
    pub const WEDNESDAY = 4;
    pub const THURSDAY = 5;
    pub const FRIDAY = 6;
    pub const SATURDAY = 7;
};

/// Positions in `Fields`.
pub const DateField = struct {
    /// Milliseconds from Unix epoch, adjusted by local timezone offset.
    pub const LOCAL_MILLIS = 0;
    /// Date in Julian days.
    pub const JULIAN_DAY = 1;
    pub const ERA = 2;
    pub const EXTENDED_YEAR = 3;
    pub const YEAR = 4;
    pub const YEAR_WOY = 5;
    pub const WEEK_OF_YEAR = 6;
    pub const MONTH = 7;
    pub const WEEK_OF_MONTH = 8;
    pub const DAY_OF_YEAR = 9;
    pub const DAY_OF_MONTH = 10;
    pub const DAY_OF_WEEK = 11;
    pub const DAY_OF_WEEK_IN_MONTH = 12;
    pub const MILLIS_IN_DAY = 13;
    pub const AM_PM = 14;
    pub const HOUR_OF_DAY = 15;
    pub const HOUR = 16;
    pub const MINUTE = 17;
    pub const SECOND = 18;
    pub const MILLIS = 19;
    pub const TZ_OFFSET = 20;
    pub const IS_LEAP = 21;
    pub const IS_DST = 22;
    pub const ISO_YEAR_WOY = 23;
    pub const ISO_WEEK_OF_YEAR = 24;
};

/// Number of computed fields.
pub const FIELD_COUNT = 25;

/// A date's computed fields, indexed by `DateField`. Numbers as in the TypeScript (doubles), so
/// the date math rounds and truncates exactly as it does there; every field of a date holds an
/// integer.
pub const Fields = [FIELD_COUNT]f64;

/// Fresh, zeroed fields.
pub fn emptyFields() Fields {
    return [_]f64{0} ** FIELD_COUNT;
}
