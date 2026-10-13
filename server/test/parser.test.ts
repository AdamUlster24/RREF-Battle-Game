import { describe, expect, it } from 'vitest';
import { describeOp } from '../../shared/matrix.js';
import { parseCommand } from '../../shared/parser.js';

/** Parses against a 3-row matrix and reports the operation in standard notation. */
function read(command: string): string {
  const result = parseCommand(command, 3);
  return result.ok ? describeOp(result.op) : `error: ${result.error}`;
}

describe('parseCommand', () => {
  const accepted: [string, string][] = [
    // swaps
    ['R1 <> R2', 'R1 ↔ R2'],
    ['r3<->r1', 'R3 ↔ R1'],
    ['R2 ↔ R3', 'R2 ↔ R3'],
    // scaling
    ['R1 = 5*R1', 'R1 → 5R1'],
    ['R1 = 5R1', 'R1 → 5R1'],
    ['R1 = R1*5', 'R1 → 5R1'],
    ['R1 = R1 * -2', 'R1 → -2R1'],
    ['R1 = -2*R1', 'R1 → -2R1'],
    ['R1 = -R1', 'R1 → -R1'],
    ['R2 = R2/5', 'R2 → (1/5)R2'],
    ['R2 = R2/-4', 'R2 → (-1/4)R2'],
    ['R1 = 21R1/5', 'R1 → (21/5)R1'],
    ['R1 = 21*R1/5', 'R1 → (21/5)R1'],
    ['R1 = R1*(29/5)', 'R1 → (29/5)R1'],
    ['R1 = (29/5)*R1', 'R1 → (29/5)R1'],
    ['R1 = (7/10)R1', 'R1 → (7/10)R1'],
    ['R1 = 7/10R1', 'R1 → (7/10)R1'],
    ['R1 = R1/(29/5)', 'R1 → (5/29)R1'],
    ['R1 = (-3/2)R1', 'R1 → (-3/2)R1'],
    ['R1 = 0.5R1', 'R1 → (1/2)R1'],
    ['R3 = R3 × 2', 'R3 → 2R3'],
    ['R3 = R3 ÷ 2', 'R3 → (1/2)R3'],
    // adding a multiple of another row
    ['R1 = R1 + R2', 'R1 → R1 + R2'],
    ['R1 = R1 + 3R2', 'R1 → R1 + 3R2'],
    ['R1 = R1 + 3*R2', 'R1 → R1 + 3R2'],
    ['R1 = R1 + R2*3', 'R1 → R1 + 3R2'],
    ['R1 = R1 - 2R2', 'R1 → R1 − 2R2'],
    ['R1 = R1 − 2R2', 'R1 → R1 − 2R2'],
    ['R1 = R1 - R3', 'R1 → R1 − R3'],
    ['R1 = R1 + -2R2', 'R1 → R1 − 2R2'],
    ['R1 = R1 - -2R2', 'R1 → R1 + 2R2'],
    ['R1 = 3R2 + R1', 'R1 → R1 + 3R2'],
    ['R1 = -3R2 + R1', 'R1 → R1 − 3R2'],
    ['R1 = R1 - (3/2)R2', 'R1 → R1 − (3/2)R2'],
    ['R1 = R1 + R2*(3/2)', 'R1 → R1 + (3/2)R2'],
    ['R1 = R1 + R2/2', 'R1 → R1 + (1/2)R2'],
    ['R1 = R1 - 5R2/3', 'R1 → R1 − (5/3)R2'],
    // target written last
    ['3*R1 -> R1', 'R1 → 3R1'],
    ['R1 + 2*R2 -> R1', 'R1 → R1 + 2R2'],
    ['R3 - R1 → R3', 'R3 → R3 − R1']
  ];
  it.each(accepted)('reads %s', (command, expected) => {
    expect(read(command)).toBe(expected);
  });

  const rejected: [string, RegExp][] = [
    ['', /Couldn't read/],
    ['hello', /Couldn't read/],
    ['R1', /Couldn't read/],
    ['R1 = ', /Couldn't read/],
    ['R1 = R1 +', /Couldn't read/],
    ['R1 = R1 + 2', /Couldn't read/],
    ['R1 = 2 * 3', /Couldn't read/],
    ['R1 = R1 ^ 2', /Couldn't read/],
    ['R1 = (2/3R1', /Couldn't read/],
    ['R1 = R1/2/3', /Couldn't read/],
    ['R1 <> R1', /itself/],
    ['R1 <> R4', /R4 doesn't exist/],
    ['R0 = 2R0', /R0 doesn't exist/],
    ['R1 = R1 + 2R9', /R9 doesn't exist/],
    ['R1 = 0R1', /by zero/],
    ['R1 = 0*R1', /by zero/],
    ['R1 = R1/0', /divide by zero/],
    ['R1 = (1/0)R1', /divide by zero/],
    ['R1 = R1', /wouldn't change/],
    ['R1 = R1 + 0R2', /wouldn't change/],
    ['R1 = R2', /overwrite R1/],
    ['R1 = 3R2', /overwrite R1/],
    ['R1 = 2R1 + R2', /Keep R1 as it is/],
    ['R1 = R2 - R1', /Keep R1 as it is/],
    ['R1 = R2 + R3', /Keep R1 as it is/],
    ['R1 = R1 + R1', /scale a row/],
    ['R1 = R1 + R2 + R3', /One operation at a time/]
  ];
  it.each(rejected)('rejects %j', (command, reason) => {
    const result = parseCommand(command, 3);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toMatch(reason);
  });

  it('checks row numbers against the size of the matrix', () => {
    expect(parseCommand('R4 = 2R4', 4).ok).toBe(true);
    expect(parseCommand('R4 = 2R4', 3).ok).toBe(false);
  });
});
