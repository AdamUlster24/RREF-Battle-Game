import { io, Socket } from 'socket.io-client';

// Use environment variable in production, localhost in development
const SOCKET_URL = import.meta.env.PROD 
  ? 'https://rref-battle-game.onrender.com'
  : 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    this.socket = io(SOCKET_URL);
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();
