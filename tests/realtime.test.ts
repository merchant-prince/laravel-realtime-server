import Realtime from '../src/realtime';
import { setupRealtimeServerAndSocketIoClients } from './utilities/setup';

describe('testing the Realtime class', () => {
  // Realtime.isPresenceChannel
  it('correctly determines whether a channel is a presence channel', () => {
    const presenceChannel = 'presence-One.Two';
    const nonPresenceChannel = 'private-nope';

    expect(Realtime['isPresenceChannel'](presenceChannel)).toBeTruthy();
    expect(Realtime['isPresenceChannel'](nonPresenceChannel)).toBeFalsy();
  });

  // constructor
  it('sets up realtime successfully', async () => {
    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients(2);
    expect(socketPairs[0]?.server.connected).toBeTruthy();
    expect(socketPairs[0]?.client.connected).toBeTruthy();
    expect(socketPairs[1]?.server.connected).toBeTruthy();
    expect(socketPairs[1]?.client.connected).toBeTruthy();
    socketPairs[0]?.client.close();
    socketPairs[1]?.client.close();
    socketIoServer.close();
  });
});
