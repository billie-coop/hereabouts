import type { ContextTransformInfo } from '../../common/private';
import type { LocaleData } from '../../locale-data';
import { vectorMapping } from '../../schema/schema/arrows';

const CONTEXT_TRANSFORMS = /*#__PURE__*/ new WeakMap<LocaleData, ContextTransformInfo>();

/**
 * Context transform flags of the locale (capitalization rules per field).
 *
 * @internal
 */
export const getContextTransformInfo = (data: LocaleData): ContextTransformInfo => {
  let info = CONTEXT_TRANSFORMS.get(data);
  if (info === undefined) {
    info = vectorMapping(data.schema.ContextTransforms.contextTransforms, data);
    CONTEXT_TRANSFORMS.set(data, info);
  }
  return info;
};
