import { Matrix, type MatrixData, type Operation } from '../matrix/Matrix.js';

export interface RoomSettings {
  matrixSize: '3x3' | '4x4' | '5x5' | 'random';
  winCondition: 'single' | 'best-of-3' | 'best-of-5';
}

export interface PlayerData {
  id: string;
  username: string;
  ready: boolean;
  matrix: Matrix | null;
  completedAt: number | null;
  wins: number;
}

export interface RoomData {
  id: string;
  hostId: string;
  settings: RoomSettings;
  players: Map<string, PlayerData>;
  state: 'waiting' | 'countdown' | 'playing' | 'finished';
  countdownStarted: number | null;
  gameStarted: number | null;
  currentRound: number;
  targetMatrix: MatrixData | null;
}

export class Room {
  private data: RoomData;
  private maxPlayers = 2;

  constructor(id: string, hostId: string, hostUsername: string, settings: RoomSettings) {
    this.data = {
      id,
      hostId,
      settings,
      players: new Map(),
      state: 'waiting',
      countdownStarted: null,
      gameStarted: null,
      currentRound: 1,
      targetMatrix: null
    };

    // Add host as first player
    this.addPlayer(hostId, hostUsername);
  }

  addPlayer(playerId: string, username: string): boolean {
    if (this.data.players.size >= this.maxPlayers) {
      return false;
    }

    if (this.data.players.has(playerId)) {
      return false;
    }

    this.data.players.set(playerId, {
      id: playerId,
      username,
      ready: false,
      matrix: null,
      completedAt: null,
      wins: 0
    });

    return true;
  }

  removePlayer(playerId: string): boolean {
    return this.data.players.delete(playerId);
  }

  getPlayer(playerId: string): PlayerData | undefined {
    return this.data.players.get(playerId);
  }

  setPlayerReady(playerId: string, ready: boolean): boolean {
    const player = this.data.players.get(playerId);
    if (!player) return false;

    player.ready = ready;
    return true;
  }

  canStart(): boolean {
    return (
      this.data.players.size === this.maxPlayers &&
      Array.from(this.data.players.values()).every(p => p.ready) &&
      this.data.state === 'waiting'
    );
  }

  startCountdown(): void {
    this.data.state = 'countdown';
    this.data.countdownStarted = Date.now();

    // Generate the target matrix
    const [rows, cols] = this.getMatrixDimensions();
    const matrix = Matrix.generateRandom(rows, cols);
    this.data.targetMatrix = matrix.getData();

    // Initialize each player with a copy of the matrix
    this.data.players.forEach(player => {
      player.matrix = new Matrix(this.data.targetMatrix!);
      player.completedAt = null;
    });
  }

  startGame(): void {
    this.data.state = 'playing';
    this.data.gameStarted = Date.now();
  }

  getMatrixDimensions(): [number, number] {
    if (this.data.settings.matrixSize === 'random') {
      const sizes = ['3x3', '4x4', '5x5'];
      const randomSize = sizes[Math.floor(Math.random() * sizes.length)]!;
      return this.parseDimensions(randomSize);
    }
    return this.parseDimensions(this.data.settings.matrixSize);
  }

  private parseDimensions(size: string): [number, number] {
    const parts = size.split('x').map(Number);
    return [parts[0]!, parts[1]!];
  }

  handlePlayerOperation(playerId: string, operation: Operation): boolean {
    const player = this.data.players.get(playerId);
    if (!player || !player.matrix || this.data.state !== 'playing') {
      return false;
    }

    // The operation has already been applied to the matrix
    // Check if player completed RREF
    if (player.matrix.isInRREF() && !player.completedAt) {
      player.completedAt = Date.now();
      return true;
    }

    return false;
  }

  checkRoundComplete(): { complete: boolean; winner?: string } {
    const players = Array.from(this.data.players.values());
    const completedPlayers = players.filter(p => p.completedAt !== null);

    if (completedPlayers.length === 0) {
      return { complete: false };
    }

    // Find the fastest player
    const winner = completedPlayers.reduce((fastest, current) =>
      (current.completedAt! < fastest.completedAt!) ? current : fastest
    );

    // Award win
    winner.wins++;

    // Check if match is complete
    const maxWins = this.getRequiredWins();
    if (winner.wins >= maxWins) {
      this.data.state = 'finished';
      return { complete: true, winner: winner.id };
    }

    return { complete: true, winner: winner.id };
  }

  getRequiredWins(): number {
    switch (this.data.settings.winCondition) {
      case 'single': return 1;
      case 'best-of-3': return 2;
      case 'best-of-5': return 3;
      default: return 1;
    }
  }

  resetForNextRound(): void {
    this.data.currentRound++;
    this.data.state = 'waiting';
    this.data.countdownStarted = null;
    this.data.gameStarted = null;
    this.data.targetMatrix = null;

    this.data.players.forEach(player => {
      player.ready = false;
      player.matrix = null;
      player.completedAt = null;
    });
  }

  getData(): RoomData {
    return this.data;
  }

  updateSettings(settings: Partial<RoomSettings>): boolean {
    if (this.data.state !== 'waiting') {
      return false;
    }

    this.data.settings = { ...this.data.settings, ...settings };
    return true;
  }
}
