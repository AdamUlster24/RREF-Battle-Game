import { useState, useEffect, useRef } from 'react';
import { Matrix } from '../utils/Matrix';
import { CommandParser } from '../utils/CommandParser';
import { MatrixDisplay } from './Matrix';
import './SinglePlayer.css';

interface SinglePlayerProps {
  onBack: () => void;
}

export function SinglePlayer({ onBack }: SinglePlayerProps) {
  const [matrixSize, setMatrixSize] = useState<string>('3x3');
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (startTime && !isComplete) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTime, isComplete]);

  const startNewGame = () => {
    const [rows, cols] = matrixSize === 'random' 
      ? ['3x3', '4x4', '5x5'][Math.floor(Math.random() * 3)].split('x').map(Number)
      : matrixSize.split('x').map(Number);
    
    const newMatrix = new Matrix(rows, cols);
    setMatrix(newMatrix);
    setCommand('');
    setError('');
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsComplete(false);
  };

  const handleExecuteCommand = () => {
    if (!matrix || !command.trim()) return;

    const result = CommandParser.parse(command, matrix);
    
    if (result.success) {
      setMatrix(new Matrix(0, 0)); // Trigger re-render
      setMatrix(matrix);
      setCommand('');
      setError('');

      // Check if RREF is achieved
      if (matrix.isInRREF()) {
        setIsComplete(true);
      }
    } else {
      setError(result.error || 'Invalid command');
    }
  };

  const handleUndo = () => {
    if (!matrix) return;

    if (matrix.undo()) {
      setMatrix(new Matrix(0, 0));
      setMatrix(matrix);
      setError('');
      setIsComplete(false);
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  return (
    <div className="single-player">
      <button className="back-button" onClick={onBack}>
        ← Back to Menu
      </button>

      <h1>Single Player - Practice Mode</h1>

      {!matrix ? (
        <div className="matrix-config">
          <h3>Configure Your Matrix</h3>
          <div className="config-group">
            <label>Matrix Size:</label>
            <select value={matrixSize} onChange={(e) => setMatrixSize(e.target.value)}>
              <option value="3x3">3×3</option>
              <option value="4x4">4×4</option>
              <option value="5x5">5×5</option>
              <option value="random">Random Size</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={startNewGame}>Start Practice</button>
        </div>
      ) : (
        <>
          <div className="single-player-header">
            <div className="timer">
              Time: {formatTime(elapsedTime)}
            </div>
            <button className="btn btn-secondary" onClick={startNewGame}>New Matrix</button>
          </div>

          {isComplete && (
            <div className="status-indicator success">
              🎉 Congratulations! You achieved RREF in {formatTime(elapsedTime)}!
            </div>
          )}

          {error && (
            <div className="status-indicator error">
              {error}
            </div>
          )}

          <div className="game-area">
            <div className="matrix-section">
              <h3>Your Matrix</h3>
              <MatrixDisplay matrix={matrix.getData()} />
            </div>

            <div className="controls-section">
              <h3>Row Operations</h3>
              
              <div className="command-input-group">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleExecuteCommand()}
                  placeholder="Enter command (e.g., R1 <> R2)"
                  disabled={isComplete}
                />
                <div className="button-group">
                  <button className="btn btn-primary" onClick={handleExecuteCommand} disabled={isComplete || !command.trim()}>
                    Execute
                  </button>
                  <button className="btn btn-secondary" onClick={handleUndo} disabled={matrix.getHistory().length === 0}>
                    Undo
                  </button>
                </div>
              </div>

              <div className="history-section">
                <h4>Operation History ({matrix.getHistory().length} operations)</h4>
                <ul className="history-list">
                  {matrix.getHistory().map((op, i) => (
                    <li key={i}>{op.description}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>Command Examples:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  <li>R1 {'<>'} R2 - Swap rows</li>
                  <li>R1 = 3*R1 - Multiply row</li>
                  <li>R1 = R1/5 - Divide row</li>
                  <li>R1 = R1 + 2R2 - Add rows</li>
                  <li>R1 = R1 - (3/2)R2 - Subtract with fraction</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
