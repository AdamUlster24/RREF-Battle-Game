import { useState } from 'react';
import type { RoomSettings } from '../types';
import './Home.css';

interface HomeProps {
  onCreateRoom: (username: string, settings: RoomSettings) => void;
  onJoinRoom: (roomId: string, username: string) => void;
  onSinglePlayer: () => void;
}

export function Home({ onCreateRoom, onJoinRoom, onSinglePlayer }: HomeProps) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [matrixSize, setMatrixSize] = useState<'3x3' | '4x4' | '5x5' | 'random'>('3x3');
  const [winCondition, setWinCondition] = useState<'single' | 'best-of-3' | 'best-of-5'>('single');

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

            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Multiplayer - Create Room
            </button>
            
            <div className="divider">
              <span>or</span>
            </div>

            <form onSubmit={handleJoinRoom} className="join-form">
              <input
                type="text"
                placeholder="Your Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                required
                className="input"
              />
              <input
                type="text"
                placeholder="Room Code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                required
                className="input"
              />
              <button type="submit" className="btn btn-secondary">
                Join Room
              </button>
            </form>
          </div>
        ) : (
          <div className="create-room-form">
            <h2>Create Room</h2>
            <form onSubmit={handleCreateRoom}>
              <input
                type="text"
                placeholder="Your Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                required
                className="input"
              />

              <div className="setting-group">
                <label>Matrix Size</label>
                <select 
                  value={matrixSize} 
                  onChange={(e) => setMatrixSize(e.target.value as any)}
                  className="select"
                >
                  <option value="3x3">3×3</option>
                  <option value="4x4">4×4</option>
                  <option value="5x5">5×5</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Win Condition</label>
                <select 
                  value={winCondition} 
                  onChange={(e) => setWinCondition(e.target.value as any)}
                  className="select"
                >
                  <option value="single">Single Battle</option>
                  <option value="best-of-3">Best of 3</option>
                  <option value="best-of-5">Best of 5</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
                  Back
                </button>
                <button type="submit" className="btn btn-primary">
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
