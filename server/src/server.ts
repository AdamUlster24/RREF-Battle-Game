import path from 'node:path';
import { createGameServer } from './app.js';

// CLIENT_ORIGINS: comma-separated origins for a client hosted on another domain.
// CLIENT_DIST: a built client to serve from this process (default ../client/dist).
const origins = process.env.CLIENT_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean);
const clientDir = path.resolve(process.env.CLIENT_DIST ?? '../client/dist');
const port = Number(process.env.PORT) || 3001;

const { httpServer } = createGameServer({ ...(origins?.length ? { origins } : {}), clientDir });

httpServer.listen(port, () => {
  console.log(`RREF Battle server listening on port ${port}`);
});
