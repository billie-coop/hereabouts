// 2.x: arbitrary-precision arithmetic only, from @billie-coop/hereabouts/decimal.
import {
  decimal,
  decimalAdd,
  decimalMultiply,
  decimalToString,
} from '@billie-coop/hereabouts/decimal';

const total = decimalAdd(decimalMultiply(decimal('19.99'), 3), '0.03');
console.log(decimalToString(total));
