import type {
  ContextTransformFieldType,
  CurrencySpacingPattern,
  CurrencySpacingPos,
  NumberSymbolType,
  NumberSystemName,
} from '@phensley/cldr-types';

import type { DateTimeNode } from '../parsing/date';

// TODO: move these

/**
 * @internal
 */
export type CurrencySpacingPatterns = { [Q in CurrencySpacingPattern]: string };

/**
 * @internal
 */
export type CurrencySpacing = { [P in CurrencySpacingPos]: CurrencySpacingPatterns };

/**
 * @internal
 */
export type NumberSymbols = { [P in NumberSymbolType]: string };

/**
 * A decimal numbering system: its digits, symbols and grouping sizes. Format numbers with it
 * using `numberingFormatString`.
 *
 * @internal
 */
export interface NumberingSystem {
  readonly name: string;
  readonly digits: string[];
  readonly symbols: NumberSymbols;
  readonly minimumGroupingDigits: number;
  readonly primaryGroupingSize: number;
  readonly secondaryGroupingSize: number;
}

/**
 * @internal
 */
export type ContextTransformInfo = {
  [x in ContextTransformFieldType]: string;
};

/**
 * @internal
 */
export interface NumberParams {
  numberSystemName: NumberSystemName;
  system: NumberingSystem;
  latnSystem: NumberingSystem;
  digits: string[];
  latinDigits: string[];
  symbols: NumberSymbols;
  minimumGroupingDigits: number;
  primaryGroupingSize: number;
  secondaryGroupingSize: number;
  currencySpacing: CurrencySpacing;
}

/**
 * @internal
 */
export interface DateFormatRequest {
  wrapper: string;
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
  params: NumberParams;
}

/**
 * @internal
 */
export interface DateIntervalFormatRequest {
  date?: readonly DateTimeNode[];
  range?: readonly DateTimeNode[];
  skeleton?: string;
  params: NumberParams;

  // Wrapper for fallback
  wrapper: string;
}
