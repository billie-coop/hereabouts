//! hereabouts as a Zig package, from this repo's root (a GitHub URL): the sources and the
//! shipped packs live in `zig/`, whose own build runs the tests.
//!
//!     const dep = b.dependency("hereabouts", .{ .target = target, .optimize = optimize });
//!     mod.addImport("hereabouts", dep.module("hereabouts"));
//!     mod.addImport("hereabouts_packs", dep.module("packs")); // the en pack, when names are needed

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    _ = b.addModule("hereabouts", .{
        .root_source_file = b.path("zig/src/hereabouts.zig"),
        .target = target,
        .optimize = optimize,
    });
    _ = b.addModule("packs", .{
        .root_source_file = b.path("zig/packs/packs.zig"),
        .target = target,
        .optimize = optimize,
    });
}
