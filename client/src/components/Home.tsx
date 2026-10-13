import { useState } from 'react';
import {
  MATRIX_SIZES,
  MAX_USERNAME_LENGTH,
  ROOM_CODE_LENGTH,
  WIN_CONDITIONS,
  type MatrixSize,
  type RoomSettings,
  type WinCondition
} from '@shared/protocol.js';
import './Home.css';

interface HomeProps {
  /** False until the game server answers; multiplayer is unavailable until then. */
  connected: boolean;
  onCreateRoom: (username: string, settings: RoomSettings) => void;
  onJoinRoom: (roomId: string, username: string) => void;
  onSinglePlayer: () => void;
}

const SIZE_LABELS: Record<MatrixSize, string> = { '3x3': '3×3', '4x4': '4×4', '5x5': '5×5', random: 'Random' };
const WIN_LABELS: Record<WinCondition, string> = {
  single: 'Single Battle',
  'best-of-3': 'Best of 3',
  'best-of-5': 'Best of 5'
};

export function Home({ connected, onCreateRoom, onJoinRoom, onSinglePlayer }: HomeProps) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [matrixSize, setMatrixSize] = useState<MatrixSize>('3x3');
  const [winCondition, setWinCondition] = useState<WinCondition>('single');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onCreateRoom(username.trim(), { matrixSize, winCondition });
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoinRoom(roomId.trim().toUpperCase(), username.trim());
    }
  };

  const usernameInput = (
    <input
      type="text"
      placeholder="Your Username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      maxLength={MAX_USERNAME_LENGTH}
      required
      className="input"
      aria-label="Your username"
    />
  );

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="game-title">RREF Battle</h1>
        <p className="game-subtitle">Race to Reduced Row Echelon Form</p>

        {!showCreate ? (
          <div className="home-options">
            <button className="btn btn-primary" onClick={onSinglePlayer}>
              Single Player Practice
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!connected}>
              Multiplayer - Create Room
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <form onSubmit={handleJoinRoom} className="join-form">
              {usernameInput}
              <input
                type="text"
                placeholder="Room Code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH}
                required
                className="input"
                aria-label="Room code"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-secondary" disabled={!connected}>
                Join Room
              </button>
            </form>

            {!connected && (
              <p className="connection-note" role="status">
                Connecting to the game server… Practice mode works without it.
              </p>
            )}
          </div>
        ) : (
          <div className="create-room-form">
            <h2>Create Room</h2>
            <form onSubmit={handleCreateRoom}>
              {usernameInput}

              <div className="setting-group">
                <label htmlFor="matrix-size">Matrix Size</label>
                <select
                  id="matrix-size"
                  value={matrixSize}
                  onChange={(e) => setMatrixSize(e.target.value as MatrixSize)}
                  className="select"
                >
                  {MATRIX_SIZES.map(size => (
                    <option key={size} value={size}>{SIZE_LABELS[size]}</option>
                  ))}
                </select>
              </div>

              <div className="setting-group">
                <label htmlFor="win-condition">Win Condition</label>
                <select
                  id="win-condition"
                  value={winCondition}
                  onChange={(e) => setWinCondition(e.target.value as WinCondition)}
                  className="select"
                >
                  {WIN_CONDITIONS.map(condition => (
                    <option key={condition} value={condition}>{WIN_LABELS[condition]}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={!connected}>
                  Create
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
