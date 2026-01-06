import type { MatrixData } from '../types';
import './Matrix.css';

interface MatrixDisplayProps {
  matrix: MatrixData;
  isOpponent?: boolean;
}

export function MatrixDisplay({ matrix, isOpponent }: MatrixDisplayProps) {
  const gcd = (a: number, b: number): number => {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b > 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  };

  const formatValue = (value: number) => {
    if (value === 0) return '0';
    
    // Round to avoid floating point errors for integers
    if (Math.abs(value - Math.round(value)) < 0.0001) {
      return Math.round(value).toString();
    }
    
    // Convert decimal to fraction
    const sign = value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    
    // Try to find a simple fraction representation
    const tolerance = 0.0001;
    let bestNumerator = 1;
    let bestDenominator = 1;
    let bestError = Math.abs(absValue - 1);
    
    // Check denominators up to 100
    for (let denominator = 1; denominator <= 100; denominator++) {
      const numerator = Math.round(absValue * denominator);
      const error = Math.abs(absValue - numerator / denominator);
      
      if (error < tolerance && error < bestError) {
        bestNumerator = numerator;
        bestDenominator = denominator;
        bestError = error;
        
        if (error < 0.00001) break; // Good enough
      }
    }
    
    // Simplify the fraction
    const divisor = gcd(bestNumerator, bestDenominator);
    const finalNumerator = bestNumerator / divisor;
    const finalDenominator = bestDenominator / divisor;
    
    if (finalDenominator === 1) {
      return sign + finalNumerator;
    }
    
    return sign + finalNumerator + '/' + finalDenominator;
  };

  return (
    <div className={`matrix-display ${isOpponent ? 'opponent' : ''}`}>
      <table className="matrix-table">
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, colIndex) => (
                <td key={colIndex}>
                  {formatValue(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
