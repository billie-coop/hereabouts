//! The strings of one locale (`resource/bundle.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const LanguageTag = @import("../../language_tag/language_tag.zig").LanguageTag;
const plurals = @import("../../plurals/plurals.zig");

/// Maps a string table offset to an index in the exceptions table.
pub const ExceptionIndex = std.AutoHashMapUnmanaged(u32, u32);

/// All strings for one locale, plus a few precomputed properties of its language tag. Read
/// strings with `get(offset)` (normally through the schema arrows).
///
/// The string tables and the exception index belong to the resource pack, which must outlive
/// the bundle. The bundle owns its id, tag and the derived strings: free them with `deinit`.
pub const Bundle = struct {
    /// Compact form of the tag, e.g. 'en-Latn-US'.
    id: []const u8,
    language: []const u8,
    region: []const u8,
    strings: []const []const u8,
    exceptions: []const []const u8,
    index: ?*const ExceptionIndex,
    tag: LanguageTag,
    /// e.g. 'en-US', precomputed for fast lookups into region-keyed maps
    language_region: []const u8,
    /// e.g. 'en-Latn'
    language_script: []const u8,
    /// Calendar system from the 'u-ca' extension, or '' to use the region's preference.
    calendar_system: []const u8,
    /// Number system from the 'u-nu' extension, or 'default'.
    number_system: []const u8,
    /// Cardinal and ordinal plural rules for the locale.
    plurals: plurals.PluralRules,

    /// Read the string at the given offset. A region-specific exception overrides the string
    /// table. (`bundleGet`)
    pub fn get(self: *const Bundle, offset: usize) []const u8 {
        if (self.index) |index| {
            if (offset <= std.math.maxInt(u32)) {
                if (index.get(@intCast(offset))) |i| {
                    return if (i < self.exceptions.len) self.exceptions[i] else "";
                }
            }
        }
        return if (offset < self.strings.len) self.strings[offset] else "";
    }

    pub fn deinit(self: Bundle, gpa: Allocator) void {
        gpa.free(self.id);
        gpa.free(self.language_region);
        gpa.free(self.language_script);
        self.tag.deinit(gpa);
    }
};

/// Read the string at the given offset (`bundleGet`).
pub fn bundleGet(bundle: *const Bundle, offset: usize) []const u8 {
    return bundle.get(offset);
}

/// Build the bundle for a resolved language tag from the tables of a resource pack. The tag is
/// copied; the tables and index are borrowed. (`stringBundle`)
pub fn stringBundle(
    gpa: Allocator,
    tag_in: LanguageTag,
    strings: []const []const u8,
    exceptions: []const []const u8,
    index: ?*const ExceptionIndex,
) Allocator.Error!Bundle {
    const tag = try tag_in.clone(gpa);
    errdefer tag.deinit(gpa);
    const id = try tag.compact(gpa);
    errdefer gpa.free(id);
    const language = tag.getLanguage();
    const region = tag.getRegion();

    // Empty string will select the preferred calendar for the region.
    var calendar_system: []const u8 = "";
    var number_system: []const u8 = "default";

    // See if there are unicode extensions for number and calendar systems.
    for (tag.extensionSubtags("u")) |subtag| {
        if (std.mem.startsWith(u8, subtag, "nu-")) {
            number_system = subtag[3..];
        } else if (std.mem.startsWith(u8, subtag, "ca-")) {
            calendar_system = subtag[3..];
        }
    }

    const language_region = try std.fmt.allocPrint(gpa, "{s}-{s}", .{ language, region });
    errdefer gpa.free(language_region);
    const language_script = try std.fmt.allocPrint(gpa, "{s}-{s}", .{ language, tag.getScript() });

    return .{
        .id = id,
        .language = language,
        .region = region,
        .strings = strings,
        .exceptions = exceptions,
        .index = index,
        .tag = tag,
        .language_region = language_region,
        .language_script = language_script,
        .calendar_system = calendar_system,
        .number_system = number_system,
        .plurals = plurals.getPluralRules(language, region),
    };
}
