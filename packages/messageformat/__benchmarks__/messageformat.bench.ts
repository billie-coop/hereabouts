import { getPluralRules } from '@phensley/plurals';
import { bench, describe } from 'vitest';
import {
  buildMessageMatcher,
  createMessageFormatter,
  defaultMessageArgConverter,
  evaluateMessage,
  formatMessage,
  type MessageArg,
  parseMessagePattern,
} from '../src';

const FORMATTERS = {
  foo: (args: MessageArg[], options: string[]) =>
    options[0] === 'upper' ? String(args[0]).toUpperCase() : String(args[0]).toLowerCase(),
};

const MESSAGE = 'foo bar {0 plural one {# item} other {# items}} {1}';
const NESTED =
  '{host} {count select 0 {has no guests} other {invited {count plural one {one guest} other {# guests}}}} ' +
  'to {when} and said {msg foo upper}';
const MATCHER = buildMessageMatcher(Object.keys(FORMATTERS));
const CODE = parseMessagePattern(MESSAGE, MATCHER);
const PLURALS = getPluralRules('en');
const FORMATTER = createMessageFormatter({ language: 'en', formatters: FORMATTERS });

let i = 0;

describe('messageformat', () => {
  bench('parse', () => {
    parseMessagePattern(MESSAGE, MATCHER);
  });
  bench('evaluate parsed', () => {
    evaluateMessage(PLURALS, defaultMessageArgConverter, FORMATTERS, CODE, [i++ & 15, 'hello'], {});
  });
  bench('formatMessage (cached parse)', () => {
    formatMessage(FORMATTER, MESSAGE, [i++ & 15, 'hello'], {});
  });
  bench('formatMessage nested select/plural', () => {
    formatMessage(FORMATTER, NESTED, [], {
      host: 'Ana',
      count: i++ & 3,
      when: 'Tuesday',
      msg: 'hi',
    });
  });
});
