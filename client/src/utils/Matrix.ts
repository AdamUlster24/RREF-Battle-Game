// Client-side Matrix class for single player mode
export interface Operation {
  type: 'swap' | 'multiply' | 'add';
  description: string;
  timestamp: number;
  row1?: number;
  row2?: number;
  row?: number;
  scalar?: number;
  targetRow?: number;
  sourceRow?: number;
}

export class Matrix {
  private data: number[][];
  private history: Operation[] = [];

  constructor(rows: number, cols: number) {
    this.data = this.generateRandomMatrix(rows, cols);
  }

  private generateRandomMatrix(rows: number, cols: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(Math.floor(Math.random() * 19) - 9); // Random numbers from -9 to 9
      }
      matrix.push(row);
    }
    return matrix;
  }

  getData(): number[][] {
    return this.data.map(row => [...row]);
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

  multiplyRow(row: number, scalar: number): boolean {
    if (row < 0 || row >= this.getRows() || scalar === 0) {
      return false;
    }

    this.data[row] = this.data[row]!.map(val => val * scalar);

    this.history.push({
      type: 'multiply',
      row,
      scalar,
      description: `R${row + 1} = ${scalar} × R${row + 1}`,
      timestamp: Date.now()
    });

    return true;
  }

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
    const tolerance = 0.0001;
    let leadCol = -1;

    for (let row = 0; row < this.getRows(); row++) {
      let currentLeadCol = -1;
      for (let col = 0; col < this.getCols(); col++) {
        if (Math.abs(this.data[row]?.[col] ?? 0) > tolerance) {
          currentLeadCol = col;
          break;
        }
      }

      if (currentLeadCol === -1) {
        for (let col = 0; col < this.getCols(); col++) {
          if (Math.abs(this.data[row]?.[col] ?? 0) > tolerance) {
            return false;
          }
        }
        for (let r = row + 1; r < this.getRows(); r++) {
          for (let col = 0; col < this.getCols(); col++) {
            if (Math.abs(this.data[r]?.[col] ?? 0) > tolerance) {
              return false;
            }
          }
        }
        continue;
      }

      if (currentLeadCol <= leadCol) {
        return false;
      }

      if (Math.abs((this.data[row]?.[currentLeadCol] ?? 0) - 1) > tolerance) {
        return false;
      }

      for (let r = 0; r < this.getRows(); r++) {
        if (r !== row && Math.abs(this.data[r]?.[currentLeadCol] ?? 0) > tolerance) {
          return false;
        }
      }

      leadCol = currentLeadCol;
    }

    return true;
  }
}
