//! Message formatter that parses messages on demand and caches them. Port of
//! `packages/hereabouts/src/messageformat/formatter.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const plurals = @import("../plurals/plurals.zig");
const js = @import("js.zig");
const types = @import("types.zig");
const ev = @import("evaluation.zig");
const parser = @import("parser.zig");
const matcher_ = @import("matcher.zig");
const lru = @import("lru.zig");

const MessageCode = types.MessageCode;
const PluralRules = plurals.PluralRules;

const DEFAULT_CACHE_SIZE = 100;

fn freeCode(code: MessageCode, gpa: Allocator) void {
    code.deinit(gpa);
}

/// Bounded cache of parsed messages.
pub const Cache = lru.LRU(MessageCode, freeCode);

/// Configures a MessageFormatter instance.
pub const MessageFormatterOptions = struct {
    /// Language code, e.g. "en". Default (or empty) 'root'.
    language: ?[]const u8 = null,
    /// Region code. e.g. "US"
    region: ?[]const u8 = null,
    /// The plural rules you want to use. Otherwise they are selected using the language +
    /// region.
    plurals: ?PluralRules = null,
    /// Functions to map raw arguments to the types required by the internal tags, 'plural',
    /// 'select', 'selectordinal'.
    converter: ?ev.MessageArgConverter = null,
    /// Custom formatting functions. Borrowed: they must outlive the formatter.
    formatters: []const ev.Formatter = &.{},
    /// Parsed-message capacity (`cacheSize`): null uses 100; zero disables retention.
    cache_size: ?usize = null,
    /// Larger patterns format normally without entering the cache.
    max_cached_message_bytes: usize = 64 * 1024,
    /// Disables the escaping of text between matching apostrophes.
    disable_escapes: bool = false,
    /// How apostrophes quote text. Default (null) 'double_required' (1.x behaviour);
    /// 'double_optional' is ICU's default and lets text like `Here's {name}` through
    /// unescaped. Translators use 'double_optional'.
    apostrophe_mode: ?parser.ApostropheMode = null,
};

/// Message formatter that caches parsed messages, as returned by `createMessageFormatter`.
/// Single-threaded; callbacks may reenter formatMessage. Free with `deinit`.
pub const MessageFormatter = struct {
    gpa: Allocator,
    plurals: PluralRules,
    converter: ev.MessageArgConverter,
    formatters: []const ev.Formatter,
    matcher: matcher_.MessageMatcher,
    cache: Cache,
    max_cached_message_bytes: usize,
    disable_escapes: bool,
    apostrophe_mode: ?parser.ApostropheMode,

    pub fn deinit(self: *MessageFormatter) void {
        self.cache.deinit();
        self.matcher.deinit(self.gpa);
    }

    /// TypeScript `createMessageFormatter` (messageformat/formatter.ts).
    pub fn init(gpa: Allocator, options: MessageFormatterOptions) Allocator.Error!MessageFormatter {
        return @import("formatter.zig").createMessageFormatter(gpa, options);
    }

    /// TypeScript `formatMessage` (messageformat/formatter.ts).
    pub fn formatMessage(formatter: *MessageFormatter, gpa: Allocator, message: []const u8, positional: []const ev.MessageArg, named: []const ev.NamedArg) ev.Error![]u8 {
        return @import("formatter.zig").formatMessage(gpa, formatter, message, positional, named);
    }

    /// TypeScript `messageFormatterToString` (messageformat/formatter.ts).
    pub fn toString(formatter: *const MessageFormatter, gpa: Allocator) Allocator.Error![]u8 {
        return @import("formatter.zig").messageFormatterToString(gpa, formatter);
    }
};

/// Create a message formatter that parses messages on demand and caches them.
pub fn createMessageFormatter(gpa: Allocator, options: MessageFormatterOptions) Allocator.Error!MessageFormatter {
    const language = if (options.language) |l| (if (l.len > 0) l else "root") else "root";
    const names = try ev.formatterNames(gpa, options.formatters);
    defer gpa.free(names);
    const matcher = try matcher_.buildMessageMatcher(gpa, names, true);
    errdefer matcher.deinit(gpa);
    return .{
        .gpa = gpa,
        .plurals = options.plurals orelse plurals.getPluralRules(language, options.region),
        .converter = options.converter orelse ev.default_converter,
        .formatters = options.formatters,
        .matcher = matcher,
        .cache = try Cache.init(gpa, options.cache_size orelse DEFAULT_CACHE_SIZE),
        .max_cached_message_bytes = options.max_cached_message_bytes,
        .disable_escapes = options.disable_escapes,
        .apostrophe_mode = options.apostrophe_mode,
    };
}

/// The parsed code for a message, from the cache or parsed and cached. It stays valid until
/// the next call.
fn cacheGet(formatter: *MessageFormatter, message: []const u8) Allocator.Error!MessageCode {
    if (formatter.cache.get(message)) |code| return code;
    const code = try parser.parseMessagePattern(
        formatter.gpa,
        message,
        formatter.matcher,
        formatter.disable_escapes,
        formatter.apostrophe_mode,
    );
    try formatter.cache.set(message, code);
    // The capacity is at least 1, so the code was kept.
    return code;
}

/// Parse and evaluate the message against the given arguments, giving a string owned by
/// `gpa`. Parsed messages are cached in the formatter for reuse.
pub fn formatMessage(
    gpa: Allocator,
    formatter: *MessageFormatter,
    message: []const u8,
    positional: []const ev.MessageArg,
    named: []const ev.NamedArg,
) ev.Error![]u8 {
    // User callbacks can reenter and evict this message from the cache.
    const code = if (formatter.cache.capacity == 0 or message.len > formatter.max_cached_message_bytes)
        try parser.parseMessagePattern(gpa, message, formatter.matcher, formatter.disable_escapes, formatter.apostrophe_mode)
    else
        try types.clone(gpa, try cacheGet(formatter, message));
    defer code.deinit(gpa);
    return ev.evaluateMessage(gpa, formatter.plurals, formatter.converter, formatter.formatters, code, positional, named);
}

/// String representation of a message formatter:
/// `MessageFormatter(formatters=["foo","bar"] cached=3)`.
pub fn messageFormatterToString(gpa: Allocator, formatter: *const MessageFormatter) Allocator.Error![]u8 {
    var out: std.Io.Writer.Allocating = .init(gpa);
    errdefer out.deinit();
    const w = &out.writer;
    const names = try ev.formatterNames(gpa, formatter.formatters);
    defer gpa.free(names);
    const order = try js.objectKeyOrder(gpa, names);
    defer gpa.free(order);
    w.writeAll("MessageFormatter(formatters=[") catch return error.OutOfMemory;
    for (order, 0..) |i, j| {
        if (j > 0) w.writeByte(',') catch return error.OutOfMemory;
        js.writeJsonString(w, names[i]) catch return error.OutOfMemory;
    }
    w.print("] cached={d})", .{formatter.cache.size()}) catch return error.OutOfMemory;
    return out.toOwnedSlice();
}
