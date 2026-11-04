//! Cached context transform flags (`api/private/api.ts`).
const std = @import("std");
const LocaleData = @import("../../locale_data.zig").LocaleData;

/// Borrowed JSON object, owned by the locale's cache arena.
pub fn getContextTransformInfo(data: *const LocaleData) std.mem.Allocator.Error!*const std.json.Value {
    return data.cached(std.json.Value, "general.contextTransforms", {}, build);
}
fn build(_: void, data: *const LocaleData, a: std.mem.Allocator) std.mem.Allocator.Error!std.json.Value {
    return data.schema.ContextTransforms.contextTransforms.mapping(a, &data.bundle);
}
