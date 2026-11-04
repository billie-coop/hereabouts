const std = @import("std");

/// Test suites: each has `test/<name>.zig` (dashes become underscores) and runs the shared
/// cases in `../conformance/<name>.json`, which it imports as `@import("cases").json`.
const suites = [_][]const u8{
    "decimal",
    "timezone",
    "datetime",
    "plurals",
    "messageformat",
    "language-tag",
    "locale",
    "locale-matcher",
    "unit-converter",
    "core-numbers",
    "core-units",
    "core-calendars",
    "core-dates",
    "core-general",
};

/// Resource packs the core suites can load, via `@import("packs").get("de")`. They come from
/// `packages/hereabouts/packs` (run `yarn build` there first). A spread of scripts, number
/// systems, plural rules and calendars.
const test_packs = [_][]const u8{
    "en", "de", "fr", "es", "pt", "ar", "fa", "he", "hi", "bn",
    "ja", "zh", "ko", "th", "ru", "pl", "sr", "tr", "sw", "my",
};

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const mod = b.addModule("hereabouts", .{
        .root_source_file = b.path("src/hereabouts.zig"),
        .target = target,
        .optimize = optimize,
    });

    const test_all = b.step("test", "Run every test suite");

    // Inline tests in src/: the suites below import the package as a dependency, so its own
    // test blocks only run here.
    const unit = b.addTest(.{ .name = "unit", .root_module = mod });
    const run_unit = b.addRunArtifact(unit);
    b.step("test-unit", "Run the inline tests in src/").dependOn(&run_unit.step);
    test_all.dependOn(&run_unit.step);

    // Packs for the core suites, embedded in a generated module.
    const pack_files = b.addWriteFiles();
    var packs_src: std.ArrayList(u8) = .empty;
    packs_src.appendSlice(b.allocator, "//! Resource packs for tests.\n\n" ++
        "pub fn get(language: []const u8) ?[]const u8 {\n") catch @panic("OOM");
    for (test_packs) |lang| {
        _ = pack_files.addCopyFile(b.path(b.fmt("../packages/hereabouts/packs/{s}.json", .{lang})), b.fmt("{s}.json", .{lang}));
        packs_src.appendSlice(b.allocator, b.fmt(
            "    if (@import(\"std\").mem.eql(u8, language, \"{s}\")) return @embedFile(\"{s}.json\");\n",
            .{ lang, lang },
        )) catch @panic("OOM");
    }
    packs_src.appendSlice(b.allocator, "    return null;\n}\n\npub const languages = [_][]const u8{") catch @panic("OOM");
    for (test_packs) |lang| packs_src.appendSlice(b.allocator, b.fmt(" \"{s}\",", .{lang})) catch @panic("OOM");
    packs_src.appendSlice(b.allocator, " };\n") catch @panic("OOM");
    const packs_mod = b.createModule(.{ .root_source_file = pack_files.add("packs.zig", packs_src.items) });

    for (suites) |name| {
        const zig_name = b.dupe(name);
        std.mem.replaceScalar(u8, zig_name, '-', '_');

        // The cases live outside this package. Copy them next to a small generated file that
        // embeds them, so the test can import them as a module.
        const files = b.addWriteFiles();
        _ = files.addCopyFile(b.path(b.fmt("../conformance/{s}.json", .{name})), "cases.json");
        const cases_src = files.add("cases.zig", "pub const json = @embedFile(\"cases.json\");\n");

        const t = b.addTest(.{
            .name = zig_name,
            .root_module = b.createModule(.{
                .root_source_file = b.path(b.fmt("test/{s}.zig", .{zig_name})),
                .target = target,
                .optimize = optimize,
                .imports = &.{
                    .{ .name = "hereabouts", .module = mod },
                    .{ .name = "cases", .module = b.createModule(.{ .root_source_file = cases_src }) },
                    .{ .name = "packs", .module = packs_mod },
                },
            }),
        });
        const run = b.addRunArtifact(t);
        const step = b.step(b.fmt("test-{s}", .{name}), b.fmt("Run the {s} tests", .{name}));
        step.dependOn(&run.step);
        test_all.dependOn(&run.step);
    }
}
