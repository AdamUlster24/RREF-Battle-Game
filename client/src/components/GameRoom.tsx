import { useState } from 'react';
import { COUNTDOWN_MS, type RoomSnapshot } from '@shared/protocol.js';
import { socket } from '../lib/socket';
import { formatTime, useNow } from '../lib/time';
import { CommandBar } from './CommandBar';
import { History } from './History';
import { MatrixDisplay } from './Matrix';
import './GameRoom.css';

interface GameRoomProps {
  room: RoomSnapshot;
  /** When the room entered its current state, on the `performance.now()` clock. */
  phaseStartedAt: number;
  playerId: string;
  onLeave: () => void;
}

const WIN_CONDITION_LABELS = {
  single: 'Single battle',
  'best-of-3': 'Best of 3',
  'best-of-5': 'Best of 5'
};

function sendCommand(command: string): Promise<string | null> {
  return new Promise(resolve => {
    socket.emit('command', { command }, result => resolve(result.ok ? null : result.error));
  });
}

export function GameRoom({ room, phaseStartedAt, playerId, onLeave }: GameRoomProps) {
  const [copied, setCopied] = useState(false);

  const me = room.players.find(p => p.id === playerId);
  const opponent = room.players.find(p => p.id !== playerId);
  const isHost = room.hostId === playerId;

  const isWaiting = room.state === 'waiting';
  const isCountdown = room.state === 'countdown';
  const isPlaying = room.state === 'playing';
  const isRoundOver = room.state === 'round-over';
  const isFinished = room.state === 'finished';

  const elapsed = Math.max(0, useNow(isCountdown || isPlaying) - phaseStartedAt);
  const countdown = Math.max(1, Math.ceil((COUNTDOWN_MS - elapsed) / 1000));

  const roundWinner = room.players.find(p => p.id === room.lastRound?.winnerId);
  const iWonRound = roundWinner?.id === playerId;

  const copyCode = async () => {
    await navigator.clipboard?.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="room-info">
          <h2>
            Room: <span className="room-code">{room.id}</span>
            <button onClick={copyCode} className="copy-btn" title="Copy room code">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </h2>
          <div className="settings-info">
            {room.settings.matrixSize === 'random' ? 'Random size' : room.settings.matrixSize.replace('x', '×')}
            {' • '}
            {WIN_CONDITION_LABELS[room.settings.winCondition]}
            {room.requiredWins > 1 && ` • Round ${room.round}`}
          </div>
        </div>

        <div className="players-info">
          {room.players.map(player => (
            <div key={player.id} className={`player-badge ${player.id === playerId ? 'current' : ''}`}>
              <span className="player-name">
                {player.username}
                {player.id === room.hostId && <span className="host-tag">host</span>}
              </span>
              <span className="player-wins">
                {player.wins} / {room.requiredWins}
              </span>
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
          {!opponent ? (
            <>
              <h3>Waiting for an opponent</h3>
              <p>Send them the room code:</p>
              <div className="big-code">{room.id}</div>
            </>
          ) : (
            <>
              <h3>{room.round > 1 ? `Round ${room.round}` : 'Get ready'}</h3>
              <p>
                {!room.players.every(p => p.ready)
                  ? 'The round can start once both players are ready.'
                  : isHost
                    ? 'Everyone is ready. Start when you like.'
                    : `Waiting for ${opponent.username} to start the round.`}
              </p>
              <div className="ready-controls">
                <button
                  onClick={() => socket.emit('toggle-ready')}
                  className={`btn ${me?.ready ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {me?.ready ? 'Not Ready' : 'Ready'}
                </button>
                {isHost && room.players.every(p => p.ready) && (
                  <button onClick={() => socket.emit('start-game')} className="btn btn-primary start-btn">
                    Start Game
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {isCountdown && (
        <div className="countdown-screen">
          <h2>Get Ready!</h2>
          <div className="countdown-number">{countdown}</div>
          <div className="matrix-preview">
            {room.startMatrix && <MatrixDisplay matrix={room.startMatrix} />}
          </div>
        </div>
      )}

      {(isPlaying || isRoundOver || isFinished) && (
        <div className="game-content">
          <div className="timer-display">
            {isPlaying && <div className="timer">{formatTime(elapsed)}</div>}
            {roundWinner && room.lastRound && (
              <div className={`game-over ${iWonRound ? 'won' : 'lost'}`}>
                <h2>
                  {isFinished
                    ? iWonRound ? 'You win the match!' : `${roundWinner.username} wins the match`
                    : iWonRound ? 'You take the round!' : `${roundWinner.username} takes the round`}
                </h2>
                <p>
                  Solved in {formatTime(room.lastRound.timeMs)}
                  {room.requiredWins > 1 && ` • ${room.players.map(p => `${p.username} ${p.wins}`).join(' – ')}`}
                </p>
                <div className="round-actions">
                  {isRoundOver && (
                    <button onClick={() => socket.emit('next-round')} className="btn btn-primary">
                      Next Round
                    </button>
                  )}
                  {isFinished && (
                    <button onClick={() => socket.emit('rematch')} className="btn btn-primary">
                      Rematch
                    </button>
                  )}
                  <button onClick={onLeave} className="btn btn-secondary">
                    Back to Menu
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="matrices-container">
            <div className="player-matrix">
              <h3>Your Matrix</h3>
              {me?.matrix && <MatrixDisplay matrix={me.matrix} />}
              {isPlaying && (
                <CommandBar
                  onSubmit={sendCommand}
                  onUndo={() => socket.emit('undo')}
                  canUndo={!!me?.history.length}
                />
              )}
              <History operations={me?.history ?? []} />
            </div>

            {opponent && (
              <div className="opponent-matrix">
                <h3>{opponent.username}'s Matrix</h3>
                {opponent.matrix && <MatrixDisplay matrix={opponent.matrix} isOpponent />}
                <div className="opponent-progress">
                  {opponent.history.length} {opponent.history.length === 1 ? 'operation' : 'operations'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
