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

/// Options to initialize the library (`CLDROptions`). Cache capacities count resident
/// entries, excluding caller-owned handles. Zero disables retention.
pub const Options = struct {
    loader: ?Loader = null,
    timezone_database: *const @import("../timezone/timezone.zig").Database = @import("../timezone/timezone.zig").defaultDatabase,
    skip_checksum: bool = false,
    pack_cache_size: usize = 2,
    locale_cache_size: usize = 64,
};

/// A locale id to resolve, or a locale already resolved.
pub const LocaleInput = union(enum) {
    id: []const u8,
    locale: Locale,
};

// Small bounded LRUs. The most recently used entry is last. Nodes own their allocator
// and can survive removal from either cache and destruction of the framework.
fn Cache(comptime T: type) type {
    return struct {
        const Self = @This();
        const Entry = struct { key: []u8, node: *T };
        entries: std.ArrayList(Entry) = .empty,
        capacity: usize,

        fn get(self: *Self, key: []const u8) ?*T {
            for (self.entries.items, 0..) |e, i| {
                if (std.mem.eql(u8, e.key, key)) {
                    _ = self.entries.orderedRemove(i);
                    self.entries.appendAssumeCapacity(e);
                    return e.node;
                }
            }
            return null;
        }
        fn put(self: *Self, gpa: Allocator, key: []const u8, node: *T) Allocator.Error!void {
            if (self.capacity == 0) return;
            const k = try gpa.dupe(u8, key);
            errdefer gpa.free(k);
            // Reserve before evicting, so OOM leaves existing entries intact.
            if (self.entries.items.len < self.capacity) try self.entries.ensureUnusedCapacity(gpa, 1);
            if (self.get(key)) |_| {
                const old = self.entries.pop().?;
                gpa.free(old.key);
                old.node.release();
            } else if (self.entries.items.len == self.capacity) {
                const old = self.entries.orderedRemove(0);
                gpa.free(old.key);
                old.node.release();
            }
            node.retain();
            self.entries.appendAssumeCapacity(.{ .key = k, .node = node });
        }
        fn deinit(self: *Self, gpa: Allocator) void {
            for (self.entries.items) |e| {
                gpa.free(e.key);
                e.node.release();
            }
            self.entries.deinit(gpa);
        }
        pub fn count(self: *const Self) usize {
            return self.entries.items.len;
        }
    };
}

const PackNode = struct {
    gpa: Allocator,
    pack: *Pack,
    refs: usize = 1,
    fn retain(self: *PackNode) void {
        self.refs += 1;
    }
    fn release(self: *PackNode) void {
        self.refs -= 1;
        if (self.refs == 0) {
            self.pack.deinit();
            self.gpa.destroy(self);
        }
    }
};
const LocaleNode = struct {
    gpa: Allocator,
    value: LocaleData,
    pack: *PackNode,
    refs: usize = 1,
    fn retain(self: *LocaleNode) void {
        self.refs += 1;
    }
    fn release(self: *LocaleNode) void {
        self.refs -= 1;
        if (self.refs == 0) {
            self.value.deinit();
            self.pack.release();
            self.gpa.destroy(self);
        }
    }
};

/// An owning locale reference (`loadLocale`). Single-threaded, including its lazy caches.
/// Move by convention; ordinary copies do not retain. Use clone for another owner, and
/// deinit once per owner. Its allocator must outlive it; its framework need not.
pub const LocaleHandle = struct {
    node: *LocaleNode,
    pub fn data(self: LocaleHandle) *const LocaleData {
        return &self.node.value;
    }
    pub fn clone(self: LocaleHandle) LocaleHandle {
        self.node.retain();
        return self;
    }
    pub fn deinit(self: LocaleHandle) void {
        self.node.release();
    }
};

/// Single-threaded loader and bounded caches. Each returned handle owns its lifetime;
/// eviction and framework destruction release cache ownership without invalidating handles.
/// Loader callbacks may reenter, but must not destroy this framework during an operation.
pub const Framework = struct {
    gpa: Allocator,
    options: Options,
    schema: *const Schema = &autogen.schema,
    checksum: []const u8,
    packs: Cache(PackNode),
    locales: Cache(LocaleNode),

    /// Initialize the framework (`createFramework`).
    pub fn init(gpa: Allocator, options: Options) Framework {
        return .{
            .gpa = gpa,
            .options = options,
            .checksum = if (options.skip_checksum) "" else autogen.checksum,
            .packs = .{ .capacity = options.pack_cache_size },
            .locales = .{ .capacity = options.locale_cache_size },
        };
    }
    pub fn deinit(self: *Framework) void {
        self.locales.deinit(self.gpa);
        self.packs.deinit(self.gpa);
    }

    /// Load a locale, returning an owning handle. Call handle.deinit (`loadLocale`).
    pub fn loadLocale(self: *Framework, input: LocaleInput) Error!LocaleHandle {
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
        if (self.locales.get(key)) |node| {
            node.retain();
            return .{ .node = node };
        }

        const language = resolved.tag.getLanguage();
        const pack_node = if (self.packs.get(language)) |node| blk: {
            node.retain();
            break :blk node;
        } else blk: {
            const bytes = loader.load(loader.context, language) orelse return error.PackNotFound;
            const result = pack_mod.loadPack(gpa, bytes);
            if (loader.free) |free| free(loader.context, bytes);
            const pack = try result;
            errdefer pack.deinit();
            if (!self.options.skip_checksum and !std.mem.eql(u8, pack.checksum, self.checksum)) return error.ChecksumMismatch;
            const node = try gpa.create(PackNode);
            errdefer gpa.destroy(node);
            node.* = .{ .gpa = gpa, .pack = pack };
            try self.packs.put(gpa, language, node);
            break :blk node;
        };
        defer pack_node.release();

        const bundle = try pack_mod.packGet(gpa, pack_node.pack, resolved.tag);
        var value = LocaleData.init(gpa, resolved, bundle, self.schema, autogen.index) catch |err| {
            bundle.deinit(gpa);
            return err;
        };
        value.timezone_database = self.options.timezone_database;
        owned = false;
        const node = gpa.create(LocaleNode) catch |err| {
            var cleanup = value;
            cleanup.deinit();
            return err;
        };
        pack_node.retain();
        node.* = .{ .gpa = gpa, .value = value, .pack = pack_node };
        errdefer node.release();
        try self.locales.put(gpa, key, node);
        return .{ .node = node };
    }

    /// Resident pack count (`frameworkInfo`). The caller owns the returned string.
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
