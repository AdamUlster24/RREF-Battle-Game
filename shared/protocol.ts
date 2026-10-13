/** Everything the client and server agree on: settings, snapshots and socket events. */

export const MATRIX_SIZES = ['3x3', '4x4', '5x5', 'random'] as const;
export const WIN_CONDITIONS = ['single', 'best-of-3', 'best-of-5'] as const;

export type MatrixSize = (typeof MATRIX_SIZES)[number];
export type WinCondition = (typeof WIN_CONDITIONS)[number];

export interface RoomSettings {
  matrixSize: MatrixSize;
  winCondition: WinCondition;
}

export const REQUIRED_WINS: Record<WinCondition, number> = {
  single: 1,
  'best-of-3': 2,
  'best-of-5': 3
};

export const COUNTDOWN_MS = 3000;
export const MAX_USERNAME_LENGTH = 20;
export const MAX_COMMAND_LENGTH = 80;
export const ROOM_CODE_LENGTH = 6;

/**
 * waiting    players ready up; the host starts the round
 * countdown  the matrix is shown but cannot be touched yet
 * playing    first player to reach RREF takes the round
 * round-over a round was won and the match continues
 * finished   someone has the wins the match needs
 */
export type RoomState = 'waiting' | 'countdown' | 'playing' | 'round-over' | 'finished';

/** Matrix entries travel as exact strings such as "3" or "-7/2". */
export type MatrixSnapshot = string[][];

export interface PlayerSnapshot {
  id: string;
  username: string;
  ready: boolean;
  wins: number;
  matrix: MatrixSnapshot | null;
  history: string[];
}

export interface RoundResult {
  winnerId: string;
  timeMs: number;
}

export interface RoomSnapshot {
  id: string;
  hostId: string;
  settings: RoomSettings;
  state: RoomState;
  round: number;
  requiredWins: number;
  players: PlayerSnapshot[];
  /** The matrix both players start the current round from. */
  startMatrix: MatrixSnapshot | null;
  lastRound: RoundResult | null;
}

export type Ack = { ok: true } | { ok: false; error: string };

export interface ClientToServerEvents {
  'create-room': (payload: { username: string; settings: RoomSettings }, ack: (result: Ack) => void) => void;
  'join-room': (payload: { roomId: string; username: string }, ack: (result: Ack) => void) => void;
  'leave-room': () => void;
  'toggle-ready': () => void;
  'start-game': () => void;
  command: (payload: { command: string }, ack: (result: Ack) => void) => void;
  undo: () => void;
  'next-round': () => void;
  rematch: () => void;
}

export interface ServerToClientEvents {
  /** The full room after every change; the client never patches state itself. */
  'room-state': (room: RoomSnapshot) => void;
}
