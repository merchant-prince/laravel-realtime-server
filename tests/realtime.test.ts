import Realtime from '../src/realtime';
import { setupRealtimeServerAndSocketIoClient } from './utilities/setup';
import { Server as SocketIoServer, Socket as ServerSocket } from 'socket.io';
import { Socket as ClientSocket } from 'socket.io-client';

describe('testing the Realtime class', () => {
  let realtime: Realtime;
  let socketIoServer: SocketIoServer;
  let serverSocket: ServerSocket;
  let clientSocket: ClientSocket;

  beforeEach(async () => {
    ({ serverSocket, clientSocket, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClient());
  });

  afterEach(() => {
    socketIoServer.close();
    clientSocket.close();
  });

  // Realtime.isPresenceChannel
  it('correct determines whether a channel is a presence channel', () => {
    const presenceChannel = 'presence-One.Two';
    const nonPresenceChannel = 'private-nope';

    expect(Realtime['isPresenceChannel'](presenceChannel)).toBeTruthy();
    expect(Realtime['isPresenceChannel'](nonPresenceChannel)).toBeFalsy();
  });

  // constructor
  it('sets up realtime successfully', () => {
    realtime; // @todo: setup multiple clients.
    expect(serverSocket.connected).toBeTruthy();
    expect(clientSocket.connected).toBeTruthy();
  });
});
