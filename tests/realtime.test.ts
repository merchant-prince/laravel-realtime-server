import Realtime from '../src/realtime';
import { setupRealtimeServerAndSocketIoClients } from './utilities/setup';
import RedisMock from '../tests/utilities/mocks/redis';

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

  test("only a client socket subscribed to a channel receives an event published on that channel (by the Laravel application's redis server)", async () => {
    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients(2);
    const channelName = 'Four.Five';
    const eventData = {
      event: 'App\\Events\\HelloWorld',
      socket: null,
      data: {
        socket: null,
        id: 554,
        message: 'One is One',
      },
    };

    await Promise.all([
      new Promise<void>((resolve) => {
        socketPairs[0]?.server.on('subscribe', resolve);
        socketPairs[0]?.client.emit('subscribe', channelName);
      }),
      new Promise<void>((resolve) => {
        socketPairs[1]?.server.on('subscribe', resolve);
        socketPairs[1]?.client.emit('subscribe', 'no-no-no');
      }),
    ]);

    await new Promise<void>((resolve, reject) => {
      socketPairs[1]?.client.on(eventData.event, () => {
        reject(
          'This socket.io client is not supposed to receive the event because it did not subscribe to the channel.'
        );
      });

      socketPairs[0]?.client.on(eventData.event, (payload) => {
        expect(payload).toEqual({
          id: eventData.data.id,
          message: eventData.data.message,
        });

        resolve();
      });

      (realtime.subscriber.connection as unknown as RedisMock).pmessage(
        '',
        channelName,
        JSON.stringify(eventData)
      );
    });

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  // test("a client socket whose socket id is in an event (published on the Laravel application's redis server) does not receive said event", async () => {});

  // presence;joining + presence:subscribed
  // --> db data

  // presence;leaving + presence:subscribed
  // --> db data

  // disconnecting
  // --> db data
});
