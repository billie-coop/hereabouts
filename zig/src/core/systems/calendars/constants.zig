//! Calendar constants (`constants.ts`).

/// Minimum days in the first week of an ISO-8601 year.
pub const ISO8601_MIN_DAYS = 4;

// Min and max Julian day form a range of full years whose midpoint is the UNIX epoch
// Jan 1 1970. The goal is to constrain the epoch timestamps to a reasonable range.

/// Mon Jan 1 4713 BC.
pub const JD_MIN = 0;
/// Thu Jan 1 1970 AD.
pub const JD_UNIX_EPOCH = 2440588;
/// Fri Dec 31 8652 AD.
pub const JD_MAX = 4881503;

/// Date of cutover to the Gregorian calendar, Oct 15, 1582.
pub const JD_GREGORIAN_CUTOVER = 2299161;
pub const JD_GREGORIAN_CUTOVER_YEAR = 1582;
pub const JD_GREGORIAN_CUTOVER_MONTH = 10;
pub const JD_GREGORIAN_CUTOVER_DAY = 15;

/// Julian day for Jan 1, 1, the first day of the Gregorian calendar common era.
pub const JD_GREGORIAN_EPOCH = 1721426;

/// Julian day for Mar 21, 622 CE, the first day of the Persian calendar.
pub const JD_PERSIAN_EPOCH = 1948320;

pub const BUDDHIST_ERA_START = -543;

pub const ONE_SECOND_MS = 1000;
pub const ONE_MINUTE_MS = ONE_SECOND_MS * 60;
pub const ONE_HOUR_MS = ONE_MINUTE_MS * 60;
pub const ONE_DAY_MS = ONE_HOUR_MS * 24;
pub const ONE_WEEK_MS = ONE_DAY_MS * 7;
