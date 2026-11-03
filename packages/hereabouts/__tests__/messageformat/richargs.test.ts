import { decimal } from '../../src/decimal';
import { createMessageFormatter, formatMessage, type MessageArg } from '../../src/messageformat';

// Objects that are not complete Decimal values must be treated like any other unknown object,
// as 1.x did (expected values recorded from 1.x).
const NOT_DECIMALS: any[] = [
  { data: [1], flag: 2 },
  { data: [1], flag: 0 },
  { data: [1], sign: 1, exp: 0, flag: 5 },
  { data: [1.5], sign: 1, exp: 0, flag: 0 },
  { data: ['1'], sign: 1, exp: 0, flag: 0 },
  { data: [1], sign: 2, exp: 0, flag: 0 },
  { data: [1], sign: 1, exp: '0', flag: 0 },
  { data: [1e7], sign: 1, exp: 0, flag: 0 },
  { data: [-1], sign: 1, exp: 0, flag: 0 },
];

test('rich arguments that are not decimals', () => {
  const f = createMessageFormatter({ language: 'en' });
  const fmt = (msg: string, arg: MessageArg) => formatMessage(f, msg, [arg], {});
  for (const arg of NOT_DECIMALS) {
    expect(fmt('<{0}>', arg)).toEqual('<>');
    expect(fmt('{0 plural one {one} other {other:#}}', arg)).toEqual('other:NaN');
    expect(fmt('{0 select 1 {x} other {y}}', arg)).toEqual('y');
  }
});

test('decimal arguments', () => {
  const f = createMessageFormatter({ language: 'en' });
  const fmt = (msg: string, arg: MessageArg) => formatMessage(f, msg, [arg], {});
  expect(fmt('<{0}>', decimal('1.50'))).toEqual('<1.50>');
  expect(fmt('<{0}>', decimal('-infinity'))).toEqual('<-Infinity>');
  expect(fmt('{0 plural one {one} other {other:#}}', decimal('1'))).toEqual('one');
  expect(fmt('{0 select 1 {x} other {y}}', decimal('1'))).toEqual('x');

  // A complete plain Decimal-shaped object is a Decimal (see notes: shape checks).
  expect(fmt('<{0}>', { data: [1], sign: 1, exp: 0, flag: 0 } as any)).toEqual('<1>');
});
