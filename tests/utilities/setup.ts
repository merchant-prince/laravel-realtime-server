import { createServer as createHttpServer } from 'http';
import IORedis from 'ioredis';
import { Server as SocketIoServer, Socket as ServerSocket } from 'socket.io';
import { io as SocketIoClient, Socket as ClientSocket } from 'socket.io-client';
import Realtime from '../../src/realtime';
import Redis from './mocks/redis';

/**
 * Set up the Socket.io server and client.
 */
export const setupRealtimeServerAndSocketIoClient = (): Promise<{
  serverSocket: ServerSocket;
  clientSocket: ClientSocket;
  socketIoServer: SocketIoServer;
  realtime: Realtime;
}> => {
  const httpServer = createHttpServer();
  const socketIoServer = new SocketIoServer(httpServer, { serveClient: false });
  const realtime = new Realtime({
    database: {
      connection: new Redis() as unknown as IORedis.Redis,
    },
    subscriber: {
      connection: new Redis() as unknown as IORedis.Redis,
      prefix: '',
    },
    websocket: {
      connection: socketIoServer,
      namespace: '/',
    },
  });

  return new Promise((resolve) => {
    httpServer.listen(() => {
      const address = httpServer.address();

      if (address == null || typeof address === 'string') {
        throw new Error(
          `Could not get an address for the http server (address: ${address}, type: ${typeof address}).`
        );
      }

      let serverSocket: ServerSocket;

      socketIoServer.on('connect', (socket) => {
        serverSocket = socket;
      });

      const clientSocket = SocketIoClient(`http://localhost:${address.port}`);

      clientSocket.on('connect', () => {
        resolve({
          serverSocket,
          clientSocket,
          socketIoServer,
          realtime,
        });
      });
    });
  });
};
