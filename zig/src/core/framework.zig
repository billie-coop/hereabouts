//! Loader state: the schema, a cache of resource packs and a cache of loaded locales
//! (`framework.ts`).
//!
//! ```zig
//! var fw = core.Framework.init(gpa, .{ .loader = .{ .load = myLoad } });
//! defer fw.deinit();
//! const en = try fw.loadLocale(.{ .id = "en-US" });
//! const s = try core.numbers.formatDecimal(gpa, en, n, .{});
//! ```
//!
//! Only the shipped schema config (`src/config.ts`) is supported: its schema is generated at
//! build time (`schema/autogen.schema.zig`), so there are no custom configs.

const std = @import("std");
const Allocator = std.mem.Allocator;
const locale_mod = @import("../locale/locale.zig");
const Locale = locale_mod.Locale;
const LanguageTag = locale_mod.LanguageTag;
const pack_mod = @import("resource/pack.zig");
const Pack = pack_mod.Pack;
const LocaleData = @import("locale_data.zig").LocaleData;
const autogen = @import("schema/autogen.schema.zig");
const Schema = @import("types/schema.zig").Schema;

pub const Error = error{
    /// 'A synchronous resource loader is not defined'
    NoLoader,
    /// The loader has no pack for the language.
    PackNotFound,
    /// 'Checksum mismatch on resource pack! The schema config used to generate the resource
    /// pack must be identical to the one used at runtime.'
    ChecksumMismatch,
    /// The data does not look like a valid resource pack.
    InvalidPack,
} || Allocator.Error;

/// Supplies the JSON text of resource packs.
pub const Loader = struct {
    context: ?*anyopaque = null,
    /// The pack's JSON text for a language ('en'), or null if there is none. The framework
    /// copies what it needs before calling `free`.
    load: *const fn (context: ?*anyopaque, language: []const u8) ?[]const u8,
    /// Called with the bytes `load` returned once they are parsed, if set.
    free: ?*const fn (context: ?*anyopaque, bytes: []const u8) void = null,
};

/// Options to initialize the library (`CLDROptions`). The TypeScript's cache sizes have no
/// equivalent: see `Framework`.
pub const Options = struct {
    loader: ?Loader = null,
    /// Skip comparing the packs' checksums with the schema's.
    skip_checksum: bool = false,
};

/// A locale id to resolve, or a locale already resolved.
pub const LocaleInput = union(enum) {
    id: []const u8,
    locale: Locale,
};

/// Loader state: the schema, the loaded packs and the loaded locales.
///
/// The TypeScript keeps packs and locale data in size-limited caches and lets the garbage
/// collector free what is no longer used. Here locale data points into its pack, and callers
/// hold `*const LocaleData`, so both live until `deinit`: each language's pack is loaded once
/// and each locale is built once (loading it again returns the same locale data). Not
/// thread-safe.
pub const Framework = struct {
    gpa: Allocator,
    options: Options,
    schema: *const Schema = &autogen.schema,
    /// Checksum of the schema config, compared with each pack's. Empty when skip_checksum.
    checksum: []const u8,
    /// Packs by language.
    packs: std.StringHashMapUnmanaged(*Pack) = .empty,
    /// Locale data by locale id and resolved tag.
    locales: std.StringHashMapUnmanaged(*LocaleData) = .empty,

    /// Set up the schema and caches (`createFramework`).
    pub fn init(gpa: Allocator, options: Options) Framework {
        return .{
            .gpa = gpa,
            .options = options,
            .checksum = if (options.skip_checksum) "" else autogen.checksum,
        };
    }

    pub fn deinit(self: *Framework) void {
        var li = self.locales.iterator();
        while (li.next()) |e| {
            self.gpa.free(e.key_ptr.*);
            e.value_ptr.*.deinit();
            self.gpa.destroy(e.value_ptr.*);
        }
        var pi = self.packs.iterator();
        while (pi.next()) |e| {
            self.gpa.free(e.key_ptr.*);
            e.value_ptr.*.deinit();
        }
        self.locales.deinit(self.gpa);
        self.packs.deinit(self.gpa);
    }

    /// Load the resource pack for a locale (or use the cached one) and return the locale data.
    /// It belongs to the framework. (`loadLocale`)
    pub fn loadLocale(self: *Framework, input: LocaleInput) Error!*const LocaleData {
        const loader = self.options.loader orelse return error.NoLoader;
        const gpa = self.gpa;
        var resolved = switch (input) {
            .id => |id| try resolveLocale(gpa, id),
            .locale => |l| try cloneLocale(gpa, l),
        };
        var owned = true;
        defer if (owned) resolved.deinit(gpa);

        const key = try cacheKey(gpa, resolved);
        defer gpa.free(key);
        if (self.locales.get(key)) |d| return d;

        const language = resolved.tag.getLanguage();
        var pack = self.packs.get(language);
        if (pack == null) {
            const data = loader.load(loader.context, language) orelse return error.PackNotFound;
            const p = pack_mod.loadPack(gpa, data);
            if (loader.free) |free| free(loader.context, data);
            const loaded = try p;
            errdefer loaded.deinit();
            if (!self.options.skip_checksum and !std.mem.eql(u8, loaded.checksum, self.checksum)) {
                return error.ChecksumMismatch;
            }
            const lang = try gpa.dupe(u8, language);
            errdefer gpa.free(lang);
            try self.packs.put(gpa, lang, loaded);
            pack = loaded;
        }

        const bundle = try pack_mod.packGet(gpa, pack.?, resolved.tag);
        const d = gpa.create(LocaleData) catch |e| {
            bundle.deinit(gpa);
            return e;
        };
        d.* = LocaleData.init(gpa, resolved, bundle, self.schema, autogen.index) catch |e| {
            bundle.deinit(gpa);
            gpa.destroy(d);
            return e;
        };
        owned = false;
        errdefer {
            d.deinit();
            gpa.destroy(d);
        }
        const k = try gpa.dupe(u8, key);
        errdefer gpa.free(k);
        try self.locales.put(gpa, k, d);
        return d;
    }

    /// Number of resource packs currently cached, as a string for diagnostics
    /// (`frameworkInfo`). Free with `gpa.free`.
    pub fn info(self: *const Framework, gpa: Allocator) Allocator.Error![]u8 {
        return std.fmt.allocPrint(gpa, "packs loaded: {d}", .{self.packs.count()});
    }
};

/// Return the library version (`cldrVersion`).
pub fn cldrVersion() []const u8 {
    return autogen.version;
}

/// Parse a locale identifier and resolve it. The Locale keeps the original id string and a
/// resolved LanguageTag. Free with `locale.deinit(gpa)`. (`resolveLocale`)
pub fn resolveLocale(gpa: Allocator, id: []const u8) Allocator.Error!Locale {
    const tag = try locale_mod.resolveLanguageTag(gpa, .{ .id = id });
    errdefer tag.deinit(gpa);
    return .{ .id = try gpa.dupe(u8, id), .tag = tag };
}

/// Resolve a language tag into a Locale whose id is the tag's compact form.
pub fn resolveLocaleTag(gpa: Allocator, tag: LanguageTag) Allocator.Error!Locale {
    const id = try tag.compact(gpa);
    errdefer gpa.free(id);
    return .{ .id = id, .tag = try locale_mod.resolveLanguageTag(gpa, .{ .tag = tag }) };
}

fn cloneLocale(gpa: Allocator, l: Locale) Allocator.Error!Locale {
    const id = try gpa.dupe(u8, l.id);
    errdefer gpa.free(id);
    return .{ .id = id, .tag = try l.tag.clone(gpa) };
}

// The id as given ('en_CA' and 'en-CA' are different ids) and the tag it resolved to.
fn cacheKey(gpa: Allocator, l: Locale) Allocator.Error![]u8 {
    const c = try l.tag.compact(gpa);
    defer gpa.free(c);
    return std.fmt.allocPrint(gpa, "{s}\x00{s}", .{ l.id, c });
}
