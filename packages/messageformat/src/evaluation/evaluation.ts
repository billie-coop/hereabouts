import { type Decimal, DecimalConstants, decimalCompare, decimalSubtract } from '@phensley/decimal';
import { type PluralRules, pluralCardinal, pluralOrdinal } from '@phensley/plurals';
import {
  type Argument,
  type MessageCode,
  MessageOpType,
  PluralChoiceType,
  PluralNumberType,
} from '../parser';
import type { MessageArg, MessageArgs, MessageNamedArgs } from './args';
import type { MessageArgConverter } from './converter';

/**
 * User-defined message formatter function.
 *
 * @public
 */
export type MessageFormatFunc = (args: MessageArg[], options: string[]) => string;

/**
 * A map of user-defined formatter names to their implementations.
 *
 * @public
 */
export type MessageFormatFuncMap = { [name: string]: MessageFormatFunc };

const get = (key: number | string, args: MessageArgs): MessageArg => {
  const res: MessageArg = args.named[key];
  return res !== undefined ? res : typeof key === 'number' ? args.positional[key] : undefined;
};

/**
 * An argument is "missing" when it was not provided (or provided as null).
 *
 * When a message references a missing argument, ICU passes the argument's
 * reference text through to the output verbatim, e.g. `{0}` or `{name}`.
 * This applies to plain arguments as well as plural/select/selectordinal:
 * the formatter is not evaluated at all. Emitting the reference text (rather
 * than an empty string or `NaN`) surfaces template/argument mismatches.
 */
const missing = (arg: MessageArg): boolean => arg === undefined || arg === null;

/**
 * The literal argument reference text for a missing argument, e.g. `{0}`.
 */
const argRef = (key: Argument): string => `{${key}}`;

// Save a bit of processing of common exact matches
const exact = (n: string): Decimal | undefined =>
  n === '0'
    ? DecimalConstants.ZERO
    : n === '1'
      ? DecimalConstants.ONE
      : n === '2'
        ? DecimalConstants.TWO
        : undefined;

/**
 * Inputs to the evaluation of one message.
 */
interface EvalContext {
  readonly plurals: PluralRules;
  readonly converter: MessageArgConverter;
  readonly formatters: MessageFormatFuncMap;
  readonly args: MessageArgs;
}

/**
 * Evaluates parsed message `code` against a set of positional and named arguments,
 * producing a string. Plural categories are selected using `plurals`, arguments are
 * converted using `converter`, and `formatters` implements the custom formatter names
 * the message was parsed with.
 *
 * @public
 */
export const evaluateMessage = (
  plurals: PluralRules,
  converter: MessageArgConverter,
  formatters: MessageFormatFuncMap,
  code: MessageCode,
  positional: MessageArg[],
  named: MessageNamedArgs = {},
): string =>
  // Concatenate onto '' so the result is always a string, as when 1.x appended to its buffer,
  // even if a custom formatter or converter returns another type.
  '' + evaluate({ plurals, converter, formatters, args: { positional, named } }, code);

const evaluate = (ctx: EvalContext, code: MessageCode, argsub?: MessageArg): string => {
  const args = ctx.args;
  switch (code[0]) {
    case MessageOpType.TEXT:
      return code[1];

    case MessageOpType.BLOCK: {
      let buf = '';
      for (const n of code[1]) {
        buf += evaluate(ctx, n, argsub);
      }
      return buf;
    }

    case MessageOpType.ARG: {
      const arg = get(code[1], args);
      return missing(arg) ? argRef(code[1]) : ctx.converter.asString(arg);
    }

    case MessageOpType.ARGSUB:
      return ctx.converter.asString(argsub);

    case MessageOpType.PLURAL: {
      const arg = get(code[1][0], args);
      if (missing(arg)) {
        return argRef(code[1][0]);
      }
      const offset = code[2];
      const num = ctx.converter.asDecimal(arg);
      argsub = offset ? decimalSubtract(num, offset) : num;
      const category =
        code[3] === PluralNumberType.CARDINAL
          ? pluralCardinal(ctx.plurals, argsub)
          : pluralOrdinal(ctx.plurals, argsub);

      let other: MessageCode | undefined;

      for (const c of code[4]) {
        switch (c[0]) {
          case PluralChoiceType.EXACT: {
            let v = exact(c[1]);
            if (v === undefined) {
              v = ctx.converter.asDecimal(c[1]);
            }
            if (decimalCompare(num, v) === 0) {
              return evaluate(ctx, c[2], num);
            }
            break;
          }

          case PluralChoiceType.CATEGORY:
            if (c[1] === category) {
              return evaluate(ctx, c[2], argsub);
            } else if (c[1] === 'other') {
              // Capture the 'other' as a fallback
              other = c[2];
            }
            break;
        }
      }

      // If no match and 'other' exists, emit that value.
      return other ? evaluate(ctx, other, argsub) : '';
    }

    case MessageOpType.SELECT: {
      const arg = get(code[1][0], args);
      if (missing(arg)) {
        return argRef(code[1][0]);
      }
      const str = ctx.converter.asString(arg);

      let other: MessageCode | undefined;

      for (const c of code[2]) {
        if (c[0] === str) {
          return evaluate(ctx, c[1], arg);
        }

        if (c[0] === 'other') {
          // Capture the 'other' as a fallback
          other = c[1];
        }
      }

      // If no match and 'other' exists, emit that value.
      return other ? evaluate(ctx, other, arg) : '';
    }

    case MessageOpType.SIMPLE: {
      // One or more arguments and zero or more options
      const name = code[1];
      const f = ctx.formatters[name];
      if (f !== undefined) {
        const _args = code[2].map((k) => get(k, args));
        return f(_args, code[3]);
      }
      return '';
    }
  }
  return '';
};
