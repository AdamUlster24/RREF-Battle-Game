import { useMemo, useState } from 'react';
import { Matrix, describeOp, type RowOp } from '@shared/matrix.js';
import { parseCommand } from '@shared/parser.js';
import { COUNTDOWN_MS, MATRIX_SIZES, type MatrixSize } from '@shared/protocol.js';
import { formatTime, useNow } from '../lib/time';
import { CommandBar } from './CommandBar';
import { History } from './History';
import { MatrixDisplay } from './Matrix';
import './SinglePlayer.css';

interface SinglePlayerProps {
  onBack: () => void;
}

interface Game {
  start: Matrix;
  ops: RowOp[];
  /** When the countdown began, on the `performance.now()` clock. */
  dealtAt: number;
  /** Set once the matrix reaches RREF. */
  solvedInMs: number | null;
}

const SIZE_LABELS: Record<MatrixSize, string> = {
  '3x3': '3×3',
  '4x4': '4×4',
  '5x5': '5×5',
  random: 'Random Size'
};

export function SinglePlayer({ onBack }: SinglePlayerProps) {
  const [matrixSize, setMatrixSize] = useState<MatrixSize>('3x3');
  const [game, setGame] = useState<Game | null>(null);

  const now = useNow(!!game && game.solvedInMs === null);

  // The matrix is rebuilt from the starting position, so undo is just dropping an operation.
  const matrix = useMemo(() => {
    if (!game) return null;
    const current = game.start.clone();
    for (const op of game.ops) current.apply(op);
    return current;
  }, [game]);

  const startNewGame = () => {
    const size = matrixSize === 'random' ? 3 + Math.floor(Math.random() * 3) : Number(matrixSize[0]);
    setGame({ start: Matrix.random(size, size, { maxAbs: 9 }), ops: [], dealtAt: performance.now(), solvedInMs: null });
  };

  const execute = (command: string): string | null => {
    if (!game || !matrix) return null;
    const parsed = parseCommand(command, matrix.rowCount);
    if (!parsed.ok) return parsed.error;

    const next = matrix.clone();
    next.apply(parsed.op);
    setGame({
      ...game,
      ops: [...game.ops, parsed.op],
      solvedInMs: next.isRref() ? performance.now() - game.dealtAt - COUNTDOWN_MS : null
    });
    return null;
  };

  const undo = () => {
    if (game) setGame({ ...game, ops: game.ops.slice(0, -1) });
  };

  const sinceDealt = game ? Math.max(0, now - game.dealtAt) : 0;
  const counting = sinceDealt < COUNTDOWN_MS;
  const elapsed = game?.solvedInMs ?? sinceDealt - COUNTDOWN_MS;
  const solved = game?.solvedInMs != null;

  return (
    <div className="single-player">
      <button className="back-button" onClick={onBack}>
        ← Back to Menu
      </button>

      <h1>Single Player - Practice Mode</h1>

      {!game || !matrix ? (
        <div className="matrix-config">
          <h3>Configure Your Matrix</h3>
          <div className="config-group">
            <label htmlFor="practice-size">Matrix Size:</label>
            <select id="practice-size" value={matrixSize} onChange={(e) => setMatrixSize(e.target.value as MatrixSize)}>
              {MATRIX_SIZES.map(size => (
                <option key={size} value={size}>{SIZE_LABELS[size]}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={startNewGame}>Start Practice</button>
        </div>
      ) : counting ? (
        <div className="countdown-overlay">
          <div className="countdown-number">{Math.max(1, Math.ceil((COUNTDOWN_MS - sinceDealt) / 1000))}</div>
          <div className="matrix-preview">
            <h3>Get Ready!</h3>
            <MatrixDisplay matrix={matrix.toStrings()} />
          </div>
        </div>
      ) : (
        <>
          <div className="single-player-header">
            <div className="timer">
              Time: {formatTime(elapsed)}
            </div>
            <button className="btn btn-secondary" onClick={startNewGame}>New Matrix</button>
          </div>

          {solved && (
            <div className="status-indicator success">
              Solved in {formatTime(elapsed)} with {game.ops.length} {game.ops.length === 1 ? 'operation' : 'operations'}.
            </div>
          )}

          <div className="game-area">
            <div className="matrix-section">
              <h3>Your Matrix</h3>
              <MatrixDisplay matrix={matrix.toStrings()} />
            </div>

            <div className="controls-section">
              <h3>Row Operations</h3>
              {!solved && <CommandBar onSubmit={execute} onUndo={undo} canUndo={game.ops.length > 0} />}
              <History operations={game.ops.map(describeOp)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
