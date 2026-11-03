import type { ContextTransformFieldType, ListPatternPositionType } from '@phensley/cldr-types';
import { keyIndex } from '../instructions';
import { ContextTransformFieldValues } from './autogen.context';

/**
 * @public
 */
export const ListPatternPositionIndex = /*#__PURE__*/ keyIndex<ListPatternPositionType>([
  'start',
  'middle',
  'end',
  'two',
]);

/**
 * @public
 */
export const ContextTransformFieldIndex = /*#__PURE__*/ keyIndex<ContextTransformFieldType>(
  ContextTransformFieldValues,
);
