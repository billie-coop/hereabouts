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
                },
            }),
        });
        const run = b.addRunArtifact(t);
        const step = b.step(b.fmt("test-{s}", .{name}), b.fmt("Run the {s} tests", .{name}));
        step.dependOn(&run.step);
        test_all.dependOn(&run.step);
    }
}
