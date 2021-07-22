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
      await setupRealtimeServerAndSocketIoClients();
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
      await setupRealtimeServerAndSocketIoClients();
    const channelName = 'TwoThree';

    await new Promise((resolve) => {
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
    expect.assertions(1);

    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
    const channelName = 'three-four';
    const eventName = 'hello.world';
    const payload = {
      message: 'hello, world',
    };

    await Promise.all(
      socketPairs.map(
        ({ server, client }) =>
          new Promise((resolve) => {
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
    expect.assertions(1);

    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
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
      new Promise((resolve) => {
        socketPairs[0]?.server.on('subscribe', resolve);
        socketPairs[0]?.client.emit('subscribe', channelName);
      }),
      new Promise((resolve) => {
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

  test("a client socket whose id is in an event - published on the Laravel application's redis server - does not receive said event", async () => {
    expect.assertions(1);

    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
    const channelName = 'Vash-The-Stampede';

    await Promise.all(
      socketPairs.map(
        ({ server, client }) =>
          new Promise((resolve) => {
            server.on('subscribe', resolve);
            client.emit('subscribe', channelName);
          })
      )
    );

    const eventData = {
      event: 'App\\Events\\WhoAmI',
      socket: socketPairs[0]?.client.id,
      data: {
        socket: socketPairs[0]?.client.id,
        id: 666,
        message: 'All hail Stan!',
      },
    };

    await new Promise<void>((resolve, reject) => {
      socketPairs[0]?.client.on(eventData.event, () => {
        reject(
          'This socket.io client is not supposed to receive the event because the event data contains its socket id (it was broadcasted from the Laravel application).'
        );
      });

      socketPairs[1]?.client.on(eventData.event, (payload) => {
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

  test('the correct events are sent when a user joins a presence channel', async () => {
    expect.assertions(3);

    const channelName = 'presence-general-chat';
    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
    const userData = { id: 1, name: 'One', email: 'one@one.one' };

    await Promise.all([
      Promise.all([
        new Promise((resolve) => {
          socketPairs[0]?.server.on('subscribe', resolve);
          socketPairs[0]?.client.emit('subscribe', channelName);
        }),
        new Promise<void>((resolve) => {
          socketPairs[1]?.server.on('subscribe', () => resolve());
          socketPairs[1]?.client.emit('subscribe', channelName, userData);
        }),
      ]),
      Promise.all([
        new Promise<void>((resolve) => {
          socketPairs[0]?.client.on('presence:joining', (receivedUserData) => {
            expect(receivedUserData).toEqual(userData);
            resolve();
          });
        }),

        Promise.all(
          socketPairs.map(
            async ({ client }) =>
              new Promise<void>((resolve) => {
                client.on('presence:subscribed', (membersData) => {
                  expect(membersData).toEqual([userData]);
                  resolve();
                });
              })
          )
        ),
      ]),
    ]);

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  test('the correct data is stored in the database when a user joins a presence channel', async () => {
    expect.assertions(3);

    const channelName = 'presence-general-chat';
    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients();
    const userData = { id: 1, name: 'One', email: 'one@one.one' };

    await new Promise<void>((resolve) => {
      socketPairs[0]?.server.on('subscribe', () => resolve());
      socketPairs[0]?.client.emit('subscribe', channelName, userData);
    });

    const socketIdUserData = await realtime.database.getUserDataFromSocketId(
      socketPairs[0]?.client.id as string
    );
    expect(socketIdUserData).toEqual(userData);

    const channelSet = await realtime.database.getChannelMembers(channelName);
    expect(channelSet.map((userData) => JSON.stringify(userData))).toContain(
      JSON.stringify(userData)
    );

    const socketCount = await realtime.database.createOrIncreaseUserSocketCount(
      userData,
      channelName
    );
    expect(socketCount).toBe(2);

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  test('data is only stored once, even if the user joins the channel multiple times - (ditto for events)', async () => {
    // since data is only stored once, the events are also sent only once when a user joins a channel multiple times
    expect.assertions(2);

    const channelName = 'presence-general-chat';
    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
    const userData = { id: 1, name: 'One', email: 'one@one.one' };

    await Promise.all(
      socketPairs.map(
        ({ server, client }) =>
          new Promise<void>((resolve) => {
            server.on('subscribe', () => resolve());
            client.emit('subscribe', channelName, userData);
          })
      )
    );

    const channelSet = await realtime.database.getChannelMembers(channelName);
    expect(channelSet.length).toBe(1);

    const socketCount = await realtime.database.createOrIncreaseUserSocketCount(
      userData,
      channelName
    );
    expect(socketCount).toBe(3);

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  // // presence;leaving + presence:subscribed
  // // --> db data

  // // disconnecting
  // // --> db data
});
