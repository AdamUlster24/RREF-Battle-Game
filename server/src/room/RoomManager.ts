import { Room, type RoomSettings } from './Room.js';

export class RoomManager {
  private rooms: Map<string, Room>;
  private playerRooms: Map<string, string>; // playerId -> roomId

  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map();
  }

  createRoom(hostId: string, hostUsername: string, settings: RoomSettings): Room {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, hostId, hostUsername, settings);
    
    this.rooms.set(roomId, room);
    this.playerRooms.set(hostId, roomId);

    return room;
  }

  joinRoom(roomId: string, playerId: string, username: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    if (room.addPlayer(playerId, username)) {
      this.playerRooms.set(playerId, roomId);
      return room;
    }

    return null;
  }

  leaveRoom(playerId: string): Room | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    // If room is empty, delete it
    if (room.getData().players.size === 0) {
      this.rooms.delete(roomId);
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

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  private generateRoomId(): string {
    // Generate a 6-character room code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Ensure uniqueness
    if (this.rooms.has(id)) {
      return this.generateRoomId();
    }

    return id;
  }
}
