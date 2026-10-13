import { describe, expect, it } from 'vitest';
import { Matrix } from '../../shared/matrix.js';
import type { RoomSettings, RoomSnapshot } from '../../shared/protocol.js';
import { Room } from '../src/room/Room.js';
import { RoomManager } from '../src/room/RoomManager.js';
import { toCommand } from './helpers.js';

const HOST = 'host';
const GUEST = 'guest';

/** The commands that take a player's current matrix all the way to RREF. */
function solution(room: Room, playerId: string): string[] {
  const matrix = room.snapshot().players.find(player => player.id === playerId)!.matrix!;
  return Matrix.fromStrings(matrix).reduced().history().map(toCommand);
}

function newRoom(winCondition: RoomSettings['winCondition'] = 'single', clock = { now: 0 }) {
  const room = new Room('ROOM01', HOST, 'Ada', { matrixSize: '3x3', winCondition }, () => clock.now);
  expect(room.addPlayer(GUEST, 'Emmy')).toEqual({ ok: true });
  return { room, clock };
}

function startRound(room: Room) {
  room.toggleReady(HOST);
  room.toggleReady(GUEST);
  expect(room.canStart(HOST)).toBe(true);
  room.beginCountdown();
  expect(room.beginRound()).toBe(true);
}

function winRound(room: Room, playerId: string) {
  for (const command of solution(room, playerId)) {
    expect(room.applyCommand(playerId, command)).toEqual({ ok: true });
  }
}

const player = (snapshot: RoomSnapshot, id: string) => snapshot.players.find(p => p.id === id)!;

describe('lobby', () => {
  it('holds two players and no more', () => {
    const { room } = newRoom();
    expect(room.addPlayer('third', 'Carl')).toEqual({ ok: false, error: 'That room is full.' });
    expect(room.addPlayer(GUEST, 'Emmy')).toEqual({ ok: false, error: 'You are already in this room.' });
    expect(room.playerCount).toBe(2);
  });

  it('only lets the host start, and only once both players are ready', () => {
    const { room } = newRoom();
    expect(room.canStart(HOST)).toBe(false);
    room.toggleReady(HOST);
    expect(room.canStart(HOST)).toBe(false);
    room.toggleReady(GUEST);
    expect(room.canStart(GUEST)).toBe(false);
    expect(room.canStart(HOST)).toBe(true);
  });

  it('cannot start with one player', () => {
    const room = new Room('ROOM01', HOST, 'Ada', { matrixSize: '3x3', winCondition: 'single' });
    room.toggleReady(HOST);
    expect(room.canStart(HOST)).toBe(false);
  });
});

describe('a round', () => {
  it('deals both players the same unsolved matrix', () => {
    const { room } = newRoom();
    startRound(room);
    const snapshot = room.snapshot();
    expect(snapshot.state).toBe('playing');
    expect(snapshot.startMatrix).toHaveLength(3);
    expect(player(snapshot, HOST).matrix).toEqual(snapshot.startMatrix);
    expect(player(snapshot, GUEST).matrix).toEqual(snapshot.startMatrix);
    expect(Matrix.fromStrings(snapshot.startMatrix!).isRref()).toBe(false);
  });

  it('keeps the matrix locked during the countdown', () => {
    const { room } = newRoom();
    room.toggleReady(HOST);
    room.toggleReady(GUEST);
    room.beginCountdown();
    const before = room.snapshot();
    expect(room.applyCommand(HOST, 'R1 <> R2').ok).toBe(false);
    expect(room.undo(HOST)).toBe(false);
    expect(room.snapshot()).toEqual(before);
  });

  it('reports bad commands without touching the matrix', () => {
    const { room } = newRoom();
    startRound(room);
    const before = room.snapshot();
    expect(room.applyCommand(HOST, 'R1 = R2')).toMatchObject({ ok: false });
    expect(room.applyCommand(HOST, 'R1 <> R7')).toMatchObject({ ok: false });
    expect(room.applyCommand('stranger', 'R1 <> R2')).toMatchObject({ ok: false });
    expect(room.snapshot()).toEqual(before);
  });

  it('records history per player and undoes it', () => {
    const { room } = newRoom();
    startRound(room);
    room.applyCommand(HOST, 'R1 <> R2');
    room.applyCommand(HOST, 'R1 = 2R1');
    let snapshot = room.snapshot();
    expect(player(snapshot, HOST).history).toEqual(['R1 ↔ R2', 'R1 → 2R1']);
    expect(player(snapshot, GUEST).history).toEqual([]);
    expect(player(snapshot, GUEST).matrix).toEqual(snapshot.startMatrix);

    expect(room.undo(HOST)).toBe(true);
    expect(room.undo(HOST)).toBe(true);
    expect(room.undo(HOST)).toBe(false);
    snapshot = room.snapshot();
    expect(player(snapshot, HOST).matrix).toEqual(snapshot.startMatrix);
  });

  it('is won by the first player to reach RREF, with their time', () => {
    const { room, clock } = newRoom();
    clock.now = 1_000;
    startRound(room);
    clock.now = 43_500;
    winRound(room, GUEST);

    const snapshot = room.snapshot();
    expect(snapshot.state).toBe('finished');
    expect(snapshot.lastRound).toEqual({ winnerId: GUEST, timeMs: 42_500 });
    expect(player(snapshot, GUEST).wins).toBe(1);
    expect(player(snapshot, HOST).wins).toBe(0);
  });

  it('stops accepting moves once it is won', () => {
    const { room } = newRoom('best-of-3');
    startRound(room);
    const hostMoves = solution(room, HOST);
    winRound(room, GUEST);
    expect(room.getState()).toBe('round-over');

    // The loser finishing afterwards must not move the score.
    for (const command of hostMoves) {
      expect(room.applyCommand(HOST, command).ok).toBe(false);
    }
    expect(room.undo(GUEST)).toBe(false);
    const snapshot = room.snapshot();
    expect(player(snapshot, GUEST).wins).toBe(1);
    expect(player(snapshot, HOST).wins).toBe(0);
  });
});

describe('a match', () => {
  it('plays best of 3 to two wins', () => {
    const { room } = newRoom('best-of-3');
    expect(room.snapshot().requiredWins).toBe(2);

    startRound(room);
    winRound(room, HOST);
    expect(room.getState()).toBe('round-over');
    expect(room.rematch()).toBe(false);

    expect(room.nextRound()).toBe(true);
    expect(room.getState()).toBe('waiting');
    expect(room.getRound()).toBe(2);
    expect(room.snapshot().players.every(p => !p.ready && p.matrix === null)).toBe(true);

    startRound(room);
    winRound(room, GUEST);
    expect(room.getState()).toBe('round-over');
    room.nextRound();

    startRound(room);
    winRound(room, HOST);
    const snapshot = room.snapshot();
    expect(snapshot.state).toBe('finished');
    expect(snapshot.round).toBe(3);
    expect(player(snapshot, HOST).wins).toBe(2);
    expect(player(snapshot, GUEST).wins).toBe(1);
    expect(room.nextRound()).toBe(false);
  });

  it('can be replayed with a clean score', () => {
    const { room } = newRoom();
    startRound(room);
    winRound(room, HOST);
    expect(room.rematch()).toBe(true);
    const snapshot = room.snapshot();
    expect(snapshot).toMatchObject({ state: 'waiting', round: 1, lastRound: null, startMatrix: null });
    expect(snapshot.players.map(p => p.wins)).toEqual([0, 0]);
  });

  it('is abandoned when a player leaves, and the other becomes host', () => {
    const { room } = newRoom('best-of-3');
    startRound(room);
    winRound(room, HOST);
    room.nextRound();
    startRound(room);

    expect(room.removePlayer(HOST)).toBe(true);
    const snapshot = room.snapshot();
    expect(snapshot).toMatchObject({ state: 'waiting', round: 1, hostId: GUEST });
    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.players[0]).toMatchObject({ id: GUEST, wins: 0, ready: false, matrix: null });
    expect(room.beginRound()).toBe(false);
    expect(room.removePlayer(HOST)).toBe(false);
  });
});

describe('RoomManager', () => {
  const settings: RoomSettings = { matrixSize: '4x4', winCondition: 'single' };

  it('creates rooms with unambiguous six-character codes', () => {
    const manager = new RoomManager();
    const codes = new Set(Array.from({ length: 200 }, (_, i) => manager.createRoom(`p${i}`, 'Ada', settings).id));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('explains why a join failed', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(HOST, 'Ada', settings);
    expect(manager.joinRoom('NOPE22', GUEST, 'Emmy')).toEqual({ ok: false, error: 'No room with the code NOPE22.' });
    expect(manager.joinRoom(room.id, HOST, 'Ada')).toEqual({ ok: false, error: 'You are already in this room.' });
    expect(manager.joinRoom(room.id, GUEST, 'Emmy')).toEqual({ ok: true });
    expect(manager.joinRoom(room.id, 'third', 'Carl')).toEqual({ ok: false, error: 'That room is full.' });
    expect(manager.getPlayerRoom('third')).toBeUndefined();
  });

  it('deletes a room when the last player leaves', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(HOST, 'Ada', settings);
    manager.joinRoom(room.id, GUEST, 'Emmy');
    expect(manager.leaveRoom(HOST)).toBe(room);
    expect(manager.roomCount).toBe(1);
    expect(manager.leaveRoom(GUEST)).toBeNull();
    expect(manager.roomCount).toBe(0);
    expect(manager.getRoom(room.id)).toBeUndefined();
    expect(manager.leaveRoom(GUEST)).toBeNull();
  });

  it('moves a player who creates a second room out of the first', () => {
    const manager = new RoomManager();
    const first = manager.createRoom(HOST, 'Ada', settings);
    const second = manager.createRoom(HOST, 'Ada', settings);
    expect(manager.getRoom(first.id)).toBeUndefined();
    expect(manager.getPlayerRoom(HOST)).toBe(second);
  });
});
