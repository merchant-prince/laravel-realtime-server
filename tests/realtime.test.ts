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
  test("the client's 'server socket' joins a room identified by the 'channelName' when a 'subscribe' event is sent to the server from the 'client socket'", async () => {
    expect.assertions(2);

    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients(1);
    const channelName = 'OneTwo';

    await new Promise<void>((resolve) => {
      socketPairs[0]?.server.prependListener('subscribe', () => {
        expect(socketPairs[0]?.server.rooms.has(channelName)).toBeFalsy();
      });

      socketPairs[0]?.server.on('subscribe', () => {
        expect(socketPairs[0]?.server.rooms.has(channelName)).toBeTruthy();
        resolve();
      });

      socketPairs[0]?.client.emit('subscribe', channelName);
    });

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  test("the client's 'server socket' leaves a room identified by the 'channelName' when an 'unsubscribe' event is sent to the server from the 'client socket'", async () => {
    expect.assertions(2);

    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients(1);
    const channelName = 'TwoThree';

    await new Promise<void>((resolve) => {
      socketPairs[0]?.server.on('subscribe', resolve);
      socketPairs[0]?.client.emit('subscribe', channelName);
    });

    await new Promise<void>((resolve) => {
      socketPairs[0]?.server.prependListener('unsubscribe', () => {
        expect(socketPairs[0]?.server.rooms.has(channelName)).toBeTruthy();
      });

      socketPairs[0]?.server.on('unsubscribe', (channelName) => {
        expect(socketPairs[0]?.server.rooms.has(channelName)).toBeFalsy();
        resolve();
      });

      socketPairs[0]?.client.emit('unsubscribe', channelName);
    });

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  test('client events are broadcasted to other listening client sockets', async () => {
    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients(2);
    const channelName = 'three-four';
    const eventName = 'hello.world';
    const payload = {
      message: 'hello, world',
    };

    await Promise.all(
      socketPairs.map(
        ({ server, client }) =>
          new Promise<void>((resolve) => {
            server.on('subscribe', resolve);
            client.emit('subscribe', channelName);
          })
      )
    );

    await new Promise<void>((resolve, reject) => {
      const broadcastingClient = socketPairs[0]?.client;
      const receivingClient = socketPairs[1]?.client;

      broadcastingClient?.on(`client-${eventName}`, () => {
        reject(
          'This socket.io client is not supposed to receive a client-event it broadcasted.'
        );
      });

      receivingClient?.on(`client-${eventName}`, (receivedPayload) => {
        expect(receivedPayload.message).toBe(payload.message);
        resolve();
      });

      broadcastingClient?.emit('client-event', {
        channel: channelName,
        event: `client-${eventName}`,
        payload: payload,
      });
    });

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });
});
