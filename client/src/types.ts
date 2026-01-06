export type MatrixData = number[][];

export interface RowOperation {
  type: 'swap' | 'multiply' | 'add';
  description: string;
  timestamp: number;
}

export interface RoomSettings {
  matrixSize: '3x3' | '4x4' | '5x5' | 'random';
  winCondition: 'single' | 'best-of-3' | 'best-of-5';
}

export interface Player {
  id: string;
  username: string;
  ready: boolean;
  completedAt: number | null;
  wins: number;
  matrixData?: MatrixData;
  history?: RowOperation[];
}

export interface Room {
  id: string;
  hostId: string;
  settings: RoomSettings;
  players: Player[];
  state: 'waiting' | 'countdown' | 'playing' | 'finished';
  countdownStarted: number | null;
  gameStarted: number | null;
  currentRound: number;
  targetMatrix: MatrixData | null;
}
