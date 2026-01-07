// Client-side command parser for single player mode
import { Matrix } from './Matrix';

interface ParseResult {
  success: boolean;
  error?: string;
}

export class CommandParser {
  static parse(command: string, matrix: Matrix): ParseResult {
    const cmd = command.replace(/\s+/g, '').toUpperCase();

    // Swap rows: R1 <> R2
    const swapMatch = cmd.match(/^R(\d+)<>R(\d+)$/);
    if (swapMatch) {
      const row1 = parseInt(swapMatch[1]!) - 1;
      const row2 = parseInt(swapMatch[2]!) - 1;

      if (matrix.swapRows(row1, row2)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row indices' };
    }

    // All other operations use = sign
    const eqMatch = cmd.match(/^R(\d+)=(.+)$/);
    if (!eqMatch) {
      return { success: false, error: 'Invalid format' };
    }

    const targetRow = parseInt(eqMatch[1]!) - 1;
    const expression = eqMatch[2]!;

    // Try multiplication/division
    const multiplyResult = this.parseMultiplyDivide(expression, targetRow, matrix);
    if (multiplyResult) return multiplyResult;

    // Try addition/subtraction
    const addResult = this.parseAddSubtract(expression, targetRow, matrix);
    if (addResult) return addResult;

    return { success: false, error: 'Invalid expression' };
  }

  private static parseMultiplyDivide(expr: string, targetRow: number, matrix: Matrix): ParseResult | null {
    // Combined: 21R1/5
    const combineMatch = expr.match(/^(-?\d+)\*?R(\d+)\/(-?\d+)$/);
    if (combineMatch) {
      const numerator = parseInt(combineMatch[1]!);
      const row = parseInt(combineMatch[2]!) - 1;
      const denominator = parseInt(combineMatch[3]!);

      if (row !== targetRow || denominator === 0) {
        return { success: false, error: 'Invalid operation' };
      }

      if (matrix.multiplyRow(targetRow, numerator / denominator)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }

    // Fraction multiply: R1*(3/2) or (3/2)*R1
    const fracMulMatch1 = expr.match(/^R(\d+)\*\((-?\d+)\/(-?\d+)\)$/);
    const fracMulMatch2 = expr.match(/^\((-?\d+)\/(-?\d+)\)\*?R(\d+)$/);

    if (fracMulMatch1 || fracMulMatch2) {
      let row: number, numerator: number, denominator: number;

      if (fracMulMatch1) {
        row = parseInt(fracMulMatch1[1]!) - 1;
        numerator = parseInt(fracMulMatch1[2]!);
        denominator = parseInt(fracMulMatch1[3]!);
      } else {
        numerator = parseInt(fracMulMatch2![1]!);
        denominator = parseInt(fracMulMatch2![2]!);
        row = parseInt(fracMulMatch2![3]!) - 1;
      }

      if (row !== targetRow || denominator === 0) {
        return { success: false, error: 'Invalid operation' };
      }

      if (matrix.multiplyRow(targetRow, numerator / denominator)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }

    // Fraction divide: R1/(3/2)
    const fracDivMatch = expr.match(/^R(\d+)\/\((-?\d+)\/(-?\d+)\)$/);
    if (fracDivMatch) {
      const row = parseInt(fracDivMatch[1]!) - 1;
      const numerator = parseInt(fracDivMatch[2]!);
      const denominator = parseInt(fracDivMatch[3]!);

      if (row !== targetRow || numerator === 0) {
        return { success: false, error: 'Invalid operation' };
      }

      if (matrix.multiplyRow(targetRow, denominator / numerator)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }

    // Basic patterns: 5*R1, R1*5, R1/5
    const patterns = [
      /^(-?\d+)\*R(\d+)$/,
      /^R(\d+)\*(-?\d+)$/,
      /^R(\d+)\/(-?\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = expr.match(pattern);
      if (match) {
        let scalar: number, row: number, isDivision = false;

        if (pattern.source.includes('\\/')) {
          row = parseInt(match[1]!) - 1;
          scalar = parseInt(match[2]!);
          isDivision = true;
        } else if (pattern.source.startsWith('^R')) {
          row = parseInt(match[1]!) - 1;
          scalar = parseInt(match[2]!);
        } else {
          scalar = parseInt(match[1]!);
          row = parseInt(match[2]!) - 1;
        }

        if (row !== targetRow) {
          return { success: false, error: 'Row mismatch' };
        }

        if (isDivision) {
          if (scalar === 0) {
            return { success: false, error: 'Cannot divide by zero' };
          }
          scalar = 1 / scalar;
        }

        if (scalar === 0) {
          return { success: false, error: 'Cannot multiply by zero' };
        }

        if (matrix.multiplyRow(targetRow, scalar)) {
          return { success: true };
        }
        return { success: false, error: 'Invalid row operation' };
      }
    }

    return null;
  }

  private static parseAddSubtract(expr: string, targetRow: number, matrix: Matrix): ParseResult | null {
    let operation: '+' | '-' | null = null;
    let operationIndex = -1;

    for (let i = 1; i < expr.length; i++) {
      if (expr[i] === '+' || expr[i] === '-') {
        operation = expr[i] as '+' | '-';
        operationIndex = i;
        break;
      }
    }

    if (!operation || operationIndex === -1) {
      return null;
    }

    const leftPart = expr.substring(0, operationIndex);
    const rightPart = expr.substring(operationIndex + 1);

    const leftTerm = this.parseTerm(leftPart);
    const rightTerm = this.parseTerm(rightPart);

    if (!leftTerm || !rightTerm) {
      return null;
    }

    let sourceRow: number, scalar: number;

    if (leftTerm.row === targetRow && leftTerm.scalar === 1) {
      sourceRow = rightTerm.row;
      scalar = operation === '-' ? -rightTerm.scalar : rightTerm.scalar;
    } else if (rightTerm.row === targetRow && rightTerm.scalar === 1) {
      sourceRow = leftTerm.row;
      scalar = operation === '-' ? -leftTerm.scalar : leftTerm.scalar;
      if (operation === '-') {
        return { success: false, error: 'Target row must come first in subtraction' };
      }
    } else {
      return { success: false, error: 'One term must be the target row' };
    }

    if (matrix.addRows(targetRow, sourceRow, scalar)) {
      return { success: true };
    }
    return { success: false, error: 'Invalid row operation' };
  }

  private static parseTerm(term: string): { row: number; scalar: number } | null {
    // Fraction patterns: (3/2)*R2, (3/2)R2, R2*(3/2)
    const fracPattern1 = term.match(/^\((-?\d+)\/(-?\d+)\)\*?R(\d+)$/);
    const fracPattern2 = term.match(/^R(\d+)\*\((-?\d+)\/(-?\d+)\)$/);

    if (fracPattern1) {
      const numerator = parseInt(fracPattern1[1]!);
      const denominator = parseInt(fracPattern1[2]!);
      const row = parseInt(fracPattern1[3]!) - 1;
      if (denominator === 0) return null;
      return { row, scalar: numerator / denominator };
    }

    if (fracPattern2) {
      const row = parseInt(fracPattern2[1]!) - 1;
      const numerator = parseInt(fracPattern2[2]!);
      const denominator = parseInt(fracPattern2[3]!);
      if (denominator === 0) return null;
      return { row, scalar: numerator / denominator };
    }

    // Basic patterns
    const patterns = [
      /^R(\d+)$/,
      /^(-?\d+)\*?R(\d+)$/,
      /^R(\d+)\*(-?\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = term.match(pattern);
      if (match) {
        if (pattern.source === '^R(\\d+)$') {
          return { row: parseInt(match[1]!) - 1, scalar: 1 };
        } else if (pattern.source.endsWith('R(\\d+)$')) {
          return { row: parseInt(match[2]!) - 1, scalar: parseInt(match[1]!) };
        } else {
          return { row: parseInt(match[1]!) - 1, scalar: parseInt(match[2]!) };
        }
      }
    }

    return null;
  }
}
