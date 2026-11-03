// The rule data is generated, shared by every caller and returned by getPluralRules, so every
// level of it is readonly.

export type RangeList = ReadonlyArray<number | Range>;

export interface Range {
  readonly [0]: number;
  readonly [1]: number;
}

export interface Expr {
  readonly [0]: string;
  readonly [1]: number;
  readonly [2]: number;
  readonly [3]: RangeList;
}

export type AndCond = ReadonlyArray<Expr>;

export type OrCond = ReadonlyArray<AndCond>;

/**
 * A plural rule: a category index and the indices of the expressions it ORs/ANDs together.
 *
 * @public
 */
export interface Rule {
  // plural category index
  readonly [0]: number;

  // indices of shared OR conditions
  readonly [1]: ReadonlyArray<ReadonlyArray<number>>;
}

export type RuleMap = { readonly [x: string]: readonly Rule[] };
