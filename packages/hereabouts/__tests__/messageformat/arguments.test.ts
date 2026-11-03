import { DecimalConstants, decimal } from '../../src/decimal';
import { defaultMessageArgConverter, type MessageArg } from '../../src/messageformat';

const CONVERTER = defaultMessageArgConverter;

const asstring = (arg: MessageArg | undefined) => CONVERTER.asString(arg);
const asdecimal = (arg: MessageArg | undefined) => CONVERTER.asDecimal(arg);

test('strings', () => {
  expect(asstring(false)).toEqual('false');
  expect(asstring(true)).toEqual('true');
  expect(asstring(1.2)).toEqual('1.2');
  expect(asstring(decimal('3.14159'))).toEqual('3.14159');
  expect(asstring({ foo: 'foo', bar: 'bar' })).toEqual('');
});

test('decimals', () => {
  expect(asdecimal(false)).toEqual(decimal(0));
  expect(asdecimal(true)).toEqual(decimal(1));
  expect(asdecimal(1.4)).toEqual(decimal('1.4'));
  expect(asdecimal('1.4')).toEqual(decimal('1.4'));
  expect(asdecimal(decimal('3.14159'))).toEqual(decimal('3.14159'));
  expect(asdecimal('infinity')).toEqual(DecimalConstants.POSITIVE_INFINITY);
  expect(asdecimal('abc')).toEqual(DecimalConstants.NAN);
  expect(asdecimal({ foo: 'foo', bar: 'bar' })).toEqual(DecimalConstants.NAN);
  expect(asdecimal(new Date())).toEqual(DecimalConstants.NAN);
});
