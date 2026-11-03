import {
  type Decimal,
  decimal,
  decimalAdd,
  decimalMovePoint,
  decimalSubtract,
  decimalToString,
} from '../../decimal';
import type { Schema } from '../../types';
import {
  type Digits,
  type Field,
  type Instruction,
  type Origin,
  originGetIndex,
  originGetValues,
  type Scope,
  type ScopeMap,
  type Vector,
} from '../schema/instructions';
import { digitsArrow, fieldArrow, scopeArrow, vectorArrow } from '../schema/schema/arrows';
import { leftPad } from '../utils/string';

const time = (n: [number, number]): Decimal =>
  decimalAdd(decimal(n[0]), decimalMovePoint(decimal(n[1]), -9));

const elapsed = (start: [number, number], end: [number, number]): string =>
  decimalToString(decimalMovePoint(decimalSubtract(time(end), time(start)), 6));

/**
 * Builds the schema accessor tree from the schema instructions. Every field, vector and
 * digits block is assigned the next offset(s) into a bundle's string table, in instruction
 * order, so the layout matches the resource packs built from the same config.
 *
 * @internal
 */
export const buildSchema = (origin: Origin, debug: boolean = false): Schema => {
  // Next free offset in the string table.
  let offset = 0;
  const times: [string, string][] = [];

  const construct = (obj: any, inst: Instruction): void => {
    switch (inst.type) {
      case 'digits':
        constructDigits(obj, inst);
        break;
      case 'field':
        constructField(obj, inst);
        break;
      case 'origin':
        constructOrigin(obj, inst);
        break;
      case 'scope':
        constructScope(obj, inst);
        break;
      case 'scopemap':
        constructScopeMap(obj, inst);
        break;
      case 'vector':
        constructVector(obj, inst);
        break;
    }
  };

  const constructDigits = (obj: any, inst: Digits): void => {
    const dim0 = originGetIndex(origin, inst.dim0);
    const start = offset;
    offset += dim0.size * inst.values.length * 2;
    obj[inst.name] = digitsArrow(start, dim0, inst.values);
  };

  const constructField = (obj: any, inst: Field): void => {
    obj[inst.name] = fieldArrow(offset++);
  };

  const constructOrigin = (obj: any, inst: Origin): void => {
    const emit = debug && typeof process !== 'undefined';
    for (const i of inst.block) {
      const start: [number, number] = emit ? process.hrtime() : [0, 0];
      construct(obj, i);
      const end: [number, number] = emit ? process.hrtime() : [0, 0];
      if (debug) {
        times.push([i.identifier, elapsed(start, end)]);
      }
    }
    if (debug) {
      console.log('Scope construct times (microseconds):');
      for (const t of times) {
        console.log(leftPad(t[0], 20), t[1]);
      }
    }
  };

  const constructScope = (obj: any, inst: Scope): void => {
    const curr: any = {};
    obj[inst.identifier] = curr;
    for (const i of inst.block) {
      construct(curr, i);
    }
  };

  const constructScopeMap = (obj: any, inst: ScopeMap): void => {
    const fields = originGetValues(origin, inst.fields);
    const map: any = {};
    for (const field of fields) {
      const child: any = {};
      for (const i of inst.block) {
        construct(child, i);
      }
      map[field] = child;
    }
    obj[inst.name] = scopeArrow(map);
  };

  const constructVector = (obj: any, inst: Vector): void => {
    const dims = inst.dims.map((k) => originGetIndex(origin, k));
    const header = offset++;
    offset += dims.reduce((p, c) => c.size * p, 1);
    obj[inst.name] = vectorArrow(header, dims);
  };

  const schema = {} as any as Schema;
  construct(schema, origin);
  return schema;
};
