//! Convenience layer (`cldr.ts`). The bound groups are small values borrowing LocaleData.
//! `var fw = CLDRFramework.init(gpa, options); const en = try fw.get(.{ .id = "en" });`
//! `const s = try en.Numbers.formatDecimal(gpa, n, .{});`
const std = @import("std");
const framework = @import("framework.zig");
const LocaleData = @import("locale_data.zig").LocaleData;
const api = @import("api/api.zig");

/// A bound locale. It stays valid until its framework or standalone locale data is freed.
pub const CLDR = struct {
    data: *const LocaleData,
    Schema: *const @import("types/schema.zig").Schema,
    General: api.General,
    Numbers: api.Numbers,
    Units: api.Units,
};
pub fn bindGeneral(data: *const LocaleData) api.General {
    return .{ .data = data };
}
pub fn bindNumbers(data: *const LocaleData) api.Numbers {
    return .{ .data = data };
}
pub fn bindUnits(data: *const LocaleData) api.Units {
    return .{ .data = data };
}
pub fn bindCLDR(data: *const LocaleData) CLDR {
    return .{ .data = data, .Schema = data.schema, .General = bindGeneral(data), .Numbers = bindNumbers(data), .Units = bindUnits(data) };
}

/// Owns the loader and caches. get returns a small bound value; repeated calls share data.
pub const CLDRFramework = struct {
    framework: framework.Framework,
    pub fn init(gpa: std.mem.Allocator, options: framework.Options) CLDRFramework {
        return .{ .framework = framework.Framework.init(gpa, options) };
    }
    pub fn deinit(self: *CLDRFramework) void {
        self.framework.deinit();
    }
    pub fn get(self: *CLDRFramework, input: framework.LocaleInput) framework.Error!CLDR {
        return bindCLDR(try self.framework.loadLocale(input));
    }
    /// The generated schema represents the shipped config. Custom configs aren't supported.
    pub fn config(self: *const CLDRFramework) *const @import("types/schema.zig").Schema {
        return self.framework.schema;
    }
    pub fn info(self: *const CLDRFramework, gpa: std.mem.Allocator) std.mem.Allocator.Error![]u8 {
        return self.framework.info(gpa);
    }
};
pub const cldrFramework = CLDRFramework.init;
