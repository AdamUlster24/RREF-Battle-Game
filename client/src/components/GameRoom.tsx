import { useState, useEffect, useRef } from 'react';
import type { Room } from '../types';
import { MatrixDisplay } from './Matrix';
import './GameRoom.css';

interface GameRoomProps {
  room: Room;
  currentPlayerId: string;
  onExecuteCommand: (command: string) => void;
  onUndo: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeave: () => void;
  onNextRound: () => void;
}

export function GameRoom({
  room,
  currentPlayerId,
  onExecuteCommand,
  onUndo,
  onToggleReady,
  onStartGame,
  onLeave,
  onNextRound
}: GameRoomProps) {
  const [command, setCommand] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const currentPlayer = room.players.find(p => p.id === currentPlayerId);
  const opponent = room.players.find(p => p.id !== currentPlayerId);

  // Timer effect
  useEffect(() => {
    if (room.state === 'playing' && room.gameStarted) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - room.gameStarted!);
      }, 10);
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [room.state, room.gameStarted]);

  // Countdown effect
  useEffect(() => {
    if (room.state === 'countdown' && room.countdownStarted) {
      const interval = setInterval(() => {
        const remaining = 3000 - (Date.now() - room.countdownStarted!);
        setCountdown(Math.max(0, Math.ceil(remaining / 1000)));
        if (remaining <= 0) {
          setCountdown(null);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [room.state, room.countdownStarted]);

  // Auto-focus input when game starts
  useEffect(() => {
    if (room.state === 'playing') {
      commandInputRef.current?.focus();
    }
  }, [room.state]);

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command.trim());
      setCommand('');
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const isWaiting = room.state === 'waiting';
  const isCountdown = room.state === 'countdown';
  const isPlaying = room.state === 'playing';
  const isFinished = room.state === 'finished';

  const getWinner = () => {
    return room.players.reduce((max, player) => 
      player.wins > max.wins ? player : max
    );
  };

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="room-info">
          <h2>Room: {room.id}</h2>
          <div className="settings-info">
            {room.settings.matrixSize} • {room.settings.winCondition.replace('-', ' ')}
          </div>
        </div>
        
        <div className="players-info">
          {room.players.map(player => (
            <div key={player.id} className={`player-badge ${player.id === currentPlayerId ? 'current' : ''}`}>
              <span className="player-name">{player.username}</span>
              <span className="player-wins">{player.wins} wins</span>
              {isWaiting && (
                <span className={`ready-status ${player.ready ? 'ready' : ''}`}>
                  {player.ready ? '✓' : '○'}
                </span>
              )}
            </div>
          ))}
        </div>

        <button onClick={onLeave} className="btn btn-danger">
          Leave
        </button>
      </div>

      {isWaiting && (
        <div className="waiting-screen">
          <h3>Waiting for Players</h3>
          {room.players.length < 2 ? (
            <p>Waiting for opponent to join...</p>
          ) : (
            <>
              <p>Both players ready to start!</p>
              <div className="ready-controls">
                <button 
                  onClick={onToggleReady} 
                  className={`btn ${currentPlayer?.ready ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {currentPlayer?.ready ? 'Not Ready' : 'Ready'}
                </button>
                {room.hostId === currentPlayerId && room.players.every(p => p.ready) && (
                  <button 
                    onClick={onStartGame} 
                    className="btn btn-primary start-btn"
                  >
                    Start Game
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {isCountdown && countdown !== null && (
        <div className="countdown-screen">
          <h2>Get Ready!</h2>
          <div className="countdown-number">{countdown}</div>
          <div className="matrix-preview">
            {room.targetMatrix && <MatrixDisplay matrix={room.targetMatrix} />}
          </div>
        </div>
      )}

      {(isPlaying || isFinished) && (
        <div className="game-content">
          <div className="timer-display">
            {isPlaying && <div className="timer">{formatTime(elapsedTime)}</div>}
            {isFinished && (
              <div className="game-over">
                <h2>🎉 {getWinner().username} Wins!</h2>
                {getWinner().id === currentPlayerId && <p>Congratulations!</p>}
              </div>
            )}
          </div>

          <div className="matrices-container">
            <div className="player-matrix">
              <h3>Your Matrix {currentPlayer?.completedAt && <span className="completed">✓ Completed!</span>}</h3>
              {currentPlayer?.matrixData && <MatrixDisplay matrix={currentPlayer.matrixData} />}
              
              {isPlaying && (
                <div className="controls">
                  <form onSubmit={handleSubmitCommand} className="command-form">
                    <input
                      ref={commandInputRef}
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="e.g., R1 <> R2, R1 = 3*R1, R1 = R1 + 2R2"
                      className="command-input"
                      disabled={!!currentPlayer?.completedAt}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!!currentPlayer?.completedAt}>
                      Execute
                    </button>
                    <button type="button" onClick={onUndo} className="btn btn-secondary" disabled={!!currentPlayer?.completedAt}>
                      Undo
                    </button>
                  </form>
                  <div className="command-hints">
                    <span>Swap: R1 &lt;&gt; R2</span>
                    <span>Multiply: R1 = 3*R1</span>
                    <span>Divide: R1 = R1/5</span>
                    <span>Add: R1 = R1 + 2R2</span>
                    <span>Subtract: R1 = R1 - 3*R2</span>
                  </div>
                </div>
              )}

              <div className="history">
                <h4>Operations History</h4>
                <div className="history-list">
                  {currentPlayer?.history?.map((op, idx) => (
                    <div key={idx} className="history-item">
                      {idx + 1}. {op.description}
                    </div>
                  ))}
                  {(!currentPlayer?.history || currentPlayer.history.length === 0) && (
                    <div className="history-empty">No operations yet</div>
                  )}
                </div>
              </div>
            </div>

            {opponent && (
              <div className="opponent-matrix">
                <h3>{opponent.username}'s Matrix {opponent.completedAt && <span className="completed">✓ Completed!</span>}</h3>
                {opponent.matrixData && <MatrixDisplay matrix={opponent.matrixData} isOpponent />}
              </div>
            )}
          </div>

          {isFinished && (
            <div className="round-actions">
              {room.settings.winCondition !== 'single' && (
                <button onClick={onNextRound} className="btn btn-primary">
                  Next Round
                </button>
              )}
              <button onClick={onLeave} className="btn btn-secondary">
                Back to Lobby
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
