export type MatrixData = number[][];

export interface RowOperation {
  type: 'swap' | 'multiply' | 'add';
  description: string;
  timestamp: number;
}

export interface SwapOperation extends RowOperation {
  type: 'swap';
  row1: number;
  row2: number;
}

export interface MultiplyOperation extends RowOperation {
  type: 'multiply';
  row: number;
  scalar: number;
}

export interface AddOperation extends RowOperation {
  type: 'add';
  targetRow: number;
  sourceRow: number;
  scalar: number;
}

export type Operation = SwapOperation | MultiplyOperation | AddOperation;

export class Matrix {
  private data: MatrixData;
  private history: Operation[];

  constructor(data: MatrixData) {
    this.data = data.map(row => [...row]); // Deep copy
    this.history = [];
  }

  getData(): MatrixData {
    return this.data.map(row => [...row]); // Return copy
  }

  getHistory(): Operation[] {
    return [...this.history];
  }

  getRows(): number {
    return this.data.length;
  }

  getCols(): number {
    return this.data[0]?.length || 0;
  }

  // R_i <-> R_j (swap rows)
  swapRows(row1: number, row2: number): boolean {
    if (row1 < 0 || row1 >= this.getRows() || row2 < 0 || row2 >= this.getRows()) {
      return false;
    }

    const temp = this.data[row1];
    this.data[row1] = this.data[row2]!;
    this.data[row2] = temp!;
    
    this.history.push({
      type: 'swap',
      row1,
      row2,
      description: `R${row1 + 1} <> R${row2 + 1}`,
      timestamp: Date.now()
    });

    return true;
  }

  // k * R_i -> R_i (multiply row by scalar)
  multiplyRow(row: number, scalar: number): boolean {
    if (row < 0 || row >= this.getRows() || scalar === 0) {
      return false;
    }

    this.data[row] = this.data[row]!.map(val => val * scalar);
    
    const scalarStr = scalar === Math.floor(scalar) 
      ? scalar.toString() 
      : `(1/${Math.round(1/scalar)})`;
    
    this.history.push({
      type: 'multiply',
      row,
      scalar,
      description: `R${row + 1} = ${scalar} × R${row + 1}`,
      timestamp: Date.now()
    });

    return true;
  }

  // R_i + k * R_j -> R_i (add scalar multiple of one row to another)
  addRows(targetRow: number, sourceRow: number, scalar: number): boolean {
    if (
      targetRow < 0 || targetRow >= this.getRows() ||
      sourceRow < 0 || sourceRow >= this.getRows() ||
      targetRow === sourceRow
    ) {
      return false;
    }

    for (let col = 0; col < this.getCols(); col++) {
      const targetVal = this.data[targetRow]?.[col] ?? 0;
      const sourceVal = this.data[sourceRow]?.[col] ?? 0;
      this.data[targetRow]![col] = targetVal + scalar * sourceVal;
    }

    const op = scalar >= 0 ? '+' : '-';
    const absScalar = Math.abs(scalar);
    this.history.push({
      type: 'add',
      targetRow,
      sourceRow,
      scalar,
      description: `R${targetRow + 1} = R${targetRow + 1} ${op} ${absScalar} × R${sourceRow + 1}`,
      timestamp: Date.now()
    });

    return true;
  }

  undo(): boolean {
    if (this.history.length === 0) {
      return false;
    }

    const lastOp = this.history.pop()!;

    // Reverse the operation
    switch (lastOp.type) {
      case 'swap':
        const temp = this.data[lastOp.row1!];
        this.data[lastOp.row1!] = this.data[lastOp.row2!]!;
        this.data[lastOp.row2!] = temp!;
        break;
      
      case 'multiply':
        this.data[lastOp.row!] = this.data[lastOp.row!]!.map(val => val / lastOp.scalar!);
        break;
      
      case 'add':
        for (let col = 0; col < this.getCols(); col++) {
          const targetVal = this.data[lastOp.targetRow!]?.[col] ?? 0;
          const sourceVal = this.data[lastOp.sourceRow!]?.[col] ?? 0;
          this.data[lastOp.targetRow!]![col] = targetVal - lastOp.scalar! * sourceVal;
        }
        break;
    }

    return true;
  }

  isInRREF(): boolean {
    const tolerance = 0.0001; // Floating point tolerance
    let leadCol = -1;

    for (let row = 0; row < this.getRows(); row++) {
      // Find the leading entry (first non-zero) in this row
      let currentLeadCol = -1;
      for (let col = 0; col < this.getCols(); col++) {
        if (Math.abs(this.data[row]?.[col] ?? 0) > tolerance) {
          currentLeadCol = col;
          break;
        }
      }

      // Zero row
      if (currentLeadCol === -1) {
        // All remaining entries in the row must be zero
        for (let col = 0; col < this.getCols(); col++) {
          if (Math.abs(this.data[row]?.[col] ?? 0) > tolerance) {
            return false;
          }
        }
        // All subsequent rows must also be zero rows
        for (let r = row + 1; r < this.getRows(); r++) {
          for (let col = 0; col < this.getCols(); col++) {
            if (Math.abs(this.data[r]?.[col] ?? 0) > tolerance) {
              return false;
            }
          }
        }
        continue;
      }

      // Leading entry must be to the right of the leading entry in the row above
      if (currentLeadCol <= leadCol) {
        return false;
      }

      // Leading entry must be 1
      if (Math.abs((this.data[row]?.[currentLeadCol] ?? 0) - 1) > tolerance) {
        return false;
      }

      // All other entries in the column containing the leading 1 must be 0
      for (let r = 0; r < this.getRows(); r++) {
        if (r !== row && Math.abs(this.data[r]?.[currentLeadCol] ?? 0) > tolerance) {
          return false;
        }
      }

      leadCol = currentLeadCol;
    }

    return true;
  }

  clone(): Matrix {
    return new Matrix(this.getData());
  }

  static generateRandom(rows: number, cols: number, minVal: number = -5, maxVal: number = 5): Matrix {
    const data: MatrixData = [];
    
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        // Generate random integer between minVal and maxVal
        row.push(Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal);
      }
      data.push(row);
    }

    return new Matrix(data);
  }
}
