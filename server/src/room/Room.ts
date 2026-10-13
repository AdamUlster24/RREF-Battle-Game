import { Matrix, describeOp } from '../../../shared/matrix.js';
import { parseCommand } from '../../../shared/parser.js';
import {
  REQUIRED_WINS,
  type Ack,
  type RoomSettings,
  type RoomSnapshot,
  type RoomState,
  type RoundResult
} from '../../../shared/protocol.js';

interface Player {
  id: string;
  username: string;
  ready: boolean;
  wins: number;
  matrix: Matrix | null;
}

const MAX_PLAYERS = 2;

/**
 * One two-player match. Holds all game rules and no networking, so every
 * transition can be tested directly; the socket layer only forwards events.
 */
export class Room {
  readonly id: string;
  readonly settings: RoomSettings;
  private hostId: string;
  private players = new Map<string, Player>();
  private state: RoomState = 'waiting';
  private round = 1;
  private startMatrix: Matrix | null = null;
  private roundStartedAt = 0;
  private lastRound: RoundResult | null = null;
  private readonly now: () => number;

  constructor(id: string, hostId: string, hostUsername: string, settings: RoomSettings, now: () => number = Date.now) {
    this.id = id;
    this.settings = settings;
    this.hostId = hostId;
    this.now = now;
    this.addPlayer(hostId, hostUsername);
  }

  get playerCount(): number {
    return this.players.size;
  }

  getState(): RoomState {
    return this.state;
  }

  getRound(): number {
    return this.round;
  }

  addPlayer(playerId: string, username: string): Ack {
    if (this.players.has(playerId)) {
      return { ok: false, error: 'You are already in this room.' };
    }
    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, error: 'That room is full.' };
    }
    this.players.set(playerId, { id: playerId, username, ready: false, wins: 0, matrix: null });
    return { ok: true };
  }

  /**
   * Removes a player. Whoever is left becomes host, and a match in progress
   * is abandoned: the room goes back to waiting with a clean score.
   */
  removePlayer(playerId: string): boolean {
    if (!this.players.delete(playerId)) return false;

    const remaining = this.players.keys().next().value;
    if (this.hostId === playerId && remaining !== undefined) {
      this.hostId = remaining;
    }
    this.resetMatch();
    return true;
  }

  toggleReady(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || this.state !== 'waiting') return false;
    player.ready = !player.ready;
    return true;
  }

  canStart(playerId: string): boolean {
    return (
      playerId === this.hostId &&
      this.state === 'waiting' &&
      this.players.size === MAX_PLAYERS &&
      [...this.players.values()].every(player => player.ready)
    );
  }

  /** Deals the round's matrix to both players. It stays locked until `beginRound`. */
  beginCountdown(): void {
    const [rows, cols] = this.dimensions();
    this.startMatrix = Matrix.random(rows, cols);
    for (const player of this.players.values()) {
      player.matrix = this.startMatrix.clone();
    }
    this.lastRound = null;
    this.state = 'countdown';
  }

  beginRound(): boolean {
    if (this.state !== 'countdown') return false;
    this.state = 'playing';
    this.roundStartedAt = this.now();
    return true;
  }

  /** Runs a typed command for a player. Reaching RREF wins the round on the spot. */
  applyCommand(playerId: string, command: string): Ack {
    const player = this.players.get(playerId);
    if (!player?.matrix || this.state !== 'playing') {
      return { ok: false, error: 'The round is not in play.' };
    }
    const parsed = parseCommand(command, player.matrix.rowCount);
    if (!parsed.ok) {
      return parsed;
    }
    player.matrix.apply(parsed.op);
    if (player.matrix.isRref()) {
      this.finishRound(player);
    }
    return { ok: true };
  }

  undo(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player?.matrix || this.state !== 'playing') return false;
    return player.matrix.undo();
  }

  /** After a round that did not decide the match: back to the ready screen. */
  nextRound(): boolean {
    if (this.state !== 'round-over') return false;
    this.round++;
    this.toWaiting();
    return true;
  }

  /** After a finished match: same players, fresh score. */
  rematch(): boolean {
    if (this.state !== 'finished') return false;
    this.resetMatch();
    return true;
  }

  snapshot(): RoomSnapshot {
    return {
      id: this.id,
      hostId: this.hostId,
      settings: this.settings,
      state: this.state,
      round: this.round,
      requiredWins: REQUIRED_WINS[this.settings.winCondition],
      players: [...this.players.values()].map(player => ({
        id: player.id,
        username: player.username,
        ready: player.ready,
        wins: player.wins,
        matrix: player.matrix?.toStrings() ?? null,
        history: player.matrix?.history().map(describeOp) ?? []
      })),
      startMatrix: this.startMatrix?.toStrings() ?? null,
      lastRound: this.lastRound
    };
  }

  private finishRound(winner: Player): void {
    winner.wins++;
    this.lastRound = { winnerId: winner.id, timeMs: this.now() - this.roundStartedAt };
    this.state = winner.wins >= REQUIRED_WINS[this.settings.winCondition] ? 'finished' : 'round-over';
  }

  private resetMatch(): void {
    this.round = 1;
    this.lastRound = null;
    for (const player of this.players.values()) {
      player.wins = 0;
    }
    this.toWaiting();
  }

  private toWaiting(): void {
    this.state = 'waiting';
    this.startMatrix = null;
    for (const player of this.players.values()) {
      player.ready = false;
      player.matrix = null;
    }
  }

  private dimensions(): [number, number] {
    const size = this.settings.matrixSize === 'random' ? 3 + Math.floor(Math.random() * 3) : Number(this.settings.matrixSize[0]);
    return [size, size];
  }
}
