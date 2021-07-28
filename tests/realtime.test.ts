import IORedis from 'ioredis';
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

  // basic
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
    const nonReceivingChannelName = 'Nope.Jpeg';
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
        socketPairs[1]?.client.emit('subscribe', nonReceivingChannelName);
      }),
    ]);

    await new Promise<void>((resolve, reject) => {
      const redisPublisher = (
        realtime.subscriber.connection as unknown as {
          createConnectedClient: () => IORedis.Redis;
        }
      ).createConnectedClient();

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

      redisPublisher.publish(channelName, JSON.stringify(eventData));
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
      const redisPublisher = (
        realtime.subscriber.connection as unknown as {
          createConnectedClient: () => IORedis.Redis;
        }
      ).createConnectedClient();

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

      redisPublisher.publish(channelName, JSON.stringify(eventData));
    });

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  // joining presence channels
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

  // leaving presence channels
  test('the correct events are sent when a user leaves a presence channel', async () => {
    expect.assertions(2);

    const channelName = 'presence-general-chat';
    const { socketPairs, socketIoServer } =
      await setupRealtimeServerAndSocketIoClients({ client: { count: 2 } });
    const userData = { id: 1, name: 'One', email: 'one@one.one' };
    const counter = {
      'presence:subscribed': 0,
    };

    await Promise.all([
      new Promise((resolve) => {
        socketPairs[0]?.server.on('subscribe', resolve);
        socketPairs[0]?.client.emit('subscribe', channelName);
      }),
      new Promise<void>((resolve) => {
        socketPairs[1]?.server.on('subscribe', () => resolve());
        socketPairs[1]?.client.emit('subscribe', channelName, userData);
      }),
    ]);

    await Promise.all([
      new Promise<void>((resolve) => {
        socketPairs[1]?.server.on('unsubscribe', () => resolve());
        socketPairs[1]?.client.emit('unsubscribe', channelName, userData);
      }),

      Promise.all([
        new Promise<void>((resolve) => {
          socketPairs[0]?.client.on('presence:leaving', (receivedUserData) => {
            expect(receivedUserData).toEqual(userData);
            resolve();
          });
        }),

        new Promise<void>((resolve) => {
          socketPairs[0]?.client.on(
            'presence:subscribed',
            (channelMembersData) => {
              // we only resolve this promise when the 'presence:subscribed has been called the 2nd time.
              // this is because it is first called when the client sends the 'subscribe' event to the server.
              if (++counter['presence:subscribed'] === 2) {
                expect(channelMembersData).toEqual([]);
                resolve();
              }
            }
          );
        }),
      ]),
    ]);

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  test('the correct data is removed from the database when a user leaves a presence channel', async () => {
    expect.assertions(3);

    const channelName = 'presence-OneTwo';
    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients();
    const userData = {
      id: 10,
      name: 'ElevenTwelve',
      email: 'elevel@twelve.thirteen',
    };

    await new Promise((resolve) => {
      socketPairs[0]?.server.on('subscribe', () => {
        socketPairs[0]?.server.on('unsubscribe', () => {
          /**
           * Resolve after the current 'poll' phase, so that the data is mutated in the database before the following
           * assertions.
           * @see https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/#setimmediate-vs-settimeout
           */
          setImmediate(resolve);
        });

        socketPairs[0]?.client.emit('unsubscribe', channelName);
      });

      socketPairs[0]?.client.emit('subscribe', channelName, userData);
    });

    const socketIdUserData = await realtime.database.getUserDataFromSocketId(
      socketPairs[0]?.client.id as string
    );
    expect(socketIdUserData).toBeNull();

    const channelSet = await realtime.database.getChannelMembers(channelName);
    expect(channelSet.length).toBe(0);

    const socketCount = await realtime.database.createOrIncreaseUserSocketCount(
      userData,
      channelName
    );
    expect(socketCount).toBe(1);

    socketPairs.forEach(({ client }) => client.close());
    socketIoServer.close();
  });

  // disconnecting from presence channels
  test("a socket's presence channels' data is removed from the database when it disconnects", async () => {
    expect.assertions(3);

    const channelName = 'presence-OneTwoThree';
    const { socketPairs, socketIoServer, realtime } =
      await setupRealtimeServerAndSocketIoClients();
    const userData = {
      id: 101112,
      name: 'ElevenTwelveThirteen',
      email: 'elevel@twelve.thirteenfourten',
    };

    await new Promise((resolve) => {
      socketPairs[0]?.server.on('subscribe', () => {
        socketPairs[0]?.client.close();

        socketPairs[0]?.server.on('disconnect', () => {
          /**
           * Resolve after the current 'poll' phase, so that the data is mutated in the database before the following
           * assertions.
           * @see https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/#setimmediate-vs-settimeout
           */
          setImmediate(resolve);
        });
      });

      socketPairs[0]?.client.emit('subscribe', channelName, userData);
    });

    const socketIdUserData = await realtime.database.getUserDataFromSocketId(
      socketPairs[0]?.client.id as string
    );
    expect(socketIdUserData).toBeNull();

    const channelSet = await realtime.database.getChannelMembers(channelName);
    expect(channelSet.length).toBe(0);

    const socketCount = await realtime.database.createOrIncreaseUserSocketCount(
      userData,
      channelName
    );
    expect(socketCount).toBe(1);

    socketIoServer.close();
  });
});
