import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  COUNTDOWN_MS,
  MATRIX_SIZES,
  MAX_COMMAND_LENGTH,
  MAX_USERNAME_LENGTH,
  WIN_CONDITIONS,
  type Ack,
  type ClientToServerEvents,
  type RoomSettings,
  type ServerToClientEvents
} from '../../shared/protocol.js';
import type { Room } from './room/Room.js';
import { RoomManager } from './room/RoomManager.js';

export interface GameServerOptions {
  /** Browser origins allowed to connect when the client is hosted elsewhere. */
  origins?: string[];
  countdownMs?: number;
  /** A built client to serve from the same origin, if the directory exists. */
  clientDir?: string;
}

export interface GameServer {
  httpServer: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  rooms: RoomManager;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Payloads come from the network, so nothing about their shape is trusted.

function readUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().slice(0, MAX_USERNAME_LENGTH);
  return username || null;
}

function readSettings(value: unknown): RoomSettings | null {
  const settings = value as Partial<RoomSettings> | null;
  if (
    !settings ||
    !MATRIX_SIZES.includes(settings.matrixSize as RoomSettings['matrixSize']) ||
    !WIN_CONDITIONS.includes(settings.winCondition as RoomSettings['winCondition'])
  ) {
    return null;
  }
  return { matrixSize: settings.matrixSize!, winCondition: settings.winCondition! };
}

function reply(ack: unknown, result: Ack): void {
  if (typeof ack === 'function') ack(result);
}

export function createGameServer(options: GameServerOptions = {}): GameServer {
  const { origins = ['http://localhost:5173'], countdownMs = COUNTDOWN_MS, clientDir } = options;

  const rooms = new RoomManager();
  const countdowns = new Map<string, NodeJS.Timeout>();

  const app = express();
  app.use(cors({ origin: origins }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.roomCount });
  });
  if (clientDir && existsSync(clientDir)) {
    app.use(express.static(clientDir));
  }

  const httpServer = createServer(app);
  const io: GameServer['io'] = new Server(httpServer, { cors: { origin: origins, methods: ['GET', 'POST'] } });

  const broadcast = (room: Room) => io.to(room.id).emit('room-state', room.snapshot());

  const leave = (socket: GameSocket) => {
    const previous = rooms.getPlayerRoom(socket.id);
    if (!previous) return;

    clearTimeout(countdowns.get(previous.id));
    countdowns.delete(previous.id);
    void socket.leave(previous.id);

    const remaining = rooms.leaveRoom(socket.id);
    if (remaining) broadcast(remaining);
  };

  io.on('connection', socket => {
    socket.on('create-room', (payload, ack) => {
      const username = readUsername(payload?.username);
      const settings = readSettings(payload?.settings);
      if (!username || !settings) {
        return reply(ack, { ok: false, error: 'Enter a username and pick valid settings.' });
      }
      leave(socket);
      const room = rooms.createRoom(socket.id, username, settings);
      void socket.join(room.id);
      reply(ack, { ok: true });
      broadcast(room);
    });

    socket.on('join-room', (payload, ack) => {
      const username = readUsername(payload?.username);
      const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
      if (!username || !roomId) {
        return reply(ack, { ok: false, error: 'Enter a username and a room code.' });
      }
      if (rooms.getPlayerRoom(socket.id)?.id !== roomId) {
        leave(socket);
      }
      const joined = rooms.joinRoom(roomId, socket.id, username);
      reply(ack, joined);
      if (joined.ok) {
        void socket.join(roomId);
        broadcast(rooms.getRoom(roomId)!);
      }
    });

    socket.on('leave-room', () => leave(socket));
    socket.on('disconnect', () => leave(socket));

    socket.on('toggle-ready', () => {
      const room = rooms.getPlayerRoom(socket.id);
      if (room?.toggleReady(socket.id)) broadcast(room);
    });

    socket.on('start-game', () => {
      const room = rooms.getPlayerRoom(socket.id);
      if (!room?.canStart(socket.id)) return;

      room.beginCountdown();
      broadcast(room);
      countdowns.set(
        room.id,
        setTimeout(() => {
          countdowns.delete(room.id);
          if (room.beginRound()) broadcast(room);
        }, countdownMs)
      );
    });

    socket.on('command', (payload, ack) => {
      const room = rooms.getPlayerRoom(socket.id);
      const command = payload?.command;
      if (!room || typeof command !== 'string' || command.length > MAX_COMMAND_LENGTH) {
        return reply(ack, { ok: false, error: 'That command could not be run.' });
      }
      const result = room.applyCommand(socket.id, command);
      reply(ack, result);
      if (result.ok) broadcast(room);
    });

    socket.on('undo', () => {
      const room = rooms.getPlayerRoom(socket.id);
      if (room?.undo(socket.id)) broadcast(room);
    });

    socket.on('next-round', () => {
      const room = rooms.getPlayerRoom(socket.id);
      if (room?.nextRound()) broadcast(room);
    });

    socket.on('rematch', () => {
      const room = rooms.getPlayerRoom(socket.id);
      if (room?.rematch()) broadcast(room);
    });
  });

  return { httpServer, io, rooms };
}
