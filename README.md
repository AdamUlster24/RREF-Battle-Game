# RREF Battle Game

A competitive online multiplayer game where players race to put matrices into Reduced Row Echelon Form (RREF).

## Game Overview

Two players compete head-to-head to solve the same matrix using elementary row operations. The first player to correctly put the matrix into RREF wins! Practice your linear algebra skills while having fun.

## Features

- **Real-time Multiplayer**: WebSocket-based gameplay for instant synchronization
- **Command-Line Style Input**: Execute operations like `R1 <-> R2`, `3*R1 -> R1`, or `R1 + 2*R2 -> R1`
- **Operation History**: Track all your row operations with undo functionality
- **Live Timer**: See how long you're taking in real-time
- **Configurable Settings**:
  - Matrix sizes: 3×3, 4×4, 5×5, or random
  - Win conditions: Single battle, Best of 3, or Best of 5
- **Room System**: Create private rooms with unique codes or join existing ones
- **Countdown**: 3-second countdown with matrix preview before each battle
- **Anonymous Play**: No account required - just enter a username and play

## Tech Stack

### Backend
- **Node.js** with **Express**
- **Socket.io** for real-time communication
- **TypeScript** for type safety
- Custom matrix RREF validation engine

### Frontend
- **React** with **TypeScript**
- **Vite** for fast development
- **Socket.io-client** for real-time updates
- Custom CSS with gradient styling

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. **Clone the repository and navigate to the directory**

2. **Install backend dependencies**:
```bash
cd server
npm install
```

3. **Install frontend dependencies**:
```bash
cd ../client
npm install
```

### Running the Application

1. **Start the backend server** (from the `server` directory):
```bash
npm run dev
```
The server will run on `http://localhost:3001`

2. **Start the frontend** (from the `client` directory):
```bash
npm run dev
```
The client will run on `http://localhost:5173`

3. **Open your browser** and navigate to `http://localhost:5173`

## How to Play

### Creating a Room
1. Enter your username
2. Click "Create Room"
3. Configure your desired settings:
   - Matrix size (3×3, 4×4, 5×5, or random)
   - Win condition (single battle, best of 3, or best of 5)
4. Share the room code with your opponent

### Joining a Room
1. Enter your username
2. Enter the room code
3. Click "Join Room"

### Playing the Game
1. Both players click "Ready" when they're prepared
2. The host clicks "Start Game" to begin
3. A 3-second countdown will begin, showing the matrix to solve
4. When the game starts, use commands to perform row operations:
   - **Swap rows**: `R1 <> R2` (swaps row 1 and row 2)
   - **Multiply row**: `R1 = 3*R1` or `R1 = R1*3` (multiplies row 1 by 3)
   - **Divide row**: `R1 = R1/5` (divides row 1 by 5)
   - **Add rows**: `R1 = R1 + 2R2` or `R1 = R1 + R2*2` (adds 2 times row 2 to row 1)
   - **Subtract rows**: `R1 = R1 - 3R2` or `R1 = R1 - 3*R2` (subtracts 3 times row 2 from row 1)
5. Your operation history appears below your matrix
6. Use the "Undo" button to reverse your last operation
7. The first player to achieve RREF wins!

### Command Format Examples
- `R1 <> R2` - Swap rows 1 and 2
- `R2 = 5*R2` - Multiply row 2 by 5
- `R1 = R1*-2` - Multiply row 1 by -2
- `R3 = R3/3` - Divide row 3 by 3
- `R3 = R3 + 3R1` - Add 3 times row 1 to row 3
- `R2 = R2 - 2*R3` - Subtract 2 times row 3 from row 2
- `R1 = 3R2 + R1` - Add 3 times row 2 to row 1 (order doesn't matter for addition)

**Note**: All row indices start at 1 (not 0). Spaces are optional. You can use various formats like `3R2`, `3*R2`, or `R2*3`.

## Game Rules

### RREF Requirements
A matrix is in Reduced Row Echelon Form when:
1. All zero rows are at the bottom
2. The leading entry (first non-zero number from the left) of each non-zero row is 1
3. Each leading 1 is the only non-zero entry in its column
4. Leading 1s appear further to the right as you move down the rows

### Valid Operations
- **Row Swap**: Exchange any two rows
- **Row Multiplication**: Multiply a row by any non-zero integer
- **Row Addition**: Add a scalar multiple of one row to another row
