import { Matrix } from './Matrix.js';

export interface ParsedCommand {
  success: boolean;
  error?: string;
}

export class CommandParser {
  /**
   * Parse and execute a command on the matrix
   * Supported formats:
   * - "R1 <> R2" - Swap rows 1 and 2
   * - "R1 = 5*R1" or "R1 = R1*5" - Multiply row 1 by 5
   * - "R1 = R1/5" - Divide row 1 by 5
   * - "R1 = R1 + 3*R2" or "R1 = R1 + 3R2" - Add 3 times row 2 to row 1
   * - "R1 = R1 - 2*R2" or "R1 = R1 - 2R2" - Subtract 2 times row 2 from row 1
   */
  static parse(command: string, matrix: Matrix): ParsedCommand {
    // Remove all spaces for easier parsing
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
      return { success: false, error: 'Invalid format. Use: R1 <> R2, R1 = 5*R1, R1 = R1 + 3R2' };
    }

    const targetRow = parseInt(eqMatch[1]!) - 1;
    const expression = eqMatch[2]!;

    // Try to parse as multiplication/division: R1 = 5*R1, R1 = R1*5, R1 = R1/5
    const result = this.parseMultiplyDivide(expression, targetRow, matrix);
    if (result) return result;

    // Try to parse as addition/subtraction: R1 = R1 + 3R2, R1 = 3R2 + R1
    const addResult = this.parseAddSubtract(expression, targetRow, matrix);
    if (addResult) return addResult;

    return { success: false, error: 'Invalid expression format' };
  }

  private static parseMultiplyDivide(expr: string, targetRow: number, matrix: Matrix): ParsedCommand | null {
    // Check for combined multiply/divide: 21R1/5 or 21*R1/5
    const combineMatch = expr.match(/^(-?\d+)\*?R(\d+)\/(-?\d+)$/);
    if (combineMatch) {
      const numerator = parseInt(combineMatch[1]!);
      const row = parseInt(combineMatch[2]!) - 1;
      const denominator = parseInt(combineMatch[3]!);
      
      if (row !== targetRow) {
        return { success: false, error: `Row R${row + 1} doesn't match target row R${targetRow + 1}` };
      }
      
      if (denominator === 0) {
        return { success: false, error: 'Cannot divide by zero' };
      }
      
      const scalar = numerator / denominator;
      
      if (scalar === 0) {
        return { success: false, error: 'Cannot multiply by zero' };
      }
      
      if (matrix.multiplyRow(targetRow, scalar)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }
    
    // Check for multiplication by fraction: R1*(29/5) or (29/5)*R1
    const fracMulMatch1 = expr.match(/^R(\d+)\*\((-?\d+)\/(-?\d+)\)$/);
    const fracMulMatch2 = expr.match(/^\((-?\d+)\/(-?\d+)\)\*R(\d+)$/);
    
    if (fracMulMatch1 || fracMulMatch2) {
      let row: number;
      let numerator: number;
      let denominator: number;
      
      if (fracMulMatch1) {
        row = parseInt(fracMulMatch1[1]!) - 1;
        numerator = parseInt(fracMulMatch1[2]!);
        denominator = parseInt(fracMulMatch1[3]!);
      } else {
        numerator = parseInt(fracMulMatch2![1]!);
        denominator = parseInt(fracMulMatch2![2]!);
        row = parseInt(fracMulMatch2![3]!) - 1;
      }
      
      if (row !== targetRow) {
        return { success: false, error: `Row R${row + 1} doesn't match target row R${targetRow + 1}` };
      }
      
      if (denominator === 0) {
        return { success: false, error: 'Cannot have zero in denominator' };
      }
      
      const scalar = numerator / denominator;
      
      if (scalar === 0) {
        return { success: false, error: 'Cannot multiply by zero' };
      }
      
      if (matrix.multiplyRow(targetRow, scalar)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }
    
    // Check for division by fraction: R1/(29/5)
    const fracDivMatch = expr.match(/^R(\d+)\/\((-?\d+)\/(-?\d+)\)$/);
    if (fracDivMatch) {
      const row = parseInt(fracDivMatch[1]!) - 1;
      const numerator = parseInt(fracDivMatch[2]!);
      const denominator = parseInt(fracDivMatch[3]!);
      
      if (row !== targetRow) {
        return { success: false, error: `Row R${row + 1} doesn't match target row R${targetRow + 1}` };
      }
      
      if (numerator === 0) {
        return { success: false, error: 'Cannot divide by zero' };
      }
      
      // Division by a fraction: R1 / (a/b) = R1 * (b/a)
      const scalar = denominator / numerator;
      
      if (matrix.multiplyRow(targetRow, scalar)) {
        return { success: true };
      }
      return { success: false, error: 'Invalid row operation' };
    }
    
    // Match patterns like: 5*R1, R1*5, -2*R1, R1*-2, R1/5, R1/-2
    const patterns = [
      /^(-?\d+)\*R(\d+)$/,      // 5*R1 or -5*R1
      /^R(\d+)\*(-?\d+)$/,      // R1*5 or R1*-5
      /^R(\d+)\/(-?\d+)$/,      // R1/5 or R1/-5
    ];

    for (const pattern of patterns) {
      const match = expr.match(pattern);
      if (match) {
        let scalar: number;
        let row: number;
        let isDivision = false;

        if (pattern.source.includes('\\/')) {
          // Division: R1/5
          row = parseInt(match[1]!) - 1;
          scalar = parseInt(match[2]!);
          isDivision = true;
        } else if (pattern.source.startsWith('^R')) {
          // Pattern: R1*5 or R1*-5
          row = parseInt(match[1]!) - 1;
          scalar = parseInt(match[2]!);
        } else {
          // Pattern: 5*R1
          scalar = parseInt(match[1]!);
          row = parseInt(match[2]!) - 1;
        }

        if (row !== targetRow) {
          return { success: false, error: `Row R${row + 1} doesn't match target row R${targetRow + 1}` };
        }

        if (isDivision) {
          if (scalar === 0) {
            return { success: false, error: 'Cannot divide by zero' };
          }
          // For RREF with integers, we allow division that creates fractions
          // The game will track if all values remain integers
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

  private static parseAddSubtract(expr: string, targetRow: number, matrix: Matrix): ParsedCommand | null {
    // Match patterns like: R1+3R2, R1+3*R2, R1+R2*3, R1-2R2, 3R2+R1, etc.
    // First, identify the operation (+ or -)
    let operation: '+' | '-' | null = null;
    let operationIndex = -1;

    // Find + or - that's not at the start or after another operator
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

    // Parse both parts as term (can be R1, 3R2, 3*R2, R2*3)
    const leftTerm = this.parseTerm(leftPart);
    const rightTerm = this.parseTerm(rightPart);

    if (!leftTerm || !rightTerm) {
      return null;
    }

    // One term must be the target row with scalar 1, the other is the source
    let sourceRow: number;
    let scalar: number;

    if (leftTerm.row === targetRow && leftTerm.scalar === 1) {
      // R1 = R1 + 3R2
      sourceRow = rightTerm.row;
      scalar = operation === '-' ? -rightTerm.scalar : rightTerm.scalar;
    } else if (rightTerm.row === targetRow && rightTerm.scalar === 1) {
      // R1 = 3R2 + R1
      sourceRow = leftTerm.row;
      scalar = operation === '-' ? -leftTerm.scalar : leftTerm.scalar;
      if (operation === '-') {
        return { success: false, error: 'Target row must come first in subtraction' };
      }
    } else {
      return { success: false, error: 'One term must be the target row without a scalar' };
    }

    if (matrix.addRows(targetRow, sourceRow, scalar)) {
      return { success: true };
    }
    return { success: false, error: 'Invalid row operation' };
  }

  private static parseTerm(term: string): { row: number; scalar: number } | null {
    // Match: R1, 3R2, 3*R2, R2*3, -3R2, -3*R2, (3/2)*R2, (3/2)R2, R2*(3/2)
    
    // Check for fraction patterns first: (3/2)*R2, (3/2)R2, or R2*(3/2)
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
    
    const patterns = [
      /^R(\d+)$/,               // R1
      /^(-?\d+)R(\d+)$/,        // 3R2 or -3R2
      /^(-?\d+)\*R(\d+)$/,      // 3*R2 or -3*R2
      /^R(\d+)\*(-?\d+)$/,      // R2*3 or R2*-3
    ];

    for (const pattern of patterns) {
      const match = term.match(pattern);
      if (match) {
        if (pattern.source === '^R(\\d+)$') {
          // Just R1
          return { row: parseInt(match[1]!) - 1, scalar: 1 };
        } else if (pattern.source.endsWith('R(\\d+)$')) {
          // 3R2 or 3*R2 or -3R2
          return { row: parseInt(match[2]!) - 1, scalar: parseInt(match[1]!) };
        } else {
          // R2*3
          return { row: parseInt(match[1]!) - 1, scalar: parseInt(match[2]!) };
        }
      }
    }

    return null;
  }
}
