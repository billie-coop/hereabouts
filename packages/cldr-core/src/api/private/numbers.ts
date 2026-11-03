import type { NumberSystemInfo, NumberSystemName } from '@phensley/cldr-types';
import type { NumberSystemType } from '../../common/numbers';
import type { NumberingSystem, NumberParams } from '../../common/private';
import { getNumberPattern } from '../../internals/numbers/internal';
import type { LocaleData } from '../../locale-data';
import {
  fieldGet,
  scopeGet,
  vectorExists,
  vectorGet,
  vectorMapping,
} from '../../schema/schema/arrows';
import { decimalNumberingDigits } from '../../systems/numbering/autogen.names';
import { decimalNumberingSystem } from '../../systems/numbering/decimal';

// Per-locale state for number params: the latn system (the fallback for every other system) and
// the params built so far, keyed by real number system name.
interface NumberParamsState {
  readonly latnSystemInfo: NumberSystemInfo;
  readonly latnSystem: NumberingSystem;
  readonly params: Map<string, NumberParams>;
}

const STATE = /*#__PURE__*/ new WeakMap<LocaleData, NumberParamsState>();

const state = (data: LocaleData): NumberParamsState => {
  let s = STATE.get(data);
  if (s === undefined) {
    const latnSystemInfo = scopeGet(data.schema.Numbers.numberSystem, 'latn') as NumberSystemInfo;
    const latnSystem = buildNumberSystem(data, latnSystemInfo, 'latn');
    s = { latnSystemInfo, latnSystem, params: new Map() };
    STATE.set(data, s);
  }
  return s;
};

/**
 * Symbols, digits and grouping for a number system of the locale. The requested system may be a
 * name ('arab') or a category ('native', 'finance', ...); invalid systems fall back to the given
 * default, then the locale's default. Defaults to the locale's 'u-nu' extension.
 *
 * @internal
 */
export const getNumberParams = (
  data: LocaleData,
  numberSystem?: NumberSystemType,
  defaultSystem?: NumberSystemType,
): NumberParams => {
  const st = state(data);

  // Default numbering system for a locale unless explicitly overridden
  // https://www.unicode.org/reports/tr35/tr35-33/tr35-numbers.html#defaultNumberingSystem
  if (!defaultSystem) {
    defaultSystem = 'default';
  }
  if (!numberSystem) {
    numberSystem = data.numberSystem as NumberSystemType;
  }

  let realName: NumberSystemName = select(data, numberSystem);

  // Handle invalid number systems by returning the specified default
  // TODO: include algorithmic number system check
  if (!decimalNumberingDigits[realName]) {
    realName = select(data, defaultSystem);

    // TODO: temporary double-check to default for zh finance until we
    // have rbnf implemented.
    /* istanbul ignore if -- @preserve */
    if (!decimalNumberingDigits[realName]) {
      realName = select(data, 'default');
    }
  }

  let params = st.params.get(realName);
  if (params === undefined) {
    params = build(data, st, realName);
    st.params.set(realName, params);
  }
  return params;
};

const select = (data: LocaleData, numberSystem: NumberSystemType): NumberSystemName => {
  switch (numberSystem) {
    case 'default':
    case 'native':
    case 'finance':
    case 'traditional':
      // Dereference to find real name of number system
      return vectorGet(data.schema.Numbers.numberSystems, data, numberSystem) as NumberSystemName;

    default:
      return numberSystem;
  }
};

const build = (data: LocaleData, st: NumberParamsState, name: NumberSystemName): NumberParams => {
  const { latnSystem, latnSystemInfo } = st;

  const system = name === 'latn' ? latnSystem : buildNumberSystem(data, latnSystemInfo, name);

  const info = scopeGet(data.schema.Numbers.numberSystem, name) || latnSystemInfo;

  const currencySpacing = vectorExists(info.currencyFormats.spacing, data)
    ? vectorMapping(info.currencyFormats.spacing, data)
    : vectorMapping(latnSystemInfo.currencyFormats.spacing, data);

  const { minimumGroupingDigits, primaryGroupingSize, secondaryGroupingSize, symbols } = system;

  return {
    numberSystemName: name,
    system,
    latnSystem,
    digits: makeDigits(name),
    latinDigits: makeDigits('latn'),
    symbols,
    minimumGroupingDigits,
    primaryGroupingSize,
    secondaryGroupingSize,
    currencySpacing,
  };
};

const buildNumberSystem = (
  data: LocaleData,
  latnSystemInfo: NumberSystemInfo,
  name: NumberSystemName,
): NumberingSystem => {
  const numbers = data.schema.Numbers;
  const info = scopeGet(numbers.numberSystem, name) || latnSystemInfo;
  const symbols = vectorExists(info.symbols, data)
    ? vectorMapping(info.symbols, data)
    : vectorMapping(latnSystemInfo.symbols, data);

  const standardRaw =
    fieldGet(info.decimalFormats.standard, data) ||
    fieldGet(latnSystemInfo.decimalFormats.standard, data);

  // Fetch standard pattern to determine grouping digits
  const standard = getNumberPattern(standardRaw, false);
  const minimumGroupingDigits = Number(fieldGet(numbers.minimumGroupingDigits, data));
  return decimalNumberingSystem(
    name,
    decimalNumberingDigits[name],
    symbols,
    minimumGroupingDigits,
    standard.priGroup,
    standard.secGroup,
  );
};

/**
 * The codepoints for most Unicode decimal digit sets are in increasing order.
 * To save space we store the base digit '0' and generate '1'..'9' from it.
 */
const makeDigits = (name: string): string[] => {
  const digits = decimalNumberingDigits[name];
  if (digits.length !== 10) {
    const c = digits[0].charCodeAt(0);
    if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = digits[0].charCodeAt(1);
      /* istanbul ignore else -- @preserve */
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        for (let i = 1; i < 10; i++) {
          const digit = String.fromCharCode(c) + String.fromCharCode(c2 + i);
          digits.push(digit);
        }
      }
    } else {
      for (let i = 1; i < 10; i++) {
        digits.push(String.fromCharCode(c + i));
      }
    }
    decimalNumberingDigits[name] = digits;
  }
  return digits;
};
