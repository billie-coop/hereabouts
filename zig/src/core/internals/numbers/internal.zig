//! Decimal and currency rendering (`internals/numbers/internal.ts`).
//!
//! Everything here allocates in `a` without freeing: callers pass an arena.

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const Decimal = D.Decimal;
const Part = D.Part;
const plurals = @import("../../../plurals/plurals.zig");
const LocaleData = @import("../../locale_data.zig").LocaleData;
const NumberParams = @import("../../common/private.zig").NumberParams;
const opts = @import("../../common/numbers.zig");
const DecimalFormatOptions = opts.DecimalFormatOptions;
const CurrencyFormatOptions = opts.CurrencyFormatOptions;
const DecimalAdjustOptions = opts.DecimalAdjustOptions;
const number_parsing = @import("../../parsing/number.zig");
const NumberPattern = number_parsing.NumberPattern;
const DigitsArrow = @import("../../schema/schema/arrows.zig").DigitsArrow;
const NumberSystemInfo = @import("../../types/schema.zig").NumberSystemInfo;
const NumberContext = @import("context.zig").NumberContext;
const NumberRenderer = @import("render.zig").NumberRenderer;
const util = @import("util.zig");

/// If n is zero check if it is signed and return abs.
fn negzero(a: Allocator, n: Decimal, show: bool) Allocator.Error!Decimal {
    return if (!show and D.isZero(n) and D.isNegative(n)) D.abs(a, n) else n;
}

/// Adjust a decimal with rounding and digit options (`adjustNumber`).
pub fn adjustNumber(a: Allocator, num: Decimal, o: DecimalAdjustOptions) Allocator.Error!Decimal {
    var ctx = NumberContext.init(opts.numberOptions(o), o.round orelse .half_even, false, false, -1);
    ctx.setPattern(try getNumberPattern(a, "0", false), false);
    return ctx.adjust(a, num, false);
}

/// Currency symbol, falling back to the code itself for valid codes without a symbol. `alt` is
/// 'none' or 'narrow'. (`currencySymbol`)
pub fn currencySymbol(data: *const LocaleData, code: []const u8, alt: []const u8) []const u8 {
    const sym = data.schema.Currencies.symbol;
    const v = sym.getAlt(&data.bundle, &.{ &.{ alt, "none" }, &.{code} });
    if (v.len > 0) return v;
    return if (sym.valid(&.{ &.{"none"}, &.{code} })) code else "";
}

/// Display name of a currency (`currencyDisplayName`).
pub fn currencyDisplayName(data: *const LocaleData, code: []const u8) []const u8 {
    return data.schema.Currencies.displayName.get(&data.bundle, &.{code});
}

/// Pluralized name of a currency, falling back to the display name (`currencyPluralName`).
pub fn currencyPluralName(data: *const LocaleData, code: []const u8, plural: []const u8) []const u8 {
    const c = data.schema.Currencies;
    const v = c.pluralName.get(&data.bundle, &.{ plural, code });
    return if (v.len > 0) v else c.displayName.get(&data.bundle, &.{code});
}

/// The positive or negative form of a number pattern (`getNumberPattern`). The TypeScript
/// caches parsed patterns; parsing is cheap, so the Zig port parses into the arena.
pub fn getNumberPattern(a: Allocator, raw: []const u8, negative: bool) Allocator.Error!NumberPattern {
    return (try number_parsing.parseNumberPatternAlloc(a, raw))[if (negative) 1 else 0];
}

fn cardinal(data: *const LocaleData, n: Decimal) []const u8 {
    return plurals.cardinal(data.bundle.plurals, n, 0).name();
}

fn field(data: *const LocaleData, arrow: anytype) []const u8 {
    return arrow.get(&data.bundle);
}

fn orElse(a: []const u8, b: []const u8) []const u8 {
    return if (a.len > 0) a else b;
}

fn infos(data: *const LocaleData, params: *const NumberParams) struct { latn: *const NumberSystemInfo, info: *const NumberSystemInfo } {
    const ns = data.schema.Numbers.numberSystem;
    const latn = ns.get("latn").?;
    return .{ .latn = latn, .info = ns.get(params.number_system_name) orelse latn };
}

/// Rendered parts and the plural category of the rendered number.
pub const Rendered = struct {
    parts: []Part,
    plural: []const u8,
};

/// Render a decimal in one of the decimal styles (`renderDecimal`).
pub fn renderDecimal(a: Allocator, data: *const LocaleData, renderer: NumberRenderer, n_in: Decimal, options: DecimalFormatOptions, params: *const NumberParams) Allocator.Error!Rendered {
    var n = n_in;
    const style = options.style;
    var result: []Part = undefined;
    var plural: []const u8 = "other";
    const round = options.round orelse .half_even;
    const no = opts.numberOptions(options);

    const in = infos(data, params);
    const latn_info = in.latn;
    const info = in.info;
    const b = &data.bundle;

    const decimal_formats = info.decimalFormats;
    const standard_raw = orElse(field(data, decimal_formats.standard), field(data, latn_info.decimalFormats.standard));

    switch (style) {
        .long, .short => {
            const is_short = style == .short;
            const use_latn = decimal_formats.short.get(b, "other", 4).pattern.len == 0;
            const pattern_impl = if (is_short)
                (if (use_latn) latn_info.decimalFormats.short else decimal_formats.short)
            else
                (if (use_latn) latn_info.decimalFormats.long else decimal_formats.long);

            var ctx = NumberContext.init(no, round, true, false, -1);

            // Adjust the number using the compact pattern and divisor.
            const c = if (divisorSet(options.divisor))
                try setupCompactDivisor(a, data, n, &ctx, standard_raw, options.divisor.?, pattern_impl)
            else
                try setupCompact(a, data, n, &ctx, standard_raw, pattern_impl);
            var q2 = c.q;
            const ndigits = c.ndigits;

            q2 = try negzero(a, q2, options.negative_zero orelse false);

            // Compute the plural category for the final q2.
            plural = cardinal(data, q2);

            // Select the final pluralized compact pattern based on the integer digits of n and
            // the plural category of the rounded / shifted number q2.
            const raw = orElse(orElse(pattern_impl.get(b, plural, ndigits).pattern, pattern_impl.get(b, "other", ndigits).pattern), standard_raw);

            // Re-select pattern as number may have changed sign due to rounding.
            const pattern = try getNumberPattern(a, raw, D.isNegative(q2));
            result = try renderer.render(q2, pattern, "", "", "", ctx.min_int, options.group, 0);
        },
        .percent, .percent_scaled, .permille, .permille_scaled => {
            // Get percent pattern.
            const raw = orElse(field(data, info.percentFormat), field(data, latn_info.percentFormat));
            var pattern = try getNumberPattern(a, raw, D.isNegative(n));

            // Scale the number to a percent or permille form as needed.
            if (style == .percent) {
                n = try D.movePoint(a, n, 2);
            } else if (style == .permille) {
                n = try D.movePoint(a, n, 3);
            }

            // Select percent or permille symbol.
            const symbol = if (style == .percent or style == .percent_scaled) params.symbols.percentSign else params.symbols.perMille;

            // Adjust number using pattern and options, then render.
            var ctx = NumberContext.init(no, round, false, false, -1);
            ctx.setPattern(pattern, false);
            n = try ctx.adjust(a, n, false);
            n = try negzero(a, n, options.negative_zero orelse false);
            plural = cardinal(data, n);

            // Re-select pattern as number may have changed sign due to rounding.
            pattern = try getNumberPattern(a, raw, D.isNegative(n));
            result = try renderer.render(n, pattern, "", symbol, "", ctx.min_int, options.group, 0);
        },
        .decimal => {
            // Get decimal pattern.
            var pattern = try getNumberPattern(a, standard_raw, D.isNegative(n));

            // Adjust number using pattern and options, then render.
            var ctx = NumberContext.init(no, round, false, false, -1);
            ctx.setPattern(pattern, false);
            n = try ctx.adjust(a, n, false);
            n = try negzero(a, n, options.negative_zero orelse false);
            plural = cardinal(data, n);

            // Re-select pattern as number may have changed sign due to rounding.
            pattern = try getNumberPattern(a, standard_raw, D.isNegative(n));
            result = try renderer.render(n, pattern, "", "", "", ctx.min_int, options.group, 0);
        },
        .scientific => {
            var ctx = NumberContext.init(no, round, false, true, -1);
            const format = orElse(field(data, info.scientificFormat), field(data, latn_info.scientificFormat));
            var pattern = try getNumberPattern(a, format, D.isNegative(n));

            ctx.setPattern(pattern, true);
            n = try ctx.adjust(a, n, true);
            n = try negzero(a, n, if (options.negative_zero) |z| z else true);
            pattern = try getNumberPattern(a, format, D.isNegative(n));
            // Split number into coefficient and exponent
            const sci = try D.scientific(a, n, ctx.min_int);
            const adjcoeff = try ctx.adjust(a, sci.coefficient, true);
            result = try renderer.render(adjcoeff, pattern, "", "", "", 1, false, sci.exponent);
        },
    }
    return .{ .parts = result, .plural = plural };
}

fn divisorSet(d: ?f64) bool {
    const v = d orelse return false;
    return v != 0 and !std.math.isNan(v);
}

/// Render a currency value (`renderCurrency`).
pub fn renderCurrency(a: Allocator, data: *const LocaleData, renderer: NumberRenderer, n_in: Decimal, code: []const u8, options: CurrencyFormatOptions, params: *const NumberParams) Allocator.Error![]Part {
    var n = n_in;
    const fractions = util.getCurrencyFractions(code);
    const round = options.round orelse .half_even;
    const no = opts.numberOptions(options);
    const b = &data.bundle;

    if (options.cash and fractions.cash_rounding > 1) {
        // Simple cash rounding to nearest "cash digits" increment
        const cr = try D.fromInt(a, fractions.cash_rounding);
        n = try D.divide(a, n, cr, .{});
        n = try D.setScale(a, n, fractions.cash_digits, round);
        n = try D.multiply(a, n, cr, .{});
    }

    // TODO: display context support
    const width: []const u8 = if (options.symbol_width == .narrow) "narrow" else "none";
    const style = options.style;

    const in = infos(data, params);
    const latn_info = in.latn;
    const info = in.info;

    const currency_formats = info.currencyFormats;
    const standard_raw = orElse(field(data, currency_formats.standard), field(data, latn_info.decimalFormats.standard));

    // Some locales have a special decimal symbol for certain currencies, e.g. pt-PT and PTE
    const decimal = data.schema.Currencies.decimal.get(b, &.{code});
    const digits: i64 = fractions.digits;

    switch (style) {
        .code, .name => {
            const raw = orElse(field(data, info.decimalFormats.standard), field(data, latn_info.decimalFormats.standard));
            var pattern = try getNumberPattern(a, raw, D.isNegative(n));

            // Adjust number using pattern and options, then render.
            var ctx = NumberContext.init(no, round, false, false, digits);
            ctx.setPattern(pattern, false);
            n = try ctx.adjust(a, n, false);
            n = try negzero(a, n, false);

            // Re-select pattern as number may have changed sign due to rounding.
            pattern = try getNumberPattern(a, raw, D.isNegative(n));
            const num = try renderer.render(n, pattern, "", "", decimal, ctx.min_int, options.group, 0);

            // Compute plural category and select pluralized unit.
            const plural = cardinal(data, n);
            const unit = if (style == .code) code else currencyPluralName(data, code, plural);

            // Wrap number and unit together.
            const keys: []const []const []const u8 = &.{&.{ plural, "other" }};
            const unit_wrapper = orElse(currency_formats.unitPattern.getAlt(b, keys), latn_info.currencyFormats.unitPattern.getAlt(b, keys));
            return renderer.wrap(unit_wrapper, &.{ num, try renderer.make("unit", unit) });
        },
        .short => {
            // The extra complexity here is to deal with rounding up and selecting the correct
            // pluralized pattern for the final rounded form.
            const pattern_impl = currency_formats.short;

            var ctx = NumberContext.init(no, round, true, false, digits);
            const symbol = currencySymbol(data, code, width);

            // Adjust the number using the compact pattern and divisor.
            const c = if (divisorSet(options.divisor))
                try setupCompactDivisor(a, data, n, &ctx, standard_raw, options.divisor.?, pattern_impl)
            else
                try setupCompact(a, data, n, &ctx, standard_raw, pattern_impl);
            const q2 = try negzero(a, c.q, false);

            // Compute the plural category for the final q2.
            const plural = cardinal(data, q2);

            // Select the final pluralized compact pattern based on the integer digits of n and
            // the plural category of the rounded / shifted number q2.
            var raw = orElse(orElse(pattern_impl.get(b, plural, c.ndigits).pattern, pattern_impl.get(b, "other", c.ndigits).pattern), standard_raw);
            if (std.mem.eql(u8, raw, "0")) raw = standard_raw;

            const pattern = try getNumberPattern(a, raw, D.isNegative(q2));
            return renderer.render(q2, pattern, symbol, "", decimal, ctx.min_int, options.group, 0);
        },
        .accounting, .symbol => {
            // Select standard or accounting pattern based on style.
            var raw = field(data, if (style == .symbol) currency_formats.standard else currency_formats.accounting);
            if (raw.len == 0) {
                raw = field(data, if (style == .symbol) latn_info.currencyFormats.standard else latn_info.currencyFormats.accounting);
            }
            var pattern = try getNumberPattern(a, raw, D.isNegative(n));

            // Adjust number using pattern and options, then render.
            var ctx = NumberContext.init(no, round, false, false, digits);
            ctx.setPattern(pattern, false);
            n = try ctx.adjust(a, n, false);
            n = try negzero(a, n, false);

            // Re-select pattern as number may have changed sign due to rounding.
            pattern = try getNumberPattern(a, raw, D.isNegative(n));
            const symbol = currencySymbol(data, code, width);
            return renderer.render(n, pattern, symbol, "", decimal, ctx.min_int, options.group, 0);
        },
    }
}

const Compact = struct { q: Decimal, ndigits: f64 };

/// Setup for a compact pattern. Returns the adjusted number and digits for selecting the
/// pluralized pattern.
///
/// The extra complexity here is to deal with rounding up and selecting the correct pluralized
/// pattern for the final rounded form.
fn setupCompact(a: Allocator, data: *const LocaleData, n: Decimal, ctx: *NumberContext, standard_raw: []const u8, pattern_impl: DigitsArrow) Allocator.Error!Compact {
    const b = &data.bundle;
    // Select the correct divisor based on the number of integer digits in n.
    var negative = D.isNegative(n);
    var ndigits = D.integerDigits(n);

    // Select the initial compact pattern based on the integer digits of n. The plural category
    // doesn't matter until the final pattern is selected.
    var dv = pattern_impl.get(b, "other", @floatFromInt(ndigits));
    const ndivisor = dv.divisor;
    var pattern = try getCompactPattern(a, dv.pattern, standard_raw, negative);

    const frac_digits: i64 = if (ctx.use_significant) -1 else 0;

    // Move the decimal point of n, producing q1. We always strip trailing zeros on compact
    // patterns.
    var q1 = n;
    if (ndivisor > 0) q1 = try D.movePoint(a, q1, -ndivisor);

    // Adjust q1 using the compact pattern's parameters, to produce q2.
    const q1digits = D.integerDigits(q1);
    ctx.setCompact(pattern, q1digits, frac_digits);

    var q2 = try ctx.adjust(a, q1, false);
    const q2digits = D.integerDigits(q2);
    negative = D.isNegative(q2);

    // Check if the number rounded up, adding another integer digit.
    if (q2digits > q1digits) {
        // Select a new divisor and pattern.
        ndigits += 1;

        dv = pattern_impl.get(b, "other", @floatFromInt(ndigits));
        const divisor = dv.divisor;
        pattern = try getCompactPattern(a, dv.pattern, standard_raw, negative);

        // If divisor changed we need to divide and adjust again. We don't divide, we just move
        // the decimal point, since our Decimal type uses a radix that is a power of 10.
        // Otherwise q2 is ready for formatting.
        if (divisor > ndivisor) {
            // We shift right before we move the decimal point. This triggers rounding of the
            // number at its correct scale. Otherwise we would end up with 999,999 becoming
            // 0.999999 and half-even rounding truncating the number to '0M' instead of '1M'.
            q1 = try D.movePoint(a, n, -divisor);
            q1 = try D.shiftright(a, q1, divisor, .half_even);
            ctx.setCompact(pattern, D.integerDigits(q1), frac_digits);
            q2 = try ctx.adjust(a, q1, false);
        }
    }
    return .{ .q = q2, .ndigits = @floatFromInt(ndigits) };
}

/// `Math.log10(divisor) + 1`, exact for powers of ten.
fn divisorDigits(divisor: f64) f64 {
    var p: f64 = 1;
    var k: f64 = 0;
    while (p < divisor and k < 400) : (k += 1) p *= 10;
    if (p == divisor) return k + 1;
    return std.math.log10(divisor) + 1;
}

fn setupCompactDivisor(a: Allocator, data: *const LocaleData, n_in: Decimal, ctx: *NumberContext, standard_raw: []const u8, divisor: f64, pattern_impl: DigitsArrow) Allocator.Error!Compact {
    var n = n_in;
    const negative = D.isNegative(n);
    const ndigits = divisorDigits(divisor);
    // Select compact patterns based on number of digits in divisor
    const dv = pattern_impl.get(&data.bundle, "other", ndigits);
    if (dv.divisor > 0) n = try D.movePoint(a, n, -dv.divisor);

    const pattern = try getCompactPattern(a, dv.pattern, standard_raw, negative);
    const frac_digits: i64 = if (ctx.use_significant) -1 else 0;
    ctx.setCompact(pattern, D.integerDigits(n), frac_digits);

    // Hack to avoid extra leading '0' for certain divisor cases. Unless explicit minimum
    // integers is set in options, we force it to 1 to override the compact pattern.
    const min_int = ctx.options.minimum_integer_digits;
    if (min_int == null or min_int.? < 0) ctx.min_int = 1;
    return .{ .q = try ctx.adjust(a, n, false), .ndigits = ndigits };
}

fn getCompactPattern(a: Allocator, raw: []const u8, standard_raw: []const u8, negative: bool) Allocator.Error!NumberPattern {
    if (raw.len > 0) return getNumberPattern(a, raw, negative);
    // Adjust standard pattern to have same fraction settings as compact
    var pattern = try getNumberPattern(a, standard_raw, negative);
    pattern.min_frac = 0;
    pattern.max_frac = 0;
    return pattern;
}
