import {
  type DecimalArg,
  DecimalConstants,
  decimal,
  type Rational,
  rational,
  rationalAdd,
  rationalCompare,
  rationalDivide,
  rationalInverse,
  rationalMultiply,
  rationalNegate,
  rationalSubtract,
  rationalToDecimal,
  rationalToString,
} from '../src';

const rat = (a: DecimalArg, b: DecimalArg): Rational => rational(a, b);
const parse = (s: string) => rational(s);

test('parsing', () => {
  let r = rational('1 / pi');
  expect(r.numerator).toEqual(DecimalConstants.ONE);
  expect(r.denominator).toBe(DecimalConstants.PI);

  r = rational('1 / e');
  expect(r.numerator).toEqual(DecimalConstants.ONE);
  expect(r.denominator).toBe(DecimalConstants.E);

  r = rational('-17.35e-1');
  expect(r.numerator).toEqual(decimal('-17.35e-1'));

  r = rat('1.5', '2.3');
  expect(r.numerator).toEqual(decimal('1.5'));
  expect(r.denominator).toEqual(decimal('2.3'));

  r = rational(17);
  expect(r.numerator).toEqual(decimal('17'));
  expect(r.denominator).toEqual(DecimalConstants.ONE);
});

test('multiplication', () => {
  expect(rationalMultiply(parse('1 / 5'), '2 / 7')).toEqual(parse('2 / 35'));
});

test('divide', () => {
  expect(rationalDivide(parse('1 / 5'), '2 / 7')).toEqual(parse('7 / 10'));
});

test('add', () => {
  expect(rationalAdd(parse('1 / 5'), '1 / 4')).toEqual(parse('9 / 20'));
  expect(rationalAdd(parse('1 / 5'), 1)).toEqual(parse('6 / 5'));
  expect(
    rationalCompare(rationalAdd(rationalMultiply(parse('273.15'), '9 / 5'), '-459.67'), '32 / 1'),
  ).toEqual(0);
  expect(rationalCompare(rationalAdd(parse('1 / 3'), '1 / 3'), '2 / 3')).toEqual(0);
});

test('subtract', () => {
  expect(rationalSubtract(parse('1 / 5'), '1 / 4')).toEqual(parse('-1 / 20'));
  expect(rationalSubtract(parse('3 / 5'), 1)).toEqual(parse('-2 / 5'));
});

test('negate', () => {
  expect(rationalNegate(parse('3 / 5'))).toEqual(parse('-3 / 5'));
  expect(rationalNegate(parse('-3 / 5'))).toEqual(parse('3 / 5'));
});

test('inverse', () => {
  expect(rationalInverse(parse('1 / 5'))).toEqual(parse('5 / 1'));
});

test('compare', () => {
  expect(rationalCompare(parse('1 / 5'), parse('1 / 5'))).toEqual(0);
  expect(rationalCompare(parse('1 / 5'), parse('1 / 6'))).toEqual(1);
  expect(rationalCompare(parse('.1 / 10'), parse('.2 / 10'))).toEqual(-1);

  expect(rationalCompare(parse('1 / 5'), '.1')).toEqual(1);
  expect(rationalCompare(parse('1 / 5'), 0.1)).toEqual(1);
  expect(rationalCompare(parse('1 / 5'), decimal('0.1'))).toEqual(1);

  expect(rationalCompare(parse('1 / 20'), '.1')).toEqual(-1);
  expect(rationalCompare(parse('1 / 20'), 0.1)).toEqual(-1);
  expect(rationalCompare(parse('1 / 20'), decimal('0.1'))).toEqual(-1);
});

test('coerce', () => {
  expect(rational(15)).toEqual(parse('15 / 1'));
  expect(rational(decimal(15))).toEqual(parse('15 / 1'));
  expect(rational(decimal('15'), decimal('3'))).toEqual(parse('15 / 3'));
  expect(rational(15, 3)).toEqual(parse('15 / 3'));
});

test('to decimal', () => {
  expect(rationalToDecimal(parse('15 / 3'))).toEqual(decimal('5'));
});

test('to string', () => {
  expect(rationalToString(parse('15 / 3'))).toEqual('15 / 3');
});
