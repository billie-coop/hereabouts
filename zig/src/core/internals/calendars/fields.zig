const data = @import("autogen.dates.zig");
pub const Field = struct {
    pub const ERA = 0;
    pub const YEAR = 1;
    pub const QUARTER = 2;
    pub const MONTH = 3;
    pub const WEEK_OF_YEAR = 4;
    pub const WEEK_OF_MONTH = 5;
    pub const WEEKDAY = 6;
    pub const DAY = 7;
    pub const DAY_OF_YEAR = 8;
    pub const DAY_OF_WEEK_IN_MONTH = 9;
    pub const DAYPERIOD = 10;
    pub const HOUR = 11;
    pub const MINUTE = 12;
    pub const SECOND = 13;
    pub const FRACTIONAL_SECOND = 14;
    pub const ZONE = 15;
    pub const MAX_TYPE = 16;
};
pub const EXTRA_FIELD = 0x10000;
pub const MISSING_FIELD = 0x1000;
pub const FieldType = data.FieldType;
pub const FIELD_TYPES = data.field_types;
pub fn getFieldType(ch: u8, width: usize) ?FieldType {
    var best: ?FieldType = null;
    for (FIELD_TYPES) |row| if (row.char == ch) {
        best = row;
        if (row.repeat <= width and width <= row.width) return row;
    };
    return best;
}
pub fn skeletonFields() [16]i32 {
    return @splat(0);
}
