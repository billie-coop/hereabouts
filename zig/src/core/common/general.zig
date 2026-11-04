//! General formatting options (`common/general.ts`).
const std = @import("std");
pub const ContextType = @import("../types/general.zig").ContextType;
pub const ListPatternType = @import("../types/general.zig").ListPatternType;
pub const MeasurementSystem = enum { us, uk, metric };
pub const MeasurementCategory = enum { temperature };
pub const CharacterOrder = enum { ltr, rtl };
pub const LineOrder = enum { ttb, btt };
pub const AltType = enum {
    none,
    short,
    narrow,
    variant,
    stand_alone,
    long,
    menu,
    pub fn fromString(s: []const u8) ?AltType {
        if (std.mem.eql(u8, s, "stand-alone")) return .stand_alone;
        return std.meta.stringToEnum(AltType, s);
    }
    pub fn string(self: AltType) []const u8 {
        return if (self == .stand_alone) "stand-alone" else @tagName(self);
    }
};
pub const DisplayNameOptions = struct {
    type: AltType = .none,
    context: ContextType = .begin_sentence,
};
pub const CurrencyDisplayNameOptions = @import("../api/numbers.zig").CurrencyDisplayNameOptions;
