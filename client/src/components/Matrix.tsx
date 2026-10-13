import type { MatrixSnapshot } from '@shared/protocol.js';
import './Matrix.css';

interface MatrixDisplayProps {
  matrix: MatrixSnapshot;
  isOpponent?: boolean;
}

/** Entries arrive as exact strings ("3", "-7/2"); fractions are drawn stacked. */
function Entry({ value }: { value: string }) {
  const [numerator, denominator] = value.replace('-', '').split('/');
  if (!denominator) return <>{value}</>;
  return (
    <span className="fraction" aria-label={value}>
      {value.startsWith('-') && <span className="fraction-sign">−</span>}
      <span className="fraction-parts">
        <span className="fraction-top">{numerator}</span>
        <span>{denominator}</span>
      </span>
    </span>
  );
}

export function MatrixDisplay({ matrix, isOpponent }: MatrixDisplayProps) {
  return (
    <div className={`matrix-display ${isOpponent ? 'opponent' : ''}`}>
      <table className="matrix-table">
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th scope="row" className="row-label">R{rowIndex + 1}</th>
              {row.map((value, colIndex) => (
                <td key={colIndex}>
                  <Entry value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
