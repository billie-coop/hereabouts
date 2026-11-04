const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");
const packs = @import("packs");

test "placeholder" {
    _ = h;
    _ = cases.json;
    try std.testing.expect(packs.get("en") != null);
}
