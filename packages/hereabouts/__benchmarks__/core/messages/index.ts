import type { Suite } from 'benchmark';
import {
  buildMessageMatcher,
  createMessageFormatter,
  defaultMessageArgConverter,
  evaluateMessage,
  formatMessage,
  type MessageArg,
  parseMessagePattern,
} from '../../../src/messageformat';
import { getPluralRules } from '../../../src/plurals';
import { makeSuite } from '../../utils/util';

export const messageSuite: Suite = makeSuite('message');

const FORMATTERS = {
  foo: (args: MessageArg[], options: string[]) =>
    options[0] === 'upper' ? args[0].toUpperCase() : args[0].toLowerCase(),
};

const MESSAGE = 'foo bar {0 plural one {# item} other {# items}} {1}';
const MATCHER = buildMessageMatcher(Object.keys(FORMATTERS));
const CODE = parseMessagePattern(MESSAGE, MATCHER);
const CONVERTER = defaultMessageArgConverter;
const FORMATTER = createMessageFormatter({ language: 'en', formatters: FORMATTERS });

const PLURALS = getPluralRules('en');

messageSuite.add('parse', () => {
  parseMessagePattern(MESSAGE, MATCHER);
});

messageSuite.add('eval', () => {
  evaluateMessage(PLURALS, CONVERTER, FORMATTERS, CODE, [12, 'hello']);
});

messageSuite.add('formatter', () => {
  formatMessage(FORMATTER, MESSAGE, [12, 'hello'], {});
});
