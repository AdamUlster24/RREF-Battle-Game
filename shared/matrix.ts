import { Fraction } from './fraction.js';

/** The three elementary row operations. Row indices are zero-based. */
export type RowOp =
  | { type: 'swap'; a: number; b: number }
  | { type: 'scale'; row: number; factor: Fraction }
  | { type: 'add'; target: number; source: number; factor: Fraction };

/** Why `op` is not a legal elementary operation on `rowCount` rows, or null if it is. */
export function validateOp(op: RowOp, rowCount: number): string | null {
  const rows = op.type === 'swap' ? [op.a, op.b] : op.type === 'scale' ? [op.row] : [op.target, op.source];
  for (const row of rows) {
    if (!Number.isInteger(row) || row < 0 || row >= rowCount) {
      return `Row R${row + 1} doesn't exist. This matrix has ${rowCount} rows.`;
    }
  }
  switch (op.type) {
    case 'swap':
      return op.a === op.b ? "Can't swap a row with itself." : null;
    case 'scale':
      if (op.factor.isZero()) return "Can't multiply a row by zero.";
      return op.factor.isOne() ? "Multiplying by 1 wouldn't change anything." : null;
    case 'add':
      if (op.target === op.source) return `Use R${op.target + 1} = 2R${op.target + 1} to scale a row.`;
      return op.factor.isZero() ? "Adding zero times a row wouldn't change anything." : null;
  }
}

function invert(op: RowOp): RowOp {
  switch (op.type) {
    case 'swap':
      return op;
    case 'scale':
      return { ...op, factor: op.factor.inverse() };
    case 'add':
      return { ...op, factor: op.factor.neg() };
  }
}

function coefficient(factor: Fraction): string {
  if (factor.isOne()) return '';
  if (factor.neg().isOne()) return '-';
  return factor.isInteger() ? factor.toString() : `(${factor})`;
}

/** Textbook notation for an operation, e.g. "R1 → R1 − (3/2)R2". */
export function describeOp(op: RowOp): string {
  switch (op.type) {
    case 'swap':
      return `R${op.a + 1} ↔ R${op.b + 1}`;
    case 'scale':
      return `R${op.row + 1} → ${coefficient(op.factor)}R${op.row + 1}`;
    case 'add': {
      const sign = op.factor.isNegative() ? '−' : '+';
      const size = op.factor.isNegative() ? op.factor.neg() : op.factor;
      return `R${op.target + 1} → R${op.target + 1} ${sign} ${coefficient(size)}R${op.source + 1}`;
    }
  }
}

export interface RandomMatrixOptions {
  /** Entries are integers in [-maxAbs, maxAbs]. */
  maxAbs?: number;
  rng?: () => number;
}

export class Matrix {
  private rows: Fraction[][];
  private applied: RowOp[] = [];

  constructor(rows: Fraction[][]) {
    const width = rows[0]?.length ?? 0;
    if (rows.length === 0 || width === 0 || rows.some(row => row.length !== width)) {
      throw new RangeError('A matrix needs at least one entry and rows of equal length');
    }
    this.rows = rows.map(row => [...row]);
  }

  static fromIntegers(rows: number[][]): Matrix {
    return new Matrix(rows.map(row => row.map(value => Fraction.of(value))));
  }

  static fromStrings(rows: string[][]): Matrix {
    return new Matrix(rows.map(row => row.map(value => Fraction.parse(value))));
  }

  /** A random integer matrix that still needs work: never one already in RREF. */
  static random(rowCount: number, colCount: number, options: RandomMatrixOptions = {}): Matrix {
    const { maxAbs = 5, rng = Math.random } = options;
    for (;;) {
      const matrix = Matrix.fromIntegers(
        Array.from({ length: rowCount }, () =>
          Array.from({ length: colCount }, () => Math.floor(rng() * (2 * maxAbs + 1)) - maxAbs)
        )
      );
      if (!matrix.isRref()) return matrix;
    }
  }

  get rowCount(): number {
    return this.rows.length;
  }

  get colCount(): number {
    return this.rows[0]!.length;
  }

  /** Applies an operation and records it. Throws if the operation is not legal. */
  apply(op: RowOp): void {
    const problem = validateOp(op, this.rowCount);
    if (problem) {
      throw new RangeError(problem);
    }
    this.perform(op);
    this.applied.push(op);
  }

  /** Reverts the most recent operation. Returns false when there is nothing to undo. */
  undo(): boolean {
    const last = this.applied.pop();
    if (!last) return false;
    this.perform(invert(last));
    return true;
  }

  history(): readonly RowOp[] {
    return this.applied;
  }

  isRref(): boolean {
    let previousPivot = -1;
    let seenZeroRow = false;

    for (const [index, row] of this.rows.entries()) {
      const pivot = row.findIndex(value => !value.isZero());
      if (pivot === -1) {
        seenZeroRow = true;
        continue;
      }
      if (seenZeroRow || pivot <= previousPivot || !row[pivot]!.isOne()) {
        return false;
      }
      if (this.rows.some((other, otherIndex) => otherIndex !== index && !other[pivot]!.isZero())) {
        return false;
      }
      previousPivot = pivot;
    }
    return true;
  }

  /**
   * The unique reduced row echelon form of this matrix (Gauss-Jordan).
   * The result's history holds the operations that get there from here.
   */
  reduced(): Matrix {
    const result = this.clone();
    let pivotRow = 0;
    for (let col = 0; col < result.colCount && pivotRow < result.rowCount; col++) {
      const found = result.rows.findIndex((row, index) => index >= pivotRow && !row[col]!.isZero());
      if (found === -1) continue;
      if (found !== pivotRow) {
        result.apply({ type: 'swap', a: found, b: pivotRow });
      }
      const pivot = result.rows[pivotRow]![col]!;
      if (!pivot.isOne()) {
        result.apply({ type: 'scale', row: pivotRow, factor: pivot.inverse() });
      }
      for (let row = 0; row < result.rowCount; row++) {
        const entry = result.rows[row]![col]!;
        if (row !== pivotRow && !entry.isZero()) {
          result.apply({ type: 'add', target: row, source: pivotRow, factor: entry.neg() });
        }
      }
      pivotRow++;
    }
    return result;
  }

  equals(other: Matrix): boolean {
    return (
      this.rowCount === other.rowCount &&
      this.colCount === other.colCount &&
      this.rows.every((row, r) => row.every((value, c) => value.equals(other.rows[r]![c]!)))
    );
  }

  /** A copy of the current entries with an empty history. */
  clone(): Matrix {
    return new Matrix(this.rows);
  }

  toStrings(): string[][] {
    return this.rows.map(row => row.map(value => value.toString()));
  }

  private perform(op: RowOp): void {
    switch (op.type) {
      case 'swap': {
        const first = this.rows[op.a]!;
        this.rows[op.a] = this.rows[op.b]!;
        this.rows[op.b] = first;
        break;
      }
      case 'scale':
        this.rows[op.row] = this.rows[op.row]!.map(value => value.mul(op.factor));
        break;
      case 'add': {
        const source = this.rows[op.source]!;
        this.rows[op.target] = this.rows[op.target]!.map((value, col) => value.add(source[col]!.mul(op.factor)));
        break;
      }
    }
  }
}
