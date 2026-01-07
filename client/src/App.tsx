import { useState, useEffect } from 'react';
import socketService from './services/socket';
import { Home } from './components/Home';
import { GameRoom } from './components/GameRoom';
import { SinglePlayer } from './components/SinglePlayer';
import type { Room, RoomSettings } from './types';
import './App.css';

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<'menu' | 'single' | 'multi'>('menu');

  useEffect(() => {
    const socket = socketService.connect();
    setCurrentPlayerId(socket.id!);

    socket.on('connect', () => {
      setCurrentPlayerId(socket.id!);
    });

    socket.on('room-created', (data: { roomId: string; room: Room }) => {
      setRoom(data.room);
      setError('');
    });

    socket.on('room-updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('join-error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('countdown-started', (data: { room: Room }) => {
      setRoom(data.room);
    });

    socket.on('game-started', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('player-updated', (data: { playerId: string; matrixData: number[][]; history: any[] }) => {
      setRoom(prevRoom => {
        if (!prevRoom) return null;
        
        const updatedPlayers = prevRoom.players.map(player => 
          player.id === data.playerId
            ? { ...player, matrixData: data.matrixData, history: data.history }
            : player
        );

        return { ...prevRoom, players: updatedPlayers };
      });
    });

    socket.on('round-finished', (data: { winner: string; room: Room }) => {
      setRoom(data.room);
      // Could add notification here
    });

    socket.on('match-finished', (data: { winner: string; room: Room }) => {
      setRoom(data.room);
    });

    socket.on('command-error', (data: { error: string }) => {
      setError(data.error);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleCreateRoom = (username: string, settings: RoomSettings) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('create-room', { username, settings });
    }
  };

  const handleJoinRoom = (roomId: string, username: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('join-room', { roomId, username });
    }
  };

  const handleExecuteCommand = (command: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('execute-command', { command });
    }
  };

  const handleUndo = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('undo');
    }
  };

  const handleToggleReady = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('toggle-ready');
    }
  };

  const handleStartGame = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('start-game');
    }
  };

  const handleLeave = () => {
    setRoom(null);
    setError('');
    setMode('menu');
  };

  const handleBackToMenu = () => {
    setMode('menu');
    setRoom(null);
    setError('');
  };

  const handleSinglePlayer = () => {
    setMode('single');
  };

  const handleNextRound = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('next-round');
    }
  };

  return (
    <div className="app">
      {error && (
        <div className="error-toast">
          {error}
        </div>
      )}

      {mode === 'menu' && (
        <Home 
          onCreateRoom={(username, settings) => {
            setMode('multi');
            handleCreateRoom(username, settings);
          }}
          onJoinRoom={(roomId, username) => {
            setMode('multi');
            handleJoinRoom(roomId, username);
          }}
          onSinglePlayer={handleSinglePlayer}
        />
      )}

      {mode === 'single' && (
        <SinglePlayer onBack={handleBackToMenu} />
      )}

      {mode === 'multi' && room && (
        <GameRoom
          room={room}
          currentPlayerId={currentPlayerId}
          onExecuteCommand={handleExecuteCommand}
          onUndo={handleUndo}
          onToggleReady={handleToggleReady}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
          onNextRound={handleNextRound}
        />
      )}
    </div>
  );
}

export default App;
