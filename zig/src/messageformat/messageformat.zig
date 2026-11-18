//! ICU message format: parsing, evaluation, a caching formatter, and a translator for
//! message catalogs. Port of `packages/hereabouts/src/messageformat`.
//!
//! ```zig
//! var f = try messageformat.MessageFormatter.init(gpa, .{ .language = "en" });
//! defer f.deinit();
//! const s = try f.formatMessage(gpa,
//!     "{count, plural, one {# item} other {# items}}", &.{}, &.{.{ .name = "count", .value = .{ .number = 3 } }});
//! defer gpa.free(s); // "3 items"
//! ```
//!
//! Arguments are `MessageArg` values (a tagged union: string, number, boolean, Decimal, null,
//! or an opaque pointer for custom formatters). Custom formatters are `Formatter` values: a
//! name plus a function pointer and context.

const types = @import("types.zig");
const matcher = @import("matcher.zig");
const parser = @import("parser.zig");
const evaluation = @import("evaluation.zig");
const formatter = @import("formatter.zig");
const translator = @import("translator.zig");

// Parsed code
pub const Argument = types.Argument;
pub const MessageOpType = types.MessageOpType;
pub const PluralNumberType = types.PluralNumberType;
pub const PluralChoiceType = types.PluralChoiceType;
pub const PluralChoice = types.PluralChoice;
pub const SelectChoice = types.SelectChoice;
pub const Plural = types.Plural;
pub const Select = types.Select;
pub const Simple = types.Simple;
pub const MessageCode = types.MessageCode;

// Matching and parsing
pub const MessageState = matcher.MessageState;
pub const MessageMatcher = matcher.MessageMatcher;
pub const ApostropheMode = parser.ApostropheMode;
pub const parseMessagePattern = parser.parseMessagePattern;

// Evaluation
pub const Error = evaluation.Error;
pub const MessageArg = evaluation.MessageArg;
pub const Opaque = evaluation.Opaque;
pub const NamedArg = evaluation.NamedArg;
pub const MessageArgs = evaluation.MessageArgs;
pub const MessageArgConverter = evaluation.MessageArgConverter;
pub const default_converter = evaluation.default_converter;
pub const Formatter = evaluation.Formatter;
pub const evaluateMessage = evaluation.evaluateMessage;
pub const numberToString = evaluation.numberToString;

// Formatter
pub const MessageFormatterOptions = formatter.MessageFormatterOptions;
pub const MessageFormatter = formatter.MessageFormatter;

// Translator
pub const Message = translator.Message;
pub const Catalog = translator.Catalog;
pub const TranslatorOptions = translator.TranslatorOptions;
pub const Translator = translator.Translator;
pub const Resolved = translator.Resolved;
pub const ArgNamesOptions = translator.ArgNamesOptions;
pub const messageArgNames = translator.messageArgNames;
pub const freeStrings = translator.freeStrings;
pub const Problem = translator.Problem;
pub const CatalogIssue = translator.CatalogIssue;
pub const CheckCatalogsOptions = translator.CheckCatalogsOptions;
pub const freeCatalogIssues = translator.freeCatalogIssues;
pub const comptimeArgNames = translator.comptimeArgNames;
pub const toArg = translator.toArg;
pub const Typed = translator.Typed;

test {
    _ = @import("js.zig");
    _ = @import("lru.zig");
    _ = types;
    _ = matcher;
    _ = parser;
    _ = evaluation;
    _ = formatter;
    _ = translator;
}
