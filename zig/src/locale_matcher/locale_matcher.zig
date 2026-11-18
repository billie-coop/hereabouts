//! Port of `packages/hereabouts/src/locale-matcher`: picks the supported locale closest to
//! what the user asked for, using CLDR's language distance data, so `en-AU` gets `en-GB` and
//! `es-MX` gets `es-419`.
//!
//! ```zig
//! const m = try locale_matcher.Matcher.init(gpa, &.{.{ .string = "en, en_GB, zh, pt_AR, es-419" }}, .{});
//! defer m.deinit(gpa);
//! const r = try m.matchLocale(gpa, &.{"en-AU"}, locale_matcher.DEFAULT_THRESHOLD);
//! defer r.deinit(gpa);
//! // r.distance == 3, r.locale.id == "en_GB"
//! ```

const matcher = @import("matcher.zig");
const distance = @import("distance.zig");
const partition = @import("partition.zig");

pub const LanguageTag = @import("../language_tag/language_tag.zig").LanguageTag;
pub const Locale = @import("../locale/locale.zig").Locale;

pub const Entry = matcher.Entry;
pub const Options = matcher.Options;
pub const Input = matcher.Input;
pub const Matcher = matcher.Matcher;
pub const Match = matcher.Match;
pub const Error = matcher.Error;

pub const DEFAULT_THRESHOLD = distance.DEFAULT_THRESHOLD;
pub const MAX_DISTANCE = distance.MAX_DISTANCE;
pub const getDistance = distance.getDistance;

/// Visible for testing.
pub const parse = matcher.parse;
/// Visible for testing.
pub const sortEntries = matcher.sortEntries;
/// Visible for testing.
pub const getRegionPartition = partition.getRegionPartition;

test {
    _ = matcher;
    _ = distance;
    _ = partition;
}
