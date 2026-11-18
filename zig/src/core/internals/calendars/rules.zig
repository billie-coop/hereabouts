const std = @import("std");
const Bundle = @import("../../resource/bundle.zig").Bundle;
const data = @import("autogen.dates.zig");
pub fn flexDayPeriod(bundle: *const Bundle, minutes: i64) ?[]const u8 {
    const r = data.day_rules.get(bundle.language_region) orelse data.day_rules.get(bundle.language) orelse return null;
    var key: ?[]const u8 = null;
    for (r.minutes, r.keys) |m, k| {
        if (minutes < m) break;
        key = k;
    }
    return key;
}
