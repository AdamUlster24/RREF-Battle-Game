import { ROOM_CODE_LENGTH, type Ack, type RoomSettings } from '../../../shared/protocol.js';
import { Room } from './Room.js';

// No 0/O or 1/I: codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerRooms = new Map<string, string>(); // playerId -> roomId

  get roomCount(): number {
    return this.rooms.size;
  }

  createRoom(hostId: string, hostUsername: string, settings: RoomSettings): Room {
    this.leaveRoom(hostId);
    const room = new Room(this.generateRoomId(), hostId, hostUsername, settings);
    this.rooms.set(room.id, room);
    this.playerRooms.set(hostId, room.id);
    return room;
  }

  joinRoom(roomId: string, playerId: string, username: string): Ack {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { ok: false, error: `No room with the code ${roomId}.` };
    }
    if (this.playerRooms.get(playerId) === roomId) {
      return { ok: false, error: 'You are already in this room.' };
    }
    if (room.playerCount >= 2) {
      return { ok: false, error: 'That room is full.' };
    }
    this.leaveRoom(playerId);
    const added = room.addPlayer(playerId, username);
    if (added.ok) {
      this.playerRooms.set(playerId, roomId);
    }
    return added;
  }

  /** Takes a player out of their room. Returns the room if anyone is still in it. */
  leaveRoom(playerId: string): Room | null {
    const room = this.getPlayerRoom(playerId);
    this.playerRooms.delete(playerId);
    if (!room) return null;

    room.removePlayer(playerId);
    if (room.playerCount === 0) {
      this.rooms.delete(room.id);
      return null;
    }
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  private generateRoomId(): string {
    for (;;) {
      let id = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        id += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
      }
      if (!this.rooms.has(id)) return id;
    }
  }
}
