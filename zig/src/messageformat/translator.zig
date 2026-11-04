//! Translating an app's text with message catalogs. Port of
//! `packages/hereabouts/src/messageformat/translator.ts`.
//!
//! The app keeps its messages in a source catalog, from message key to ICU message pattern in
//! the source language (often the key is the English text itself), and one catalog per
//! translated language with the same keys:
//!
//! ```zig
//! const en = [_]Message{
//!     .{ .key = "Save changes?", .message = "Save changes?" },
//!     .{ .key = "{count} invoices", .message = "{count, plural, one {# invoice} other {# invoices}}" },
//! };
//! const de = [_]Message{
//!     .{ .key = "{count} invoices", .message = "{count, plural, one {# Rechnung} other {# Rechnungen}}" },
//! };
//! var t = try Translator.init(gpa, .{ .source = &en, .catalogs = &.{.{ .id = "de", .messages = &de }} });
//! defer t.deinit();
//! const s = try t.translate(gpa, "de-AT", "{count} invoices", &.{.{ .name = "count", .value = .{ .number = 3 } }});
//! // "3 Rechnungen"
//! ```
//!
//! The TypeScript also checks keys and arguments at compile time through its type system;
//! `Typed(source)` does the same with comptime. Use `checkCatalogs(translator)` in a test to
//! catch missing or extra keys, placeholders that differ from the source, and messages that
//! don't parse.

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../decimal/decimal.zig");
const plurals = @import("../plurals/plurals.zig");
const js = @import("js.zig");
const types = @import("types.zig");
const ev = @import("evaluation.zig");
const parser = @import("parser.zig");
const matcher_ = @import("matcher.zig");

const MessageCode = types.MessageCode;
const PluralRules = plurals.PluralRules;
const ApostropheMode = parser.ApostropheMode;
const Error = ev.Error;
const Cache = @import("formatter.zig").Cache;
const RuleCache = @import("lru.zig").LRU(PluralRules, freeRules);
fn freeRules(_: PluralRules, _: Allocator) void {}

/// A message in a catalog: its key and its pattern.
pub const Message = struct {
    key: []const u8,
    message: []const u8,
};

/// A translated catalog: its language or locale id ('de', 'pt-PT', 'zh-Hant') and some or all
/// of the source catalog's keys, each with a message in the catalog's language. `messages`
/// null is a catalog listed as `undefined`.
pub const Catalog = struct {
    id: []const u8,
    messages: ?[]const Message,
};

/// Options for `createTranslator`. Everything is borrowed and must outlive the translator.
/// Keys within a catalog, and catalog ids, are expected to be unique (as object keys are in
/// the TypeScript).
pub const TranslatorOptions = struct {
    /// Messages in the source language, by key. Its keys are the keys `translate` accepts.
    source: []const Message,
    /// Parsed pattern capacity: null uses 100; zero disables caching.
    cache_size: ?usize = null,
    /// Plural-rule capacity: null uses 64; zero disables caching.
    plural_cache_size: ?usize = null,
    /// Larger patterns format normally without entering the cache.
    max_cached_message_bytes: usize = 64 * 1024,
    /// Language of the source messages, for their plural rules. Default (or empty) 'en'.
    source_language: ?[]const u8 = null,
    /// Translated catalogs. A message missing from a catalog falls back to the less specific
    /// catalog ('pt-PT' to 'pt'), then to the source.
    catalogs: []const Catalog = &.{},
    /// Custom formatters for `{arg, name}` placeholders, as for `createMessageFormatter`.
    formatters: []const ev.Formatter = &.{},
    /// Converts arguments for plural / select, as for `createMessageFormatter`.
    converter: ?ev.MessageArgConverter = null,
    /// How apostrophes quote text. Default (null) 'double_optional' (ICU's default), so
    /// translations can contain apostrophes (`Here's {name}`, `l'{item}`) without escaping.
    apostrophe_mode: ?ApostropheMode = null,
};

/// A translator: the catalogs plus caches of parsed messages and plural rules, shared by every
/// `translate` call. Single-threaded; callbacks may reenter. Keep one per thread/catalog set
/// and deinit it when done.
pub const Translator = struct {
    gpa: Allocator,
    source: []const Message,
    source_language: []const u8,
    catalogs: []const Catalog,
    formatters: []const ev.Formatter,
    converter: ev.MessageArgConverter,
    matcher: matcher_.MessageMatcher,
    apostrophe_mode: ApostropheMode,
    /// Bounded parsed-pattern and plural-rule caches. Unknown caller keys can be patterns.
    parsed: Cache,
    plurals: RuleCache,
    max_cached_message_bytes: usize,

    pub fn deinit(self: *Translator) void {
        self.parsed.deinit();
        self.plurals.deinit();
        self.matcher.deinit(self.gpa);
    }

    /// TypeScript `createTranslator` (messageformat/translator.ts).
    pub fn init(gpa: Allocator, options: TranslatorOptions) Allocator.Error!Translator {
        return @import("translator.zig").createTranslator(gpa, options);
    }

    /// TypeScript `resolveMessage` (messageformat/translator.ts).
    pub fn resolveMessage(t: *const Translator, locale: []const u8, key: []const u8) Resolved {
        return @import("translator.zig").resolveMessage(t, locale, key);
    }

    /// TypeScript `translate` (messageformat/translator.ts).
    pub fn translate(t: *Translator, gpa: Allocator, locale: []const u8, key: []const u8, named: []const ev.NamedArg) Error![]u8 {
        return @import("translator.zig").translate(gpa, t, locale, key, named);
    }

    /// TypeScript `isMessageKey` (messageformat/translator.ts).
    pub fn isMessageKey(t: *const Translator, key: []const u8) bool {
        return @import("translator.zig").isMessageKey(t, key);
    }

    /// TypeScript `checkCatalogs` (messageformat/translator.ts).
    pub fn checkCatalogs(t: *Translator, gpa: Allocator, options: CheckCatalogsOptions) Allocator.Error![]CatalogIssue {
        return @import("translator.zig").checkCatalogs(gpa, t, options);
    }
};

/// Create a translator for a source catalog and its translations. See `translate`.
pub fn createTranslator(gpa: Allocator, options: TranslatorOptions) Allocator.Error!Translator {
    const names = try ev.formatterNames(gpa, options.formatters);
    defer gpa.free(names);
    const sl = options.source_language orelse "";
    const matcher = try matcher_.buildMessageMatcher(gpa, names, true);
    errdefer matcher.deinit(gpa);
    var parsed = try Cache.init(gpa, options.cache_size orelse 100);
    errdefer parsed.deinit();
    var rules = try RuleCache.init(gpa, options.plural_cache_size orelse 64);
    errdefer rules.deinit();
    return .{
        .gpa = gpa,
        .source = options.source,
        .source_language = if (sl.len > 0) sl else "en",
        .catalogs = options.catalogs,
        .formatters = options.formatters,
        .converter = options.converter orelse ev.default_converter,
        .matcher = matcher,
        .parsed = parsed,
        .plurals = rules,
        .max_cached_message_bytes = options.max_cached_message_bytes,
        .apostrophe_mode = options.apostrophe_mode orelse .double_optional,
    };
}

fn isRegion(p: []const u8) bool {
    if (p.len == 2) return std.ascii.isAlphabetic(p[0]) and std.ascii.isAlphabetic(p[1]);
    if (p.len == 3) {
        for (p) |c| if (!std.ascii.isDigit(c)) return false;
        return true;
    }
    return false;
}

/// Plural rules for a catalog id ('pt-PT' -> Portuguese as used in Portugal), cached.
fn pluralsFor(t: *Translator, id: []const u8) Allocator.Error!PluralRules {
    if (t.plurals.get(id)) |rules| return rules;
    var it = std.mem.splitScalar(u8, id, '-');
    const language = it.next().?;
    var region: ?[]const u8 = null;
    var buf: [3]u8 = undefined;
    while (it.next()) |p| {
        if (isRegion(p)) {
            region = std.ascii.upperString(buf[0..p.len], p);
            break;
        }
    }
    const rules = plurals.getPluralRules(if (language.len > 0) language else "root", region);
    if (id.len <= t.max_cached_message_bytes) try t.plurals.set(id, rules);
    return rules;
}

// Return an owned snapshot: callbacks may recursively translate and evict cache entries.
fn parse(gpa: Allocator, t: *Translator, pattern: []const u8) Allocator.Error!MessageCode {
    if (t.parsed.get(pattern)) |code| return types.clone(gpa, code);
    const code = try parser.parseMessagePattern(gpa, pattern, t.matcher, false, t.apostrophe_mode);
    errdefer code.deinit(gpa);
    if (t.parsed.capacity > 0 and pattern.len <= t.max_cached_message_bytes) {
        // set takes ownership even on error.
        try t.parsed.set(pattern, try types.clone(t.gpa, code));
    }
    return code;
}

/// A message and the id of the catalog it came from (the source language if none had it).
pub const Resolved = struct {
    message: []const u8,
    language: []const u8,
};

fn findMessage(messages: []const Message, key: []const u8) ?[]const u8 {
    for (messages) |m| {
        if (std.mem.eql(u8, m.key, key)) return m.message;
    }
    return null;
}

/// True if `id` is the candidate catalog id `locale` with '_' read as '-'.
fn idMatches(id: []const u8, locale: []const u8) bool {
    if (id.len != locale.len) return false;
    for (id, locale) |a, b| {
        if (a != (if (b == '_') '-' else b)) return false;
    }
    return true;
}

/// The message in the catalog `id` for `key`, if there is one.
fn catalogMessage(t: *const Translator, id: []const u8, key: []const u8) ?[]const u8 {
    for (t.catalogs) |c| {
        if (!idMatches(c.id, id)) continue;
        return findMessage(c.messages orelse return null, key);
    }
    // The TypeScript reads catalogs from a plain object, so ids it inherits from
    // Object.prototype find functions there, whose 'name' is a string.
    if (std.mem.eql(u8, key, "name") and js.isObjectPrototypeKey(id) and !std.mem.eql(u8, id, "__proto__")) {
        return if (std.mem.eql(u8, id, "constructor")) "Object" else id;
    }
    return null;
}

/// The message for `key` in the most specific catalog for `locale` that has it, and the id of
/// that catalog (the source language if none does). Catalog ids to try, most specific first:
/// 'pt-PT' -> 'pt-PT', 'pt'. Both strings are borrowed from the translator (or are `key`).
pub fn resolveMessage(t: *const Translator, locale: []const u8, key: []const u8) Resolved {
    var end = locale.len;
    while (true) {
        const id = locale[0..end];
        if (catalogMessage(t, id, key)) |m| {
            // Return the catalog's own id.
            for (t.catalogs) |c| {
                if (idMatches(c.id, id)) return .{ .message = m, .language = c.id };
            }
            return .{ .message = m, .language = id };
        }
        end = std.mem.lastIndexOfAny(u8, locale[0..end], "-_") orelse break;
    }
    return .{ .message = findMessage(t.source, key) orelse key, .language = t.source_language };
}

/// Translate a message into `locale` ('de', 'pt-BR', a device locale such as 'en_CA'): the
/// message from the most specific catalog that has it, falling back to the source, formatted
/// with the plural rules of the language it is written in (an English fallback on a Japanese
/// device uses English plural rules). Returns a string owned by `gpa`.
///
/// Parsed messages are cached in the translator, so repeated calls only evaluate.
pub fn translate(
    gpa: Allocator,
    t: *Translator,
    locale: []const u8,
    key: []const u8,
    named: []const ev.NamedArg,
) Error![]u8 {
    const r = resolveMessage(t, locale, key);
    // Text with no braces or apostrophes formats to itself.
    if (std.mem.indexOfAny(u8, r.message, "{'") == null) return gpa.dupe(u8, r.message);
    const rules = try pluralsFor(t, r.language);
    const code = try parse(gpa, t, r.message);
    defer code.deinit(gpa);
    return ev.evaluateMessage(gpa, rules, t.converter, t.formatters, code, &.{}, named);
}

/// True if `key` is a key of the translator's source catalog, e.g. to translate a runtime
/// string (a validation message from a shared schema) only when it is one.
pub fn isMessageKey(t: *const Translator, key: []const u8) bool {
    return findMessage(t.source, key) != null;
}

// ---------------------------------------------------------------------------------------------
// Checking catalogs

const NameSet = std.StringArrayHashMapUnmanaged(void);

fn collectArgs(a: Allocator, code: MessageCode, names: *NameSet) Allocator.Error!void {
    switch (code) {
        .arg => |x| try addArg(a, x, names),
        .plural => |p| {
            for (p.args) |x| try addArg(a, x, names);
            for (p.choices) |c| try collectArgs(a, c.code, names);
        },
        .select => |s| {
            for (s.args) |x| try addArg(a, x, names);
            for (s.choices) |c| try collectArgs(a, c.code, names);
        },
        .simple => |s| for (s.args) |x| try addArg(a, x, names),
        .block => |b| for (b) |c| try collectArgs(a, c, names),
        else => {},
    }
}

fn addArg(a: Allocator, x: types.Argument, names: *NameSet) Allocator.Error!void {
    const s = switch (x) {
        .name => |n| try a.dupe(u8, n),
        .number => |n| try ev.numberToString(a, n),
    };
    try names.put(a, s, {});
}

/// Options for `messageArgNames`.
pub const ArgNamesOptions = struct {
    /// Custom formatter names the pattern may use.
    formatters: []const []const u8 = &.{},
    /// Default (null) 'double_optional'.
    apostrophe_mode: ?ApostropheMode = null,
};

/// The argument names a message pattern uses, sorted: `count`, `customer` for
/// `'{count, plural, one {# for {customer}} other {# for {customer}}}'`. Free the result
/// with `freeStrings`.
pub fn messageArgNames(gpa: Allocator, pattern: []const u8, options: ArgNamesOptions) Allocator.Error![][]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const names = try argNames(a, pattern, options);
    const out = try gpa.alloc([]u8, names.len);
    var n: usize = 0;
    errdefer {
        for (out[0..n]) |s| gpa.free(s);
        gpa.free(out);
    }
    for (names) |s| {
        out[n] = try gpa.dupe(u8, s);
        n += 1;
    }
    return out;
}

fn argNames(a: Allocator, pattern: []const u8, options: ArgNamesOptions) Allocator.Error![][]const u8 {
    var names: NameSet = .empty;
    const matcher = try matcher_.buildMessageMatcher(a, options.formatters, true);
    const code = try parser.parseMessagePattern(a, pattern, matcher, false, options.apostrophe_mode orelse .double_optional);
    try collectArgs(a, code, &names);
    const keys = names.keys();
    std.mem.sort([]const u8, keys, {}, js.lessThan);
    return keys;
}

/// Free a list of strings returned by this module.
pub fn freeStrings(gpa: Allocator, xs: []const []u8) void {
    for (xs) |x| gpa.free(x);
    gpa.free(xs);
}

/// Kinds of problems `checkCatalogs` finds.
pub const Problem = enum {
    missing,
    extra,
    placeholders,
    unbalanced,
    no_other,

    /// The TypeScript name: 'missing', ..., 'no-other'.
    /// Zig string form of the TypeScript problem.
    pub fn toString(self: Problem) []const u8 {
        return if (self == .no_other) "no-other" else @tagName(self);
    }
};

/// A problem found by `checkCatalogs`. Strings are owned; free the list with
/// `freeCatalogIssues`.
pub const CatalogIssue = struct {
    /// Catalog id, or the source language for problems in the source catalog.
    language: []const u8,
    key: []const u8,
    problem: Problem,
    detail: []const u8,
};

pub fn freeCatalogIssues(gpa: Allocator, issues: []const CatalogIssue) void {
    for (issues) |i| {
        gpa.free(i.language);
        gpa.free(i.key);
        gpa.free(i.detail);
    }
    gpa.free(issues);
}

/// Options for `checkCatalogs`.
pub const CheckCatalogsOptions = struct {
    /// Report keys missing from a catalog. Set false while translations are in progress.
    complete: bool = true,
};

fn depthOk(pattern: []const u8, mode: ApostropheMode) bool {
    // Count braces outside quoted text, as the parser sees them.
    var d: i64 = 0;
    var i: usize = 0;
    while (i < pattern.len) : (i += 1) {
        const c = pattern[i];
        if (c == '\'') {
            const next: u8 = if (i + 1 < pattern.len) pattern[i + 1] else 0;
            if (next == '\'') {
                i += 1;
            } else if (mode == .double_required or next == '{' or next == '}' or next == '#') {
                i = std.mem.indexOfScalarPos(u8, pattern, i + 1, '\'') orelse return d == 0;
            }
        } else if (c == '{') {
            d += 1;
        } else if (c == '}') {
            d -= 1;
            if (d < 0) return false;
        }
    }
    return d == 0;
}

fn missingOther(code: MessageCode) bool {
    switch (code) {
        .plural => |p| {
            var has = false;
            for (p.choices) |c| {
                if (std.mem.eql(u8, c.value, "other")) has = true;
            }
            if (!has) return true;
            for (p.choices) |c| if (missingOther(c.code)) return true;
            return false;
        },
        .select => |s| {
            var has = false;
            for (s.choices) |c| {
                if (std.mem.eql(u8, c.value, "other")) has = true;
            }
            if (!has) return true;
            for (s.choices) |c| if (missingOther(c.code)) return true;
            return false;
        },
        .block => |b| {
            for (b) |c| if (missingOther(c)) return true;
            return false;
        },
        else => return false,
    }
}

const Checker = struct {
    gpa: Allocator,
    a: Allocator,
    t: *Translator,
    formatters: []const []const u8,
    issues: std.ArrayList(CatalogIssue) = .empty,

    fn add(self: *Checker, language: []const u8, key: []const u8, problem: Problem, detail: []const u8) Allocator.Error!void {
        try self.issues.ensureUnusedCapacity(self.gpa, 1);
        const l = try self.gpa.dupe(u8, language);
        errdefer self.gpa.free(l);
        const k = try self.gpa.dupe(u8, key);
        errdefer self.gpa.free(k);
        const d = try self.gpa.dupe(u8, detail);
        self.issues.appendAssumeCapacity(.{ .language = l, .key = k, .problem = problem, .detail = d });
    }

    fn list(self: *Checker, names: []const []const u8) Allocator.Error![]const u8 {
        if (names.len == 0) return "none";
        var out: std.ArrayList(u8) = .empty;
        for (names, 0..) |n, i| {
            if (i > 0) try out.appendSlice(self.a, ", ");
            try out.print(self.a, "{{{s}}}", .{n});
        }
        return out.items;
    }

    fn check(self: *Checker, language: []const u8, key: []const u8, message: []const u8, expected: ?[]const []const u8) Allocator.Error!void {
        const mode = self.t.apostrophe_mode;
        if (!depthOk(message, mode)) return self.add(language, key, .unbalanced, message);
        const code = try parse(self.a, self.t, message);
        defer code.deinit(self.a);
        if (missingOther(code)) try self.add(language, key, .no_other, message);
        if (expected) |exp| {
            const names = try argNames(self.a, message, .{ .formatters = self.formatters, .apostrophe_mode = mode });
            // The TypeScript compares the lists joined with commas.
            const x = try std.mem.join(self.a, ",", names);
            const y = try std.mem.join(self.a, ",", exp);
            if (!std.mem.eql(u8, x, y)) {
                const detail = try std.fmt.allocPrint(self.a, "has {s}, source has {s}", .{ try self.list(names), try self.list(exp) });
                try self.add(language, key, .placeholders, detail);
            }
        }
    }
};

/// Check a translator's catalogs against the source catalog, for a unit test. Reports keys
/// missing from or unknown to a catalog, messages whose placeholders differ from the source
/// message's, unbalanced braces, and plural / select messages without an `other` case. The
/// source catalog is checked too. Free the result with `freeCatalogIssues`.
pub fn checkCatalogs(gpa: Allocator, t: *Translator, options: CheckCatalogsOptions) Allocator.Error![]CatalogIssue {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();

    var c: Checker = .{ .gpa = gpa, .a = a, .t = t, .formatters = try ev.formatterNames(a, t.formatters) };
    errdefer {
        for (c.issues.items) |i| {
            gpa.free(i.language);
            gpa.free(i.key);
            gpa.free(i.detail);
        }
        c.issues.deinit(gpa);
    }

    // Source keys in the order Object.keys gives them.
    const source_keys = try a.alloc([]const u8, t.source.len);
    for (t.source, source_keys) |m, *k| k.* = m.key;
    const order = try js.objectKeyOrder(a, source_keys);

    const source_args = try a.alloc([]const []const u8, t.source.len);
    for (order) |i| {
        const m = t.source[i];
        try c.check(t.source_language, m.key, m.message, null);
        source_args[i] = if (depthOk(m.message, t.apostrophe_mode))
            try argNames(a, m.message, .{ .formatters = c.formatters, .apostrophe_mode = t.apostrophe_mode })
        else
            &.{};
    }

    const catalogs = try a.dupe(Catalog, t.catalogs);
    const ById = struct {
        fn less(_: void, x: Catalog, y: Catalog) bool {
            return js.lessThan({}, x.id, y.id);
        }
    };
    std.mem.sort(Catalog, catalogs, {}, ById.less);

    for (catalogs) |cat| {
        const messages = cat.messages orelse &.{};
        for (order) |i| {
            const key = t.source[i].key;
            const message = findMessage(messages, key) orelse {
                if (options.complete) try c.add(cat.id, key, .missing, "");
                continue;
            };
            try c.check(cat.id, key, message, source_args[i]);
        }
        const keys = try a.alloc([]const u8, messages.len);
        for (messages, keys) |m, *k| k.* = m.key;
        for (try js.objectKeyOrder(a, keys)) |i| {
            if (!isMessageKey(t, keys[i])) try c.add(cat.id, keys[i], .extra, "");
        }
    }
    return c.issues.toOwnedSlice(gpa);
}

// ---------------------------------------------------------------------------------------------
// Compile-time checks: the placeholders of a message, read from its pattern at compile time.

fn trim(comptime s: []const u8) []const u8 {
    return std.mem.trim(u8, s, " ");
}

/// The argument name right after a `{`: up to the first `,` or `}`; null if it doesn't look
/// like an argument name (`count`, `customer_name`, `0`).
fn nameAt(comptime s: []const u8) ?[]const u8 {
    const close = std.mem.indexOfScalar(u8, s, '}') orelse return null;
    const n = s[0..close];
    const name = trim(if (std.mem.indexOfScalar(u8, n, ',')) |c| n[0..c] else n);
    if (name.len == 0 or std.mem.indexOfAny(u8, name, " #{'") != null) return null;
    return name;
}

/// The argument names in an ICU message pattern, as the TypeScript's `MessageArgNames` type
/// reads them: walking the braces, arguments open at even depths (0 for
/// `{count, plural, ...}`, 2 for a `{customer}` inside one of its branches); odd depths open
/// plural / select branches. Apostrophes are not considered.
pub fn comptimeArgNames(comptime pattern: []const u8) []const []const u8 {
    comptime {
        @setEvalBranchQuota(100000);
        var names: []const []const u8 = &.{};
        var s = pattern;
        var depth: usize = 0;
        while (true) {
            const open = std.mem.indexOfScalar(u8, s, '{');
            const close = std.mem.indexOfScalar(u8, s, '}');
            if (open != null and (close == null or open.? < close.?)) {
                const post = s[open.? + 1 ..];
                if (depth % 2 == 0 and depth <= 8) {
                    if (nameAt(post)) |n| {
                        var seen = false;
                        for (names) |x| {
                            if (std.mem.eql(u8, x, n)) seen = true;
                        }
                        if (!seen) names = names ++ .{n};
                    }
                }
                depth += 1;
                s = post;
            } else if (close) |c| {
                if (depth > 0) depth -= 1;
                s = s[c + 1 ..];
            } else break;
        }
        return names;
    }
}

/// A named argument from a Zig value: strings, numbers, booleans, Decimals, `MessageArg`s and
/// `null`.
pub fn toArg(value: anytype) ev.MessageArg {
    const T = @TypeOf(value);
    if (T == ev.MessageArg) return value;
    if (T == D.Decimal) return .{ .decimal = value };
    if (T == @TypeOf(null)) return .null;
    switch (@typeInfo(T)) {
        .int, .comptime_int => return .{ .number = @floatFromInt(value) },
        .float, .comptime_float => return .{ .number = @floatCast(value) },
        .bool => return .{ .boolean = value },
        .pointer => return .{ .string = value },
        else => @compileError("can't use a " ++ @typeName(T) ++ " as a message argument"),
    }
}

/// Keys and arguments checked at compile time against a source catalog known at compile
/// time, as the TypeScript's types do: an unknown key, or arguments missing a placeholder of
/// the source message, are compile errors. Extra arguments are allowed.
///
/// ```zig
/// const T = Typed(&en);
/// const s = try T.translate(gpa, &translator, "de", "{count} invoices", .{ .count = 3 });
/// ```
pub fn Typed(comptime source: []const Message) type {
    return struct {
        fn patternFor(comptime key: []const u8) []const u8 {
            for (source) |m| {
                if (std.mem.eql(u8, m.key, key)) return m.message;
            }
            @compileError("not a key of the source catalog: " ++ key);
        }

        /// `translate` with a key checked against the source catalog and `args` (a struct
        /// such as `.{ .count = 3 }`) checked against its placeholders.
        pub fn translate(gpa: Allocator, t: *Translator, locale: []const u8, comptime key: []const u8, args: anytype) Error![]u8 {
            const Args = @TypeOf(args);
            const names = comptime comptimeArgNames(patternFor(key));
            inline for (names) |n| {
                if (!@hasField(Args, n)) @compileError("missing argument '" ++ n ++ "' for message: " ++ key);
            }
            const fields = @typeInfo(Args).@"struct".fields;
            var named: [fields.len]ev.NamedArg = undefined;
            inline for (fields, 0..) |f, i| {
                named[i] = .{ .name = f.name, .value = toArg(@field(args, f.name)) };
            }
            return translateImpl(gpa, t, locale, key, &named);
        }
    };
}

const translateImpl = translate;

test "comptimeArgNames" {
    const eq = struct {
        fn f(comptime pattern: []const u8, comptime want: []const []const u8) !void {
            const got = comptime comptimeArgNames(pattern);
            try std.testing.expectEqual(want.len, got.len);
            inline for (want) |w| {
                var found = false;
                for (got) |g| {
                    if (std.mem.eql(u8, g, w)) found = true;
                }
                try std.testing.expect(found);
            }
        }
    }.f;
    // The TypeScript type tests.
    try eq("{count} invoices", &.{"count"});
    try eq("{count, plural, one {# for {customer}} other {# invoices}}", &.{ "count", "customer" });
    try eq("{count, plural, one {invoice} other {invoices}}", &.{"count"});
    try eq("{g, select, male {he} other {{name}}}", &.{ "g", "name" });
    try eq("Save changes?", &.{});
    try eq("paid {date} for {amount, number}", &.{ "date", "amount" });
    try eq("{ count , plural, =0 {none} other {#}}", &.{"count"});
}

test "typed translate" {
    const gpa = std.testing.allocator;
    const en = [_]Message{
        .{ .key = "greeting", .message = "Hello {name}, {n, plural, one {# message} other {# messages}}" },
        .{ .key = "bye", .message = "Bye" },
    };
    var t = try createTranslator(gpa, .{ .source = &en });
    defer t.deinit();
    const T = Typed(&en);
    const s = try T.translate(gpa, &t, "en", "greeting", .{ .name = "Ada", .n = 2 });
    defer gpa.free(s);
    try std.testing.expectEqualStrings("Hello Ada, 2 messages", s);
    const b = try T.translate(gpa, &t, "en", "bye", .{});
    defer gpa.free(b);
    try std.testing.expectEqualStrings("Bye", b);
}
