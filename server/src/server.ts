import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './room/RoomManager.js';
import { CommandParser } from './matrix/CommandParser.js';
import { type RoomSettings } from './room/Room.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://rref-battle-game-1.onrender.com"
    ],
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();

// Convert room data for transmission (Map to array)
function serializeRoom(room: any) {
  const data = room.getData();
  return {
    ...data,
    players: Array.from(data.players.values()).map((p: any) => ({
      id: p.id,
      username: p.username,
      ready: p.ready,
      completedAt: p.completedAt,
      wins: p.wins,
      matrixData: p.matrix?.getData(),
      history: p.matrix?.getHistory()
    }))
  };
}

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('create-room', (data: { username: string; settings: RoomSettings }) => {
    const room = roomManager.createRoom(socket.id, data.username, data.settings);
    socket.join(room.getData().id);
    
    socket.emit('room-created', {
      roomId: room.getData().id,
      room: serializeRoom(room)
    });
  });

  // Join an existing room
  socket.on('join-room', (data: { roomId: string; username: string }) => {
    const room = roomManager.joinRoom(data.roomId, socket.id, data.username);
    
    if (room) {
      socket.join(data.roomId);
      io.to(data.roomId).emit('room-updated', serializeRoom(room));
    } else {
      socket.emit('join-error', { message: 'Room not found or full' });
    }
  });

  // Get list of available rooms
  socket.on('list-rooms', () => {
    const rooms = roomManager.getAllRooms()
      .filter(room => room.getData().players.size < 2)
      .map(room => serializeRoom(room));
    
    socket.emit('rooms-list', rooms);
  });

  // Player ready toggle
  socket.on('toggle-ready', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    const player = room.getPlayer(socket.id);
    if (!player) return;

    room.setPlayerReady(socket.id, !player.ready);
    io.to(room.getData().id).emit('room-updated', serializeRoom(room));
  });

  // Start game (host only)
  socket.on('start-game', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    // Only the host can start the game
    if (room.getData().hostId !== socket.id) return;

    // Check if both players are ready
    if (!room.canStart()) return;

    room.startCountdown();
    io.to(room.getData().id).emit('countdown-started', {
      room: serializeRoom(room),
      countdownDuration: 3000
    });

    // Start game after countdown
    setTimeout(() => {
      room.startGame();
      io.to(room.getData().id).emit('game-started', serializeRoom(room));
    }, 3000);
  });

  // Execute a command

  // Execute a command
  socket.on('execute-command', (data: { command: string }) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    const player = room.getPlayer(socket.id);
    if (!player || !player.matrix) return;

    const result = CommandParser.parse(data.command, player.matrix);
    
    if (result.success) {
      const lastOp = player.matrix.getHistory().slice(-1)[0];
      if (!lastOp) return;
      const completed = room.handlePlayerOperation(socket.id, lastOp);
      
      // Send updated matrix to the room
      io.to(room.getData().id).emit('player-updated', {
        playerId: socket.id,
        matrixData: player.matrix.getData(),
        history: player.matrix.getHistory(),
        completed: completed
      });

      if (completed) {
        // Check if round is complete
        const roundResult = room.checkRoundComplete();
        
        if (roundResult.complete) {
          io.to(room.getData().id).emit('round-finished', {
            winner: roundResult.winner,
            room: serializeRoom(room)
          });

          // If match is complete (state is 'finished'), notify
          if (room.getData().state === 'finished') {
            io.to(room.getData().id).emit('match-finished', {
              winner: roundResult.winner,
              room: serializeRoom(room)
            });
          }
        }
      }
    } else {
      socket.emit('command-error', { error: result.error });
    }
  });

  // Undo last operation
  socket.on('undo', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    const player = room.getPlayer(socket.id);
    if (!player || !player.matrix) return;

    if (player.matrix.undo()) {
      // Reset completion status if they undo after completing
      if (player.completedAt) {
        player.completedAt = null;
      }

      io.to(room.getData().id).emit('player-updated', {
        playerId: socket.id,
        matrixData: player.matrix.getData(),
        history: player.matrix.getHistory(),
        completed: false
      });
    }
  });

  // Update room settings (host only)
  socket.on('update-settings', (settings: Partial<RoomSettings>) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    if (room.getData().hostId === socket.id && room.updateSettings(settings)) {
      io.to(room.getData().id).emit('room-updated', serializeRoom(room));
    }
  });

  // Start next round
  socket.on('next-round', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    if (room.getData().state === 'finished') {
      return; // Match is over
    }

    room.resetForNextRound();
    io.to(room.getData().id).emit('room-updated', serializeRoom(room));
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      io.to(room.getData().id).emit('room-updated', serializeRoom(room));
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
