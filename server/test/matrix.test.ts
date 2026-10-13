import { describe, expect, it } from 'vitest';
import { Fraction } from '../../shared/fraction.js';
import { Matrix, describeOp, type RowOp } from '../../shared/matrix.js';

/** A small deterministic generator so failures can be reproduced. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

function randomOp(rng: () => number, rowCount: number): RowOp {
  const a = Math.floor(rng() * rowCount);
  const b = (a + 1 + Math.floor(rng() * (rowCount - 1))) % rowCount;
  // Numerators above every denominator, so the factor is never 0 or 1.
  const factor = Fraction.of(Math.floor(rng() * 9) + 5, Math.floor(rng() * 4) + 1).mul(Fraction.of(rng() < 0.5 ? -1 : 1));
  const kind = Math.floor(rng() * 3);
  if (kind === 0) return { type: 'swap', a, b };
  if (kind === 1) return { type: 'scale', row: a, factor };
  return { type: 'add', target: a, source: b, factor };
}

describe('row operations', () => {
  it('swaps, scales and adds', () => {
    const matrix = Matrix.fromIntegers([
      [1, 2],
      [3, 4]
    ]);
    matrix.apply({ type: 'swap', a: 0, b: 1 });
    expect(matrix.toStrings()).toEqual([['3', '4'], ['1', '2']]);
    matrix.apply({ type: 'scale', row: 0, factor: Fraction.of(1, 3) });
    expect(matrix.toStrings()).toEqual([['1', '4/3'], ['1', '2']]);
    matrix.apply({ type: 'add', target: 1, source: 0, factor: Fraction.of(-1) });
    expect(matrix.toStrings()).toEqual([['1', '4/3'], ['0', '2/3']]);
  });

  it('refuses operations that are not elementary', () => {
    const matrix = Matrix.fromIntegers([
      [1, 2],
      [3, 4]
    ]);
    const illegal: RowOp[] = [
      { type: 'swap', a: 0, b: 0 },
      { type: 'swap', a: 0, b: 2 },
      { type: 'scale', row: 0, factor: Fraction.ZERO },
      { type: 'scale', row: -1, factor: Fraction.of(2) },
      { type: 'add', target: 1, source: 1, factor: Fraction.of(2) },
      { type: 'add', target: 0, source: 1, factor: Fraction.ZERO }
    ];
    for (const op of illegal) {
      expect(() => matrix.apply(op)).toThrow(RangeError);
    }
    expect(matrix.history()).toHaveLength(0);
    expect(matrix.toStrings()).toEqual([['1', '2'], ['3', '4']]);
  });

  it('undoes any sequence of operations exactly', () => {
    const rng = seeded(7);
    for (let trial = 0; trial < 50; trial++) {
      const matrix = Matrix.random(4, 4, { rng });
      const original = matrix.clone();
      for (let i = 0; i < 12; i++) {
        matrix.apply(randomOp(rng, 4));
      }
      while (matrix.undo()) {
        // keep going until the history is empty
      }
      expect(matrix.equals(original)).toBe(true);
    }
    expect(Matrix.fromIntegers([[1]]).undo()).toBe(false);
  });

  it('describes operations in textbook notation', () => {
    expect(describeOp({ type: 'swap', a: 0, b: 2 })).toBe('R1 ↔ R3');
    expect(describeOp({ type: 'scale', row: 1, factor: Fraction.of(-1) })).toBe('R2 → -R2');
    expect(describeOp({ type: 'scale', row: 1, factor: Fraction.of(1, 3) })).toBe('R2 → (1/3)R2');
    expect(describeOp({ type: 'add', target: 0, source: 1, factor: Fraction.ONE })).toBe('R1 → R1 + R2');
    expect(describeOp({ type: 'add', target: 0, source: 1, factor: Fraction.of(-3, 2) })).toBe('R1 → R1 − (3/2)R2');
  });
});

describe('isRref', () => {
  const cases: [string, number[][], boolean][] = [
    ['identity', [[1, 0], [0, 1]], true],
    ['free column', [[1, 2, 0], [0, 0, 1]], true],
    ['zero matrix', [[0, 0], [0, 0]], true],
    ['zero rows at the bottom', [[1, 0, 3], [0, 1, 2], [0, 0, 0]], true],
    ['leading entry not 1', [[2, 0], [0, 1]], false],
    ['entry above a pivot', [[1, 1], [0, 1]], false],
    ['entry below a pivot', [[1, 0], [1, 1]], false],
    ['pivots out of order', [[0, 1], [1, 0]], false],
    ['zero row above a non-zero row', [[1, 0], [0, 0], [0, 1]], false]
  ];
  it.each(cases)('%s', (_name, rows, expected) => {
    expect(Matrix.fromIntegers(rows).isRref()).toBe(expected);
  });
});

describe('reduced', () => {
  it('row-reduces a worked example', () => {
    const matrix = Matrix.fromIntegers([
      [2, 1, -1, 8],
      [-3, -1, 2, -11],
      [-2, 1, 2, -3]
    ]);
    expect(matrix.reduced().toStrings()).toEqual([
      ['1', '0', '0', '2'],
      ['0', '1', '0', '3'],
      ['0', '0', '1', '-1']
    ]);
  });

  it('handles singular matrices', () => {
    const matrix = Matrix.fromIntegers([
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 1]
    ]);
    expect(matrix.reduced().toStrings()).toEqual([
      ['1', '0', '-1'],
      ['0', '1', '2'],
      ['0', '0', '0']
    ]);
  });

  it('always lands in RREF, and row operations never change the answer', () => {
    const rng = seeded(42);
    for (let trial = 0; trial < 100; trial++) {
      const matrix = Matrix.random(3 + (trial % 3), 3 + (trial % 3), { rng });
      const answer = matrix.reduced();
      expect(answer.isRref()).toBe(true);
      for (let i = 0; i < 10; i++) {
        matrix.apply(randomOp(rng, matrix.rowCount));
      }
      expect(matrix.reduced().equals(answer)).toBe(true);
    }
  });
});

describe('Matrix.random', () => {
  it('stays in range and never deals a matrix that is already solved', () => {
    // An rng stuck on the middle value yields the zero matrix, which is in RREF,
    // so the generator has to draw again.
    const draws = [...Array(9).fill(0.5), ...Array(9).fill(0.99)];
    const matrix = Matrix.random(3, 3, { maxAbs: 9, rng: () => draws.shift() ?? 0.99 });
    expect(matrix.toStrings().flat()).toEqual(Array(9).fill('9'));

    const rng = seeded(3);
    for (let trial = 0; trial < 50; trial++) {
      const dealt = Matrix.random(3, 3, { maxAbs: 5, rng });
      expect(dealt.isRref()).toBe(false);
      expect(dealt.toStrings().flat().every(value => Math.abs(Number(value)) <= 5)).toBe(true);
    }
  });

  it('rejects ragged or empty input', () => {
    expect(() => new Matrix([])).toThrow(RangeError);
    expect(() => Matrix.fromIntegers([[1, 2], [3]])).toThrow(RangeError);
  });
});

describe('reduced history', () => {
  it('records steps that reproduce the answer when replayed', () => {
    const rng = seeded(11);
    for (let trial = 0; trial < 50; trial++) {
      const matrix = Matrix.random(4, 4, { rng });
      const answer = matrix.reduced();
      for (const op of answer.history()) {
        matrix.apply(op);
      }
      expect(matrix.equals(answer)).toBe(true);
    }
  });
});
