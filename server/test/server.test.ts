import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Matrix } from '../../shared/matrix.js';
import type { Ack, ClientToServerEvents, RoomSnapshot, ServerToClientEvents } from '../../shared/protocol.js';
import { createGameServer, type GameServer } from '../src/app.js';
import { toCommand } from './helpers.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A connected player that remembers the latest room snapshot it was sent. */
class TestClient {
  readonly socket: ClientSocket;
  room: RoomSnapshot | null = null;
  private waiters: { test: (room: RoomSnapshot) => boolean; resolve: (room: RoomSnapshot) => void }[] = [];

  constructor(url: string) {
    this.socket = connect(url, { transports: ['websocket'], forceNew: true });
    this.socket.on('room-state', room => {
      this.room = room;
      this.waiters = this.waiters.filter(waiter => {
        if (!waiter.test(room)) return true;
        waiter.resolve(room);
        return false;
      });
    });
  }

  get id(): string {
    return this.socket.id!;
  }

  connected(): Promise<void> {
    return new Promise(resolve => this.socket.once('connect', () => resolve()));
  }

  /** Resolves with the first snapshot (current or future) that satisfies `test`. */
  until(test: (room: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
    if (this.room && test(this.room)) return Promise.resolve(this.room);
    return new Promise(resolve => this.waiters.push({ test, resolve }));
  }

  create(settings: RoomSnapshot['settings'], username = 'Ada'): Promise<Ack> {
    return new Promise(resolve => this.socket.emit('create-room', { username, settings }, resolve));
  }

  join(roomId: string, username = 'Emmy'): Promise<Ack> {
    return new Promise(resolve => this.socket.emit('join-room', { roomId, username }, resolve));
  }

  command(command: string): Promise<Ack> {
    return new Promise(resolve => this.socket.emit('command', { command }, resolve));
  }

  me(): RoomSnapshot['players'][number] {
    return this.room!.players.find(player => player.id === this.id)!;
  }

  async solve(): Promise<void> {
    for (const op of Matrix.fromStrings(this.me().matrix!).reduced().history()) {
      expect(await this.command(toCommand(op))).toEqual({ ok: true });
    }
  }
}

describe('game server', () => {
  let server: GameServer;
  let url: string;
  let clients: TestClient[];

  beforeEach(async () => {
    server = createGameServer({ countdownMs: 20 });
    await new Promise<void>(resolve => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) client.socket.disconnect();
    await server.io.close();
  });

  async function player(): Promise<TestClient> {
    const client = new TestClient(url);
    clients.push(client);
    await client.connected();
    return client;
  }

  /** Two players in one room, both ready, with the round under way. */
  async function startedMatch(winCondition: RoomSnapshot['settings']['winCondition']) {
    const host = await player();
    const guest = await player();
    await host.create({ matrixSize: '3x3', winCondition });
    const { id } = await host.until(() => true);
    expect(await guest.join(id)).toEqual({ ok: true });
    await ready(host, guest);
    return { host, guest };
  }

  async function ready(host: TestClient, guest: TestClient) {
    await host.until(room => room.state === 'waiting' && room.players.length === 2);
    host.socket.emit('toggle-ready');
    guest.socket.emit('toggle-ready');
    await host.until(room => room.players.every(p => p.ready));
    host.socket.emit('start-game');
    await Promise.all([host.until(room => room.state === 'playing'), guest.until(room => room.state === 'playing')]);
  }

  it('answers the health check', async () => {
    const response = await fetch(`${url}/health`);
    expect(await response.json()).toEqual({ ok: true, rooms: 0 });
  });

  it('plays a best-of-3 match from lobby to result', async () => {
    const { host, guest } = await startedMatch('best-of-3');
    expect(guest.me().matrix).toEqual(host.me().matrix);

    await host.solve();
    let room = await guest.until(r => r.state === 'round-over');
    expect(room.lastRound?.winnerId).toBe(host.id);
    expect(await guest.command('R1 <> R2')).toMatchObject({ ok: false });

    guest.socket.emit('next-round');
    await ready(host, guest);
    expect(host.room!.round).toBe(2);

    await host.solve();
    room = await guest.until(r => r.state === 'finished');
    expect(room.players.find(p => p.id === host.id)!.wins).toBe(2);
    expect(room.players.find(p => p.id === guest.id)!.wins).toBe(0);

    guest.socket.emit('rematch');
    room = await host.until(r => r.state === 'waiting');
    expect(room.players.map(p => p.wins)).toEqual([0, 0]);
  });

  it('shows each player the other one\'s progress', async () => {
    const { host, guest } = await startedMatch('single');
    expect(await host.command('R1 <> R2')).toEqual({ ok: true });
    const room = await guest.until(r => r.players.some(p => p.history.length === 1));
    const seen = room.players.find(p => p.id === host.id)!;
    expect(seen.history).toEqual(['R1 ↔ R2']);
    expect(seen.matrix).toEqual(host.me().matrix);

    host.socket.emit('undo');
    await guest.until(r => r.players.every(p => p.history.length === 0));
  });

  it('rejects commands until the countdown is over', async () => {
    await server.io.close();
    server = createGameServer({ countdownMs: 60_000 });
    await new Promise<void>(resolve => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;

    const host = await player();
    const guest = await player();
    await host.create({ matrixSize: '3x3', winCondition: 'single' });
    await guest.join((await host.until(() => true)).id);
    await host.until(room => room.players.length === 2);
    host.socket.emit('toggle-ready');
    guest.socket.emit('toggle-ready');
    await host.until(room => room.players.every(p => p.ready));
    host.socket.emit('start-game');
    const room = await host.until(r => r.state === 'countdown');

    expect(room.startMatrix).not.toBeNull();
    expect(await host.command('R1 <> R2')).toMatchObject({ ok: false });
    expect(host.me().history).toEqual([]);
  });

  it('reports join problems to the player who caused them', async () => {
    const host = await player();
    const guest = await player();
    const third = await player();
    await host.create({ matrixSize: '3x3', winCondition: 'single' });
    const { id } = await host.until(() => true);

    expect(await guest.join('ZZZZZZ')).toMatchObject({ ok: false, error: 'No room with the code ZZZZZZ.' });
    expect(await guest.join(id.toLowerCase())).toEqual({ ok: true });
    expect(await third.join(id)).toMatchObject({ ok: false, error: 'That room is full.' });
    expect(await guest.join(id, '   ')).toMatchObject({ ok: false });
  });

  it('abandons the round and hands over the room when the host leaves', async () => {
    const { host, guest } = await startedMatch('best-of-5');
    const guestId = guest.id;
    host.socket.emit('leave-room');
    const room = await guest.until(r => r.players.length === 1);
    expect(room).toMatchObject({ state: 'waiting', hostId: guestId, round: 1 });

    // The room is joinable again, and the player who left can make a new one.
    const newcomer = await player();
    expect(await newcomer.join(room.id)).toEqual({ ok: true });
    expect(await host.create({ matrixSize: '5x5', winCondition: 'single' })).toEqual({ ok: true });
    expect(server.rooms.roomCount).toBe(2);
  });

  it('cleans up when players disconnect', async () => {
    const { host, guest } = await startedMatch('single');
    host.socket.disconnect();
    await guest.until(r => r.players.length === 1);
    guest.socket.disconnect();
    await expect.poll(() => server.rooms.roomCount).toBe(0);
  });

  it('survives malformed payloads', async () => {
    const client = await player();
    const raw = client.socket as unknown as { emit: (event: string, ...args: unknown[]) => void };
    raw.emit('create-room');
    raw.emit('create-room', null, 'not a function');
    raw.emit('create-room', { username: 42, settings: { matrixSize: '99x99', winCondition: 'single' } });
    raw.emit('join-room', { roomId: { nested: true } });
    raw.emit('command', undefined);
    raw.emit('command', { command: 'R1 <> R2'.repeat(100) });
    raw.emit('start-game', 'unexpected');
    raw.emit('undo');

    expect(await client.create({ matrixSize: '99x99' as '3x3', winCondition: 'single' })).toMatchObject({ ok: false });
    expect(await client.create({ matrixSize: '3x3', winCondition: 'single' }, 'x'.repeat(50))).toEqual({ ok: true });
    const room = await client.until(() => true);
    expect(room.players[0]!.username).toHaveLength(20);
  });
});
