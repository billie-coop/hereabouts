//! Everything the locale functions need for one locale (`locale-data.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const Locale = @import("../locale/locale.zig").Locale;
const Bundle = @import("resource/bundle.zig").Bundle;
const Schema = @import("types/schema.zig").Schema;
const KeyIndex = @import("schema/instructions.zig").KeyIndex;
const autogen = @import("schema/autogen.schema.zig");

/// Look up a key index of the active schema config by name ('currency-id', 'unit-id', ...).
pub const IndexLookup = *const fn (name: []const u8) ?*const KeyIndex;

/// The strings of the locale's bundle, the locale the caller asked for, and the schema accessor
/// and key indices for the schema config the resource pack was built with.
///
/// Pass it as the first argument of the locale functions, e.g.
/// `numbers.formatDecimal(gpa, data, n, .{})`. Values derived from it (number symbols, ...) are
/// cached in it, see `cached`. Not thread-safe: the caches are filled on first use.
pub const LocaleData = struct {
    gpa: Allocator,
    /// The strings (the TypeScript's LocaleData extends Bundle).
    bundle: Bundle,
    /// The locale as requested: the application's id and the resolved language tag.
    locale: Locale,
    /// Schema accessor tree for the active schema config.
    schema: *const Schema,
    /// Key indices (currency ids, unit ids, ...) for the active schema config, by name.
    indices: IndexLookup,
    /// Derived values, filled on first use. A pointer so functions can take `*const LocaleData`.
    caches: *Caches,

    pub const Caches = struct {
        arena: std.heap.ArenaAllocator,
        map: std.StringHashMapUnmanaged(*anyopaque) = .empty,
    };

    /// Combine a bundle with the locale and schema it is used with. Takes ownership of `bundle`
    /// and `locale` (both are freed by `deinit`). (`localeData`)
    pub fn init(gpa: Allocator, locale: Locale, bundle: Bundle, schema: *const Schema, indices: IndexLookup) Allocator.Error!LocaleData {
        const caches = try gpa.create(Caches);
        caches.* = .{ .arena = .init(gpa) };
        return .{
            .gpa = gpa,
            .bundle = bundle,
            .locale = locale,
            .schema = schema,
            .indices = indices,
            .caches = caches,
        };
    }

    /// Locale data for the shipped schema config.
    pub fn initDefault(gpa: Allocator, locale: Locale, bundle: Bundle) Allocator.Error!LocaleData {
        return init(gpa, locale, bundle, &autogen.schema, autogen.index);
    }

    pub fn deinit(self: *LocaleData) void {
        self.caches.arena.deinit();
        self.gpa.destroy(self.caches);
        self.bundle.deinit(self.gpa);
        self.locale.deinit(self.gpa);
    }

    /// Read the string at an offset of the bundle.
    pub fn get(self: *const LocaleData, offset: usize) []const u8 {
        return self.bundle.get(offset);
    }

    /// A value derived from this locale data, built by `build` on first use and kept until
    /// `deinit`. `key` must be unique per kind of value (prefix it with your area, e.g.
    /// "numbers.params.latn"). `build` allocates the value and anything it points to with the
    /// given allocator (the cache's arena), and must not free it.
    pub fn cached(
        self: *const LocaleData,
        comptime T: type,
        key: []const u8,
        context: anytype,
        comptime build: fn (@TypeOf(context), *const LocaleData, Allocator) Allocator.Error!T,
    ) Allocator.Error!*const T {
        const c = self.caches;
        if (c.map.get(key)) |p| return @ptrCast(@alignCast(p));
        const a = c.arena.allocator();
        const v = try a.create(T);
        v.* = try build(context, self, a);
        try c.map.put(a, try a.dupe(u8, key), v);
        return v;
    }
};
