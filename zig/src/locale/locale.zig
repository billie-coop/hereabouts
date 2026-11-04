//! Port of `packages/hereabouts/src/locale`: locales, alias substitution, likely subtags and
//! emoji flags.
//!
//! Functions that take a tag accept an `Input`: `.{ .id = "en-US" }` is parsed first,
//! `.{ .tag = t }` is used as is (`string | LanguageTag` in the TypeScript).

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("../language_tag/language_tag.zig");
const resolver = @import("resolver.zig");
const flags = @import("flags.zig");

pub const LanguageTag = lt.LanguageTag;
pub const Input = resolver.Input;

pub const substituteAliases = resolver.substituteAliases;
pub const resolveLanguageTag = resolver.resolveLanguageTag;
pub const addLikelySubtags = resolver.addLikelySubtags;
pub const removeLikelySubtags = resolver.removeLikelySubtags;

/// Visible for testing.
pub const fastTag = resolver.fastTag;
/// Visible for testing.
pub const returnTag = resolver.returnTag;

pub const regionFlag = flags.regionFlag;
pub const subdivisionFlag = flags.subdivisionFlag;
pub const localeFlag = flags.localeFlag;
pub const flagRegion = flags.flagRegion;

/// An application's opaque locale identifier paired with a parsed and resolved language tag.
pub const Locale = struct {
    /// Application's own identifier for the locale, e.g. 'en_US', 'fr-CA', etc. We preserve
    /// this since applications may use it as a unique key to resolve translated messages,
    /// and may be forced to use a legacy identifier.
    id: []const u8,

    /// Language tag that has been parsed and resolved. Parsing canonicalizes the subtags,
    /// while resolution includes substituting language and territory aliases and adding
    /// likely subtags.
    tag: LanguageTag,

    /// Free a locale returned by this library (it owns `id` and `tag`).
    pub fn deinit(self: Locale, gpa: Allocator) void {
        gpa.free(self.id);
        self.tag.deinit(gpa);
    }
};

/// Parses a language tag and resolves it, substituting aliases and adding likely subtags.
/// A tag with no language, script or region stays undefined ('und'), without extensions.
pub fn resolveLocaleId(gpa: Allocator, id: []const u8) Allocator.Error!Locale {
    var sfa = std.heap.stackFallback(512, gpa);
    const tmp = sfa.get();
    const parsed = try lt.parse(tmp, id);
    defer parsed.deinit(tmp);
    var tag: LanguageTag = .{};
    if (parsed.hasLanguage() or parsed.hasScript() or parsed.hasRegion()) {
        tag = try resolveLanguageTag(gpa, .{ .tag = parsed });
    }
    errdefer tag.deinit(gpa);
    return .{ .id = try gpa.dupe(u8, id), .tag = tag };
}

test {
    _ = resolver;
    _ = flags;
}

test "resolve locale id" {
    const gpa = std.testing.allocator;
    const l = try resolveLocaleId(gpa, "en-US-u-nu-thai-ca-gregory");
    defer l.deinit(gpa);
    const s = try l.tag.compact(gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("en-Latn-US-u-ca-gregory-nu-thai", s);
}
