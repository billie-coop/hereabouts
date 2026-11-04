const std = @import("std");
const A = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const plurals = @import("../../../plurals/plurals.zig");
const LocaleData = @import("../../locale_data.zig").LocaleData;
const Options = @import("../../common/calendars.zig").RelativeTimeFieldFormatOptions;
const NumberParams = @import("../../common/private.zig").NumberParams;
const adjust = @import("../numbers/internal.zig").adjustNumber;
const general = @import("../general/internal.zig");
pub fn renderRelativeTimeField(a: A, data: *const LocaleData, value: D.Decimal, field: []const u8, o: Options, params: *const NumberParams) D.Error![]u8 {
    const formats = data.schema.DateFields.relativeTimes;
    const format = if (std.mem.eql(u8, o.width, "short")) formats.short else if (std.mem.eql(u8, o.width, "narrow")) formats.narrow else formats.wide;
    const b = &data.bundle;
    var n = try adjust(a, value, .{ .round = o.round, .minimum_integer_digits = o.minimum_integer_digits, .maximum_fraction_digits = o.maximum_fraction_digits, .minimum_fraction_digits = o.minimum_fraction_digits, .maximum_significant_digits = o.maximum_significant_digits, .minimum_significant_digits = o.minimum_significant_digits });
    const negative = D.isNegative(n);
    if (negative) n = try D.negate(a, n);
    var res: []const u8 = "";
    if (D.isZero(n)) {
        if (o.always_now or !o.numeric_only) res = format.current.get(b, &.{field});
    } else if (!o.numeric_only and !std.mem.eql(u8, field, "hour") and !std.mem.eql(u8, field, "minute") and !std.mem.eql(u8, field, "second")) {
        if ((try D.compare(a, n, try D.fromInt(a, 2), false)) == 0) res = (if (negative) format.previous2 else format.next2).get(b, &.{field}) else if ((try D.compare(a, n, try D.fromInt(a, 1), false)) == 0) res = (if (negative) format.previous else format.next).get(b, &.{field});
    }
    if (res.len > 0) return general.contextTransform(a, res, data, o.context, "relative");
    const plural = plurals.cardinal(b.plurals, n, 0).name();
    const raw = (if (negative) format.past else format.future).get(b, &.{ plural, field });
    const transformed = try general.contextTransform(a, raw, data, o.context, "relative");
    const num = try @import("../../systems/numbering/decimal.zig").formatString(a, params.system, n, o.group orelse true, 1);
    return general.formatWrapper(a, transformed, &.{num});
}
