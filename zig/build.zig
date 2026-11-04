const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const mod = b.addModule("hereabouts", .{
        .root_source_file = b.path("src/hereabouts.zig"),
        .target = target,
        .optimize = optimize,
    });

    const test_step = b.step("test", "Run unit tests and the shared conformance cases");

    const unit_tests = b.addTest(.{ .root_module = mod });
    test_step.dependOn(&b.addRunArtifact(unit_tests).step);

    // The shared cases live in ../conformance, outside this package. Copy them next to a small
    // generated file that embeds them, so the test can import them as a module.
    const cases = b.addWriteFiles();
    _ = cases.addCopyFile(b.path("../conformance/decimal.json"), "decimal.json");
    const cases_src = cases.add("cases.zig", "pub const decimal = @embedFile(\"decimal.json\");\n");

    const conformance = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("test/conformance.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "hereabouts", .module = mod },
                .{ .name = "cases", .module = b.createModule(.{ .root_source_file = cases_src }) },
            },
        }),
    });
    test_step.dependOn(&b.addRunArtifact(conformance).step);
}
