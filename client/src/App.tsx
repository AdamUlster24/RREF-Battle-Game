import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ack, RoomSettings, RoomSnapshot } from '@shared/protocol.js';
import { socket } from './lib/socket';
import { Home } from './components/Home';
import { GameRoom } from './components/GameRoom';
import { SinglePlayer } from './components/SinglePlayer';
import './App.css';

interface RoomView {
  room: RoomSnapshot;
  /** When the room entered its current state, on the `performance.now()` clock. */
  phaseStartedAt: number;
}

const NOTICE_MS = 4000;

function App() {
  const [view, setView] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [practising, setPractising] = useState(false);
  const [notice, setNotice] = useState('');

  const viewRef = useRef<RoomView | null>(null);
  // A snapshot already in flight when we leave must not put us back in the room.
  const leftRoomId = useRef<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), NOTICE_MS);
  }, []);

  const showRoom = useCallback((next: RoomView | null) => {
    viewRef.current = next;
    setView(next);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setPlayerId(socket.id ?? '');
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
      if (viewRef.current) {
        showRoom(null);
        showNotice('Connection lost. You have been removed from the room.');
      }
    };

    const onRoomState = (room: RoomSnapshot) => {
      if (room.id === leftRoomId.current) return;

      const previous = viewRef.current;
      const sameRoom = previous?.room.id === room.id;
      const samePhase = sameRoom && previous.room.state === room.state && previous.room.round === room.round;
      if (sameRoom && room.players.length < previous.room.players.length) {
        const gone = previous.room.players.find(p => !room.players.some(q => q.id === p.id));
        showNotice(`${gone?.username ?? 'Your opponent'} left the room.`);
      }
      showRoom({ room, phaseStartedAt: samePhase ? previous.phaseStartedAt : performance.now() });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.disconnect();
    };
  }, [showNotice, showRoom]);

  const reportFailure = (result: Ack) => {
    if (!result.ok) showNotice(result.error);
  };

  const handleCreateRoom = (username: string, settings: RoomSettings) => {
    leftRoomId.current = null;
    socket.emit('create-room', { username, settings }, reportFailure);
  };

  const handleJoinRoom = (roomId: string, username: string) => {
    leftRoomId.current = null;
    socket.emit('join-room', { roomId, username }, reportFailure);
  };

  const handleLeave = () => {
    leftRoomId.current = view?.room.id ?? null;
    socket.emit('leave-room');
    showRoom(null);
  };

  return (
    <div className="app">
      {notice && (
        <div className="error-toast" role="alert">
          {notice}
        </div>
      )}

      {view ? (
        <GameRoom
          room={view.room}
          phaseStartedAt={view.phaseStartedAt}
          playerId={playerId}
          onLeave={handleLeave}
        />
      ) : practising ? (
        <SinglePlayer onBack={() => setPractising(false)} />
      ) : (
        <Home
          connected={connected}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onSinglePlayer={() => setPractising(true)}
        />
      )}
    </div>
  );
}

export default App;
