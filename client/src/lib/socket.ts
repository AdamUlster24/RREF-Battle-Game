import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/protocol.js';

// VITE_SERVER_URL points at a server on another origin. Without it, a production
// build talks to whichever origin served it, and dev talks to the local server.
const url = import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, { autoConnect: false });
