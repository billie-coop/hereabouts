//! Built resource packs that ship with the Zig package, for a framework's loader: English only.
//! Each is copied from `packages/hereabouts/packs` (`yarn build`, then `yarn zig-packs`), so it
//! matches this version's checksum; other languages come from the npm package's `packs/` at the
//! same major.minor.

const std = @import("std");

/// The pack for `language`, or null when it doesn't ship here.
pub fn get(language: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, language, "en")) return @embedFile("en.json");
    return null;
}

pub const languages = [_][]const u8{"en"};
