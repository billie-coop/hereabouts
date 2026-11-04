//! General types (`src/types/general.ts`) used by the foundation and number formatting.

const std = @import("std");

/// Where a string appears, for capitalization (`ContextType`).
pub const ContextType = enum {
    middle_of_text,
    begin_sentence,
    standalone,
    ui_list_or_menu,

    /// Parse 'middle-of-text', 'begin-sentence', 'standalone' or 'ui-list-or-menu'.
    pub fn fromString(s: []const u8) ?ContextType {
        const map = std.StaticStringMap(ContextType).initComptime(.{
            .{ "middle-of-text", .middle_of_text },
            .{ "begin-sentence", .begin_sentence },
            .{ "standalone", .standalone },
            .{ "ui-list-or-menu", .ui_list_or_menu },
        });
        return map.get(s);
    }
};

/// List pattern types (`ListPatternType`).
pub const ListPatternType = enum {
    @"and",
    and_short,
    @"or",
    unit_long,
    unit_narrow,
    unit_short,

    /// Parse 'and', 'and-short', 'or', 'unit-long', 'unit-narrow' or 'unit-short'.
    pub fn fromString(s: []const u8) ?ListPatternType {
        const map = std.StaticStringMap(ListPatternType).initComptime(.{
            .{ "and", .@"and" },
            .{ "and-short", .and_short },
            .{ "or", .@"or" },
            .{ "unit-long", .unit_long },
            .{ "unit-narrow", .unit_narrow },
            .{ "unit-short", .unit_short },
        });
        return map.get(s);
    }
};
