//! A cursor over ASCII text, for the ISO 8601 parsers. Each parser follows its TypeScript
//! regular expression; `\d` there is an ASCII digit, as here.

pub const Scanner = struct {
    s: []const u8,
    i: usize = 0,

    pub fn done(self: *const Scanner) bool {
        return self.i == self.s.len;
    }

    pub fn peek(self: *const Scanner) ?u8 {
        return if (self.i < self.s.len) self.s[self.i] else null;
    }

    /// Consume `c` if it is next.
    pub fn eat(self: *Scanner, c: u8) bool {
        if (self.peek() == c) {
            self.i += 1;
            return true;
        }
        return false;
    }

    /// Consume any one of `cs` if it is next, returning it.
    pub fn eatAny(self: *Scanner, cs: []const u8) ?u8 {
        const c = self.peek() orelse return null;
        for (cs) |x| {
            if (c == x) {
                self.i += 1;
                return c;
            }
        }
        return null;
    }

    /// Exactly `n` digits, as a number.
    pub fn digits(self: *Scanner, n: usize) ?i64 {
        if (self.s.len - self.i < n) return null;
        var v: i64 = 0;
        for (self.s[self.i .. self.i + n]) |c| {
            if (c < '0' or c > '9') return null;
            v = v * 10 + (c - '0');
        }
        self.i += n;
        return v;
    }

    /// All the digits from here (possibly none).
    pub fn run(self: *Scanner) []const u8 {
        const start = self.i;
        while (self.peek()) |c| {
            if (c < '0' or c > '9') break;
            self.i += 1;
        }
        return self.s[start..self.i];
    }

    /// A year: `[+-]\d{6}|\d{4}`, rejecting `-000000`.
    pub fn year(self: *Scanner) ?i64 {
        if (self.eatAny("+-")) |sign| {
            const y = self.digits(6) orelse return null;
            if (sign == '-' and y == 0) return null;
            return if (sign == '-') -y else y;
        }
        return self.digits(4);
    }
};

/// Milliseconds from 1 to 9 fraction digits, truncated: `Number((f + '00').slice(0, 3))`.
pub fn fractionMillis(f: []const u8) i64 {
    var v: i64 = 0;
    for (0..3) |k| v = v * 10 + (if (k < f.len) f[k] - '0' else 0);
    return v;
}
