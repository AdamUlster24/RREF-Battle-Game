import type { RowOp } from '../../shared/matrix.js';

/** Types out an operation the way a player would. */
export function toCommand(op: RowOp): string {
  switch (op.type) {
    case 'swap':
      return `R${op.a + 1} <> R${op.b + 1}`;
    case 'scale':
      return `R${op.row + 1} = (${op.factor})R${op.row + 1}`;
    case 'add':
      return `R${op.target + 1} = R${op.target + 1} + (${op.factor})R${op.source + 1}`;
  }
}
