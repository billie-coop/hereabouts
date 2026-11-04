//! Number formatting parameters for one format call (`internals/numbers/context.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const Decimal = D.Decimal;
const NumberFormatOptions = @import("../../common/numbers.zig").NumberFormatOptions;
const NumberPattern = @import("../../parsing/number.zig").NumberPattern;

/// Number formatting parameters for a single format call, combining user-supplied options with
/// defaults based on modes and the number pattern. The functions below update it in place.
pub const NumberContext = struct {
    options: NumberFormatOptions,
    rounding_mode: D.RoundingMode,
    use_significant: bool,
    min_int: i64,
    max_frac: i64 = -1,
    min_frac: i64 = -1,
    max_sig: i64 = -1,
    min_sig: i64 = -1,
    currency_digits: i64,

    pub fn init(options: NumberFormatOptions, rounding_mode: D.RoundingMode, compact: bool, scientific: bool, currency_digits: i64) NumberContext {
        const o = options;
        // Determine if we should use default or significant digit modes. If we're in compact
        // mode we will use significant digits unless any fraction option is set. Otherwise we
        // use significant digits if any significant digit option is set.
        const opt_frac = o.minimum_fraction_digits != null or o.maximum_fraction_digits != null;
        const opt_sig = o.minimum_significant_digits != null or o.maximum_significant_digits != null;
        const mi = o.minimum_integer_digits orelse 0;
        return .{
            .options = o,
            .rounding_mode = rounding_mode,
            .use_significant = (scientific and !opt_frac) or (compact and !opt_frac) or opt_sig,
            .min_int = if (mi == 0) -1 else mi,
            .currency_digits = currency_digits,
        };
    }

    /// Set a pattern. The 'scientific' flag indicates the pattern uses significant digits,
    /// which we will copy from the pattern's min/max fractions. (`numberContextSetPattern`)
    pub fn setPattern(self: *NumberContext, pattern: NumberPattern, scientific: bool) void {
        self.setPatternImpl(pattern, scientific, -1, -1, -1);
    }

    /// Set a compact pattern (`numberContextSetCompact`).
    pub fn setCompact(self: *NumberContext, pattern: NumberPattern, integer_digits: i64, max_frac_digits: i64) void {
        var max_sig_digits = @max(pattern.min_int, integer_digits);
        if (integer_digits == 1) max_sig_digits += 1;
        self.setPatternImpl(pattern, false, max_sig_digits, 1, max_frac_digits);
    }

    /// Adjust the scale of the number using the resolved parameters (`numberContextAdjust`).
    /// Allocates in `a` without freeing (use an arena).
    pub fn adjust(self: *NumberContext, a: Allocator, n_in: Decimal, scientific: bool) Allocator.Error!Decimal {
        var n = n_in;
        if (self.use_significant and scientific) {
            if (self.min_sig <= 0) self.min_sig = 1;
            if (self.max_sig <= 0) self.max_sig = 1;
        }

        if (self.use_significant and self.min_sig >= 0) {
            // By default we assume maximum significant digits will equal the number's default
            // precision. So if the option's maxSig == -1 we ignore reducing the precision.
            if (self.max_sig != -1 and D.precision(n) > self.max_sig) {
                // Scale the number to have at most the maximum significant digits.
                const scale = self.max_sig - D.precision(n) + D.scale(n);
                n = try D.setScale(a, n, scale, self.rounding_mode);
            }
            n = try D.stripTrailingZeros(a, n);

            // scale the number to have at least the minimum significant digits
            const precision = D.precision(n);
            if (precision < self.min_sig) {
                const scale = self.min_sig - precision + D.scale(n);
                n = try D.setScale(a, n, scale, self.rounding_mode);
            }
        } else {
            // Precise control over number of integer and decimal digits to include, e.g. when
            // formatting exact currency values.
            const scale = @max(self.min_frac, @min(D.scale(n), self.max_frac));
            n = try D.setScale(a, n, scale, self.rounding_mode);
            n = try D.stripTrailingZeros(a, n);

            // If user hasn't requested minimum fraction digits, and requested to trim zero
            // fractions, and the number is an integer, force it to render as a whole number.
            const mfd = self.options.minimum_fraction_digits orelse 0;
            if (self.options.trim_zero_fractions and mfd == 0 and D.isInteger(n)) {
                // Trim zeros when whole number display is possible
                n = try D.setScale(a, n, 0, self.rounding_mode);
            } else if (D.scale(n) < self.min_frac) {
                // Ensure minimum fraction digits is met.
                n = try D.setScale(a, n, self.min_frac, self.rounding_mode);
            }
        }
        return n;
    }

    /// Set context parameters from options, pattern and significant digit arguments.
    fn setPatternImpl(self: *NumberContext, pattern: NumberPattern, scientific: bool, max_sig_digits: i64, min_sig_digits: i64, max_frac_digits: i64) void {
        const o = self.options;

        // If minInt is not specified in options, always copy from pattern
        if (o.minimum_integer_digits == null) self.min_int = pattern.min_int;
        self.min_frac = if (self.currency_digits == -1) pattern.min_frac else self.currency_digits;
        self.max_frac = if (self.currency_digits == -1) pattern.max_frac else self.currency_digits;

        const min_frac = o.minimum_fraction_digits;
        var max_frac = o.maximum_fraction_digits;
        if (min_frac == null and max_frac == null and max_frac_digits > -1) {
            max_frac = max_frac_digits;
        }

        if (max_frac) |mf| {
            if (mf > -1) self.max_frac = mf;
        }

        if (min_frac) |nf| {
            if (nf > -1) {
                self.min_frac = if (max_frac != null and max_frac.? > -1) (if (max_frac.? < nf) max_frac.? else nf) else nf;
                if (self.min_frac > self.max_frac) self.max_frac = self.min_frac;
            }
        }

        if (max_frac) |mf| {
            if (mf > -1) {
                if (self.max_frac < self.min_frac or self.min_frac == -1) self.min_frac = self.max_frac;
            }
        }

        if (self.use_significant or scientific) {
            const opt_min_sig = o.minimum_significant_digits;
            const opt_max_sig = o.maximum_significant_digits;

            var min_sig = if (scientific) opt_min_sig orelse pattern.min_frac else opt_min_sig orelse min_sig_digits;
            var max_sig = if (scientific) opt_max_sig orelse pattern.max_frac else opt_max_sig orelse max_sig_digits;

            if (min_sig != -1 and max_sig != -1 and min_sig > max_sig) max_sig = min_sig;
            if (min_sig == -1) min_sig = max_sig;
            self.min_sig = min_sig;
            self.max_sig = max_sig;
        } else {
            self.max_sig = -1;
            self.min_sig = -1;
        }
    }
};
