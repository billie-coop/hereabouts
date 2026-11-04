//! Resource packs: all scripts and regions of one language (`resource/pack.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("../../language_tag/language_tag.zig");
const locale = @import("../../locale/locale.zig");
const bundle_mod = @import("bundle.zig");
const Bundle = bundle_mod.Bundle;
const ExceptionIndex = bundle_mod.ExceptionIndex;
const LanguageTag = lt.LanguageTag;

pub const Error = error{InvalidPack} || Allocator.Error;

/// Fields in a resource pack are separated by an UNDERSCORE character
const DELIM = '_';

/// Layer in the pack that supports all regions for a single language + script. Region
/// exception indices are decoded on first use and cached.
pub const PackScript = struct {
    strings: []const []const u8,
    exceptions: []const []const u8,
    /// Encoded exception index per region.
    regions: std.StringArrayHashMapUnmanaged([]const u8),
    default_region: []const u8,
    cache: std.StringHashMapUnmanaged(*ExceptionIndex) = .empty,
};

/// Runtime resource pack, built by `loadPack` from the JSON resource pack. Owns all its memory;
/// bundles borrow its string tables, so it must outlive them.
///
/// The pack's `spellout` rule sets are not loaded: nothing in the library uses them yet.
pub const Pack = struct {
    gpa: Allocator,
    arena: std.heap.ArenaAllocator,
    version: []const u8,
    cldr_version: []const u8,
    checksum: []const u8,
    language: []const u8,
    default_tag: LanguageTag,
    scripts: std.StringArrayHashMapUnmanaged(PackScript),

    /// Free the pack and everything in it.
    pub fn deinit(self: *Pack) void {
        const gpa = self.gpa;
        self.arena.deinit();
        gpa.destroy(self);
    }
};

const RawScript = struct {
    strings: []const u8,
    exceptions: []const u8,
    regions: std.json.ArrayHashMap([]const u8),
    defaultRegion: []const u8,
};

const RawPack = struct {
    version: ?[]const u8 = null,
    cldr: []const u8 = "",
    checksum: []const u8 = "",
    language: []const u8 = "",
    defaultTag: []const u8 = "",
    scripts: std.json.ArrayHashMap(RawScript) = .{},
};

fn split(a: Allocator, s: []const u8) Allocator.Error![]const []const u8 {
    const n = std.mem.count(u8, s, &.{DELIM}) + 1;
    const out = try a.alloc([]const u8, n);
    var it = std.mem.splitScalar(u8, s, DELIM);
    var i: usize = 0;
    while (it.next()) |part| : (i += 1) out[i] = part;
    return out;
}

/// Parse a resource pack from its JSON text. The text is copied; the caller keeps ownership of
/// `data`. Free the result with `pack.deinit()`. (`loadPack`)
pub fn loadPack(gpa: Allocator, data: []const u8) Error!*Pack {
    const pack = try gpa.create(Pack);
    errdefer gpa.destroy(pack);
    pack.* = .{
        .gpa = gpa,
        .arena = .init(gpa),
        .version = "",
        .cldr_version = "",
        .checksum = "",
        .language = "",
        .default_tag = .{},
        .scripts = .empty,
    };
    errdefer pack.arena.deinit();
    const a = pack.arena.allocator();

    const raw = std.json.parseFromSliceLeaky(RawPack, a, data, .{
        .ignore_unknown_fields = true,
        // JSON.parse keeps the last of repeated keys.
        .duplicate_field_behavior = .use_last,
        .allocate = .alloc_always,
    }) catch |e| return if (e == error.OutOfMemory) error.OutOfMemory else error.InvalidPack;
    // 'Severe error: data does not look like a valid resource pack.'
    const version = raw.version orelse return error.InvalidPack;

    pack.version = version;
    pack.cldr_version = raw.cldr;
    pack.checksum = raw.checksum;
    pack.language = raw.language;
    pack.default_tag = try locale.resolveLanguageTag(a, .{ .id = raw.defaultTag });

    var it = raw.scripts.map.iterator();
    while (it.next()) |e| {
        const s = e.value_ptr.*;
        try pack.scripts.put(a, e.key_ptr.*, .{
            .strings = try split(a, s.strings),
            .exceptions = try split(a, s.exceptions),
            .regions = s.regions.map,
            .default_region = s.defaultRegion,
        });
    }
    return pack;
}

/// `parseInt(s, 36)`: the longest valid prefix, or null (NaN).
fn parseBase36(s: []const u8) ?u32 {
    var r: u64 = 0;
    var n: usize = 0;
    for (s) |c| {
        const d: u64 = switch (c) {
            '0'...'9' => c - '0',
            'a'...'z' => c - 'a' + 10,
            'A'...'Z' => c - 'A' + 10,
            else => break,
        };
        r = r * 36 + d;
        if (r > std.math.maxInt(u32)) return std.math.maxInt(u32);
        n += 1;
    }
    return if (n == 0) null else @intCast(r);
}

fn decodeRegion(pack: *Pack, script: *PackScript, region: []const u8) Allocator.Error!?*ExceptionIndex {
    const raw = script.regions.get(region) orelse return null;
    const a = pack.arena.allocator();
    const index = try a.create(ExceptionIndex);
    index.* = .empty;
    // Pairs of base-36 numbers: string offset, exception index.
    var nums: std.ArrayList(?u32) = .empty;
    defer nums.deinit(pack.gpa);
    if (raw.len > 0) {
        var it = std.mem.splitScalar(u8, raw, ' ');
        while (it.next()) |n| try nums.append(pack.gpa, parseBase36(n));
    }
    var i: usize = 0;
    while (i + 1 < nums.items.len) : (i += 2) {
        const k = nums.items[i] orelse continue;
        // An unparsable index reads as an empty string, like the TypeScript's NaN.
        try index.put(a, k, nums.items[i + 1] orelse std.math.maxInt(u32));
    }
    try script.cache.put(a, try a.dupe(u8, region), index);
    return index;
}

fn cachedRegion(pack: *Pack, script: *PackScript, region: []const u8) Allocator.Error!?*ExceptionIndex {
    if (script.cache.get(region)) |index| return index;
    return decodeRegion(pack, script, region);
}

fn packScriptGet(gpa: Allocator, pack: *Pack, script: *PackScript, tag_in: LanguageTag) Allocator.Error!Bundle {
    var tag = tag_in;
    var tmp: ?LanguageTag = null;
    defer if (tmp) |t| t.deinit(gpa);
    var index = try cachedRegion(pack, script, tag.getRegion());
    if (index == null) {
        tmp = try lt.init(gpa, .{
            .language = tag.getLanguage(),
            .script = tag.getScript(),
            .region = script.default_region,
            .variant = tag.getVariant(),
            .extensions = tag.extensions,
            .private_use = tag.private_use,
        });
        tag = tmp.?;
        index = try cachedRegion(pack, script, script.default_region);
    }
    return bundle_mod.stringBundle(gpa, tag, script.strings, script.exceptions, index);
}

/// Get the bundle for a language tag from the pack. Falls back to the pack's default script and
/// the script's default region when the tag's are not present. The bundle borrows the pack's
/// tables; free it with `bundle.deinit(gpa)`. (`packGet`)
///
/// Decoding a region's exception index caches it in the pack, so this mutates the pack.
pub fn packGet(gpa: Allocator, pack: *Pack, tag_in: LanguageTag) Error!Bundle {
    var tag = tag_in;
    var resolved: ?LanguageTag = null;
    defer if (resolved) |t| t.deinit(gpa);
    var swapped: ?LanguageTag = null;
    defer if (swapped) |t| t.deinit(gpa);

    // We need the script and region to find the correct string layer. Caller should
    // ideally supply a resolved language tag to avoid the overhead of this call.
    if (!tag.hasLanguage() or !tag.hasScript() or !tag.hasRegion()) {
        resolved = try locale.resolveLanguageTag(gpa, .{ .tag = tag });
        tag = resolved.?;
    }

    // Strings for a language are organized by script.
    var script = pack.scripts.getPtr(tag.getScript());
    if (script == null) {
        // Swap in the default script
        const d = pack.default_tag;
        swapped = try lt.init(gpa, .{
            .language = d.getLanguage(),
            .script = d.getScript(),
            .region = d.getRegion(),
            .variant = d.getVariant(),
            .extensions = tag.extensions,
            .private_use = tag.private_use,
        });
        tag = swapped.?;
        script = pack.scripts.getPtr(tag.getScript());
    }
    // The TypeScript fails with a TypeError here.
    const s = script orelse return error.InvalidPack;
    return packScriptGet(gpa, pack, s, tag);
}
