//! The single allocation that holds a tag's strings, and the canonical forms of subtags.

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("language_tag.zig");

const Extension = lt.Extension;

pub const alignment = @alignOf(Extension);

/// Null if the value is undefined for the field ('root' counts for the language). Only an
/// exact match is undefined: 'UND' is canonicalized to the language 'und'.
pub fn canonical(field: lt.Field, value: ?[]const u8) ?[]const u8 {
    const v = value orelse return null;
    if (field == .language and std.mem.eql(u8, v, "root")) return null;
    if (std.mem.eql(u8, v, lt.undefined_values[@intFromEnum(field)])) return null;
    if (v.len == 0) return null;
    return v;
}

/// Write the canonical case of a core subtag.
pub fn transform(field: lt.Field, dst: []u8, src: []const u8) void {
    switch (field) {
        .language, .variant => for (src, 0..) |c, i| {
            dst[i] = std.ascii.toLower(c);
        },
        .region => for (src, 0..) |c, i| {
            dst[i] = std.ascii.toUpper(c);
        },
        .script => for (src, 0..) |c, i| {
            dst[i] = if (i == 0) std.ascii.toUpper(c) else std.ascii.toLower(c);
        },
    }
}

/// Space needed for a tag's strings, carved from one allocation: extensions first, then
/// string slices, then bytes.
pub const Layout = struct {
    exts: usize = 0,
    strs: usize = 0,
    bytes: usize = 0,

    pub fn size(self: Layout) usize {
        return self.exts * @sizeOf(Extension) + self.strs * @sizeOf([]const u8) + self.bytes;
    }
};

/// Hands out the pieces of a tag's allocation.
pub const Carver = struct {
    buf: []align(alignment) u8,
    ext_at: usize = 0,
    str_at: usize,
    byte_at: usize,

    pub fn init(buf: []align(alignment) u8, layout: Layout) Carver {
        const str_at = layout.exts * @sizeOf(Extension);
        return .{ .buf = buf, .str_at = str_at, .byte_at = str_at + layout.strs * @sizeOf([]const u8) };
    }

    pub fn exts(self: *Carver, n: usize) []Extension {
        if (n == 0) return &.{};
        const p: [*]Extension = @ptrCast(@alignCast(self.buf.ptr + self.ext_at));
        self.ext_at += n * @sizeOf(Extension);
        return p[0..n];
    }

    pub fn strs(self: *Carver, n: usize) [][]const u8 {
        if (n == 0) return &.{};
        const p: [*][]const u8 = @ptrCast(@alignCast(self.buf.ptr + self.str_at));
        self.str_at += n * @sizeOf([]const u8);
        return p[0..n];
    }

    pub fn bytes(self: *Carver, n: usize) []u8 {
        if (n == 0) return &.{};
        const s = self.buf[self.byte_at..][0..n];
        self.byte_at += n;
        return s;
    }

    pub fn copy(self: *Carver, s: []const u8) []const u8 {
        const d = self.bytes(s.len);
        @memcpy(d, s);
        return d;
    }

    /// Copy a core subtag in its canonical case, or as is.
    pub fn copyField(self: *Carver, field: lt.Field, s: ?[]const u8, case: bool) ?[]const u8 {
        const v = s orelse return null;
        if (!case) return self.copy(v);
        const d = self.bytes(v.len);
        transform(field, d, v);
        return d;
    }
};

pub fn alloc(gpa: Allocator, layout: Layout) Allocator.Error![]align(alignment) u8 {
    const n = layout.size();
    if (n == 0) return &.{};
    return gpa.alignedAlloc(u8, .fromByteUnits(alignment), n);
}
