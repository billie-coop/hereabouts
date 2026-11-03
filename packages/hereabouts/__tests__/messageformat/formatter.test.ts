import {
  createMessageFormatter,
  formatMessage,
  type MessageArg,
  messageFormatterToString,
} from '../../src/messageformat';

const formatters = {
  foo: (args: MessageArg[], options: string[]): string =>
    options[0] === 'upper' ? args[0].toUpperCase() : args[0].toLowerCase(),
  quux: (_args: MessageArg[], _options: string[]): string => 'quux',
  quuxbar: (_args: MessageArg[], _options: string[]): string => 'quuxbar',
  quuxbaz: (_args: MessageArg[], _options: string[]): string => 'quuxbaz',
};

test('defaults', () => {
  const f = createMessageFormatter();
  expect(formatMessage(f, '{0}', ['Foo'], {})).toEqual('Foo');
});

test('basic formatter', () => {
  const f = createMessageFormatter({ language: 'en', formatters });

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

test('formatter prefixes', () => {
  const f = createMessageFormatter({ language: 'en', formatters });

  expect(formatMessage(f, '{0 quux}', [0], {})).toEqual('quux');
  expect(formatMessage(f, '{0 quuxbar}', [0], {})).toEqual('quuxbar');
  expect(formatMessage(f, '{0 quuxbaz}', [0], {})).toEqual('quuxbaz');
});

test('missing arguments pass through as literal argument reference text', () => {
  const f = createMessageFormatter({ language: 'en' });

  expect(formatMessage(f, '{0}', [], {})).toEqual('{0}');
  expect(formatMessage(f, 'hi {0}!', [], {})).toEqual('hi {0}!');
  expect(formatMessage(f, '{name}', [], {})).toEqual('{name}');
  // plural / selectordinal / select are not evaluated for a missing argument
  expect(formatMessage(f, '{0, plural, other {#}}', [], {})).toEqual('{0}');
  expect(formatMessage(f, '{count, plural, one {# item} other {# items}}', [], {})).toEqual(
    '{count}',
  );
  expect(formatMessage(f, '{0, selectordinal, one {#st} other {#th}}', [], {})).toEqual('{0}');
  expect(formatMessage(f, '{name, select, female {her} other {their}}', [], {})).toEqual('{name}');
});
