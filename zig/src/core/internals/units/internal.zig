//! Unit quantity rendering (`internals/units/internal.ts`). Allocates in `a` (an arena).

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const Part = D.Part;
const plurals = @import("../../../plurals/plurals.zig");
const LocaleData = @import("../../locale_data.zig").LocaleData;
const NumberParams = @import("../../common/private.zig").NumberParams;
const units = @import("../../common/units.zig");
const Quantity = units.Quantity;
const UnitFormatOptions = units.UnitFormatOptions;
const UnitLength = units.UnitLength;
const DecimalFormatOptions = @import("../../common/numbers.zig").DecimalFormatOptions;
const UnitInfo = @import("../../types/schema.zig").UnitInfo;
const NumberRenderer = @import("../numbers/render.zig").NumberRenderer;
const renderDecimal = @import("../numbers/internal.zig").renderDecimal;
const isJsSpace = @import("../../parsing/wrapper.zig").isJsSpace;

fn nonEmpty(s: ?[]const u8) ?[]const u8 {
    const v = s orelse return null;
    return if (v.len == 0) null else v;
}

/// The decimal options of unit options.
pub fn decimalOptions(o: UnitFormatOptions) DecimalFormatOptions {
    return .{
        .nu = o.nu,
        .round = o.round,
        .group = o.group,
        .minimum_integer_digits = o.minimum_integer_digits,
        .maximum_fraction_digits = o.maximum_fraction_digits,
        .minimum_fraction_digits = o.minimum_fraction_digits,
        .maximum_significant_digits = o.maximum_significant_digits,
        .minimum_significant_digits = o.minimum_significant_digits,
        .trim_zero_fractions = o.trim_zero_fractions,
        .divisor = o.divisor,
        .style = o.style,
    };
}

/// Format a quantity: the number, its pluralized unit pattern, and an optional 'per' or
/// 'times' unit. (`renderUnit`)
pub fn renderUnit(a: Allocator, data: *const LocaleData, renderer: NumberRenderer, q: Quantity, options: UnitFormatOptions, params: *const NumberParams) D.Error![]Part {
    const b = &data.bundle;
    const r = try renderDecimal(a, data, renderer, q.value, decimalOptions(options), params);
    const num = r.parts;
    const plural = r.plural;
    const unit = q.unit orelse return num;

    // Compute plural category for the value '1'
    const singular = plurals.cardinal(data.bundle.plurals, D.ONE, 0).name();

    // For default and "per" compound pattern, the {0} will use the plural category and {1}
    // will be singular. Examples:
    //   1 meter per second
    //  10 meters per second
    //
    // For the "times" compound pattern, the {0} will be singular, and the {1} will use the
    // plural category. Examples:
    //   1 newton-meter
    //  10 newton-meters
    const times = nonEmpty(q.times);
    const per = nonEmpty(q.per);
    const plural0 = if (times != null) singular else plural;
    const plural1 = if (times != null) plural else singular;

    const info = getUnitInfo(data, options.length);
    var pattern = info.unitPattern.get(b, &.{ plural0, unit });
    if (pattern.len == 0) pattern = info.unitPattern.get(b, &.{ "other", unit });

    const zero = try renderer.wrap(pattern, &.{num});
    if (per) |p| {
        // Check if the per unit has its own pattern
        const per_pattern = info.perUnitPattern.get(b, &.{p});
        if (per_pattern.len > 0) return renderer.wrap(per_pattern, &.{zero});
    }

    // Compound pattern to combine the two units, if any
    const compound = if (per != null) info.perPattern.get(b) else if (times != null) info.timesPattern.get(b) else "";

    if (per orelse times) |perunit| {
        // Fetch the pattern for the denominator unit and strip the placeholder
        const denom = try stripPlaceholder(a, info.unitPattern.get(b, &.{ plural1, perunit }));
        const one = try renderer.make("per", denom);
        return renderer.wrap(compound, &.{ zero, one });
    }
    return zero;
}

/// `s.replace(/\s*\{0\}\s*/, '')`: remove the first '{0}' and the whitespace around it.
fn stripPlaceholder(a: Allocator, s: []const u8) Allocator.Error![]const u8 {
    const at = std.mem.indexOf(u8, s, "{0}") orelse return s;
    var start = at;
    while (start > 0) {
        var i = start - 1;
        while (i > 0 and (s[i] & 0xc0) == 0x80) i -= 1;
        const cp = std.unicode.utf8Decode(s[i..start]) catch break;
        if (!isJsSpace(cp)) break;
        start = i;
    }
    var end = at + 3;
    while (end < s.len) {
        const n = std.unicode.utf8ByteSequenceLength(s[end]) catch break;
        if (end + n > s.len) break;
        const cp = std.unicode.utf8Decode(s[end .. end + n]) catch break;
        if (!isJsSpace(cp)) break;
        end += n;
    }
    return std.mem.concat(a, u8, &.{ s[0..start], s[end..] });
}

/// Unit patterns for a length; null is 'long'. (`getUnitInfo`)
pub fn getUnitInfo(data: *const LocaleData, length: ?UnitLength) UnitInfo {
    const u = data.schema.Units;
    return switch (length orelse .long) {
        .narrow => u.narrow,
        .short => u.short,
        .long => u.long,
    };
}
