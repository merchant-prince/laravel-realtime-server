import { createServer as createHttpServer } from 'http';
import { Server as SocketIoServer, Socket as ServerSocket } from 'socket.io';
import { io as SocketIoClient, Socket as ClientSocket } from 'socket.io-client';
import Realtime from '../../src/realtime';
import RedisMock from 'ioredis-mock';

/**
 * Set up the Socket.io server and client.
 *
 * @param options Additional options used in the setup.
 */
export const setupRealtimeServerAndSocketIoClients = (options?: {
  client?: {
    count: number; // the number of clients to connect to the websocket server
  };
  realtime?: {
    prefix: string;
  };
  websocket?: {
    namespace: string;
  };
}): Promise<{
  socketPairs: { server: ServerSocket; client: ClientSocket }[];
  socketIoServer: SocketIoServer;
  realtime: Realtime;
}> => {
  const normalizedOptions = Object.assign(
    {},
    {
      client: {
        count: 1,
      },
      realtime: {
        prefix: '',
      },
      websocket: {
        namespace: '/',
      },
    },
    options
  );
  const httpServer = createHttpServer();
  const socketIoServer = new SocketIoServer(httpServer, { serveClient: false });
  const realtime = new Realtime({
    database: {
      connection: new RedisMock(),
    },
    subscriber: {
      connection: new RedisMock(),
      prefix: normalizedOptions.realtime.prefix,
    },
    websocket: {
      connection: socketIoServer,
      namespace: normalizedOptions.websocket.namespace,
    },
  });

  return new Promise((resolve, reject) => {
    httpServer.listen(async () => {
      const address = httpServer.address();

      if (address == null || typeof address === 'string') {
        reject(
          `Could not get an address for the http server (address: ${address}, type: ${typeof address}).`
        );
      } else {
        const socketPairs = await Promise.all(
          // create 'clientCount' pairs of server & client socket.io sockets
          Array(normalizedOptions.client.count)
            .fill(null)
            .map(
              () =>
                new Promise<{ server: ServerSocket; client: ClientSocket }>(
                  (resolve) => {
                    let serverSocket: ServerSocket;

                    socketIoServer.on('connect', (socket) => {
                      serverSocket = socket;
                    });

                    const clientSocket = SocketIoClient(
                      `http://localhost:${address.port}`
                    );

                    clientSocket.on('connect', () => {
                      resolve({
                        server: serverSocket,
                        client: clientSocket,
                      });
                    });
                  }
                )
            )
        );

        resolve({
          socketPairs,
          socketIoServer,
          realtime,
        });
      }
    });
  });
};
