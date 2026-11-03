import { messageFormatter } from '../../../../src/core';
import {
  formatMessage,
  type MessageArg,
  messageFormatterToString,
} from '../../../../src/messageformat';
import { generalApi } from '../../_helpers';

const formatters = {
  foo: (args: MessageArg[], options: string[]): string =>
    options[0] === 'upper' ? args[0].toUpperCase() : args[0].toLowerCase(),
};

test('basic formatter', () => {
  const api = generalApi('en');
  const f = messageFormatter(api, { formatters });

  expect(formatMessage(f, '{0}', ['Hello'], {})).toEqual('Hello');
  expect(formatMessage(f, '{0 foo upper}', ['Hello'], {})).toEqual('HELLO');
  expect(formatMessage(f, '{0 foo lower}', ['Hello'], {})).toEqual('hello');

  for (let i = 0; i < 10; i++) {
    expect(formatMessage(f, '{0}', ['Hello'], {})).toEqual('Hello');
  }

  expect(messageFormatterToString(f)).toContain('cached=3');

  expect(formatMessage(f, '{0 plural one {# item} other {# items}}', [0], {})).toEqual('0 items');
  expect(formatMessage(f, '{0 plural one {# item} other {# items}}', [1], {})).toEqual('1 item');
  expect(formatMessage(f, '{0 plural one {# item} other {# items}}', [2], {})).toEqual('2 items');

  expect(messageFormatterToString(f)).toContain('cached=4');
});
