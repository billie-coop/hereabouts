// 2.x: arbitrary-precision arithmetic only, from @phensley/decimal.
import { decimal, decimalAdd, decimalMultiply, decimalToString } from '@phensley/decimal';

const total = decimalAdd(decimalMultiply(decimal('19.99'), 3), '0.03');
console.log(decimalToString(total));
