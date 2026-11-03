import {
  numberContext,
  numberContextAdjust,
  numberContextSetCompact,
  numberContextSetPattern,
} from '../../../../src/core/internals/numbers/context';
import { parseNumberPattern } from '../../../../src/core/parsing/number';
import { type Decimal, decimal } from '../../../../src/decimal';

test('standard', () => {
  const pat = parseNumberPattern('#,##0.00#')[0];
  const ctx = numberContext({ minimumSignificantDigits: 1 }, 'half-even', false, false);
  numberContextSetPattern(ctx, pat, false);

  expect(ctx.minInt).toEqual(1);
  expect(ctx.minFrac).toEqual(2);
  expect(ctx.maxFrac).toEqual(3);
  expect(ctx.minSig).toEqual(1);
  expect(ctx.maxSig).toEqual(-1);
  expect(ctx.useSignificant).toEqual(true);

  let n: Decimal;

  n = numberContextAdjust(ctx, decimal('0.1000'));
  expect(n).toEqual(decimal('0.1'));

  n = numberContextAdjust(ctx, decimal('0.00000'));
  expect(n).toEqual(decimal('0'));
});

test('standard min/max significant', () => {
  const pat = parseNumberPattern('#,##0.00#')[0];
  const ctx = numberContext(
    {
      minimumSignificantDigits: 2,
      maximumSignificantDigits: 1,
    },
    'half-even',
    false,
    false,
  );
  numberContextSetPattern(ctx, pat, false);

  expect(ctx.minInt).toEqual(1);
  expect(ctx.minFrac).toEqual(2);
  expect(ctx.maxFrac).toEqual(3);
  expect(ctx.minSig).toEqual(2);
  expect(ctx.maxSig).toEqual(2);
  expect(ctx.useSignificant).toEqual(true);
});

test('compact', () => {
  const pat = parseNumberPattern('#,##0.00#')[0];
  const ctx = numberContext({ minimumSignificantDigits: 2 }, 'half-even', true, false);
  numberContextSetCompact(ctx, pat, 1, -1, 0);

  expect(ctx.minFrac).toEqual(0);
  expect(ctx.maxFrac).toEqual(0);
  expect(ctx.maxSig).toEqual(2);
  expect(ctx.minSig).toEqual(2);
  expect(ctx.useSignificant).toEqual(true);
});
