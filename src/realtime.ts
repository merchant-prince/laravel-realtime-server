import IORedis from 'ioredis';
import {
  Namespace as SocketIoNamespace,
  Server as SocketIoServer,
  Socket as SocketIoSocket,
} from 'socket.io';
import RedisDatabase from './database/redis-database';
import RedisSubscriber from './subscriber/redis-subscriber';

/**
 * This class is the primary API for interacting with this library.
 */
export default class Realtime {
  /**
   * The socket.io namespace which will be used for all socket.io operations.
   */
  public readonly ioNsp: SocketIoNamespace;

  /**
   * The object responsible for 'subscribing' to 'pmessage' events from the Laravel application's Redis server.
   */
  public readonly subscriber: RedisSubscriber;

  /**
   * The database used for storing presence-channels related data.
   */
  public readonly database: RedisDatabase;

  /**
   * Initialize socket.io, redis subscriptions, and database.
   *
   * @param options
   */
  constructor(options: {
    database: {
      connection: IORedis.Redis;
    };
    subscriber: {
      connection: IORedis.Redis;
      prefix: string;
    };
    websocket: {
      connection: SocketIoServer;
      namespace: string;
    };
  }) {
    this.ioNsp = options.websocket.connection.of(options.websocket.namespace);
    this.database = new RedisDatabase(options.database.connection);
    this.subscriber = new RedisSubscriber(
      options.subscriber.connection,
      options.subscriber.prefix
    );

    this.initializeWebsocketsAndStartListeningForRedisEvents();
  }

  /**
   * Initialize the socket.io server, and start listening for socket.io events. Then psubscribe to the configured redis
   * channels, and start listening for 'pmessage's.
   */
  protected initializeWebsocketsAndStartListeningForRedisEvents(): void {
    this.ioNsp.on('connection', (socket) => {
      socket.on('subscribe', async (channelName, userData?) => {
        await this.subscribeSocketToChannel(socket, channelName, userData);
      });

      socket.on('unsubscribe', async (channelName) => {
        await this.unsubscribeSocketFromChannel(socket, channelName);
      });

      socket.on('disconnecting', async () => {
        await this.cleanupSocketDataFromServer(socket);
      });

      socket.on('client-event', (data) => {
        this.broadcastClientEvent(socket, data);
      });
    });

    this.listenForRedisPublishedEvents();
  }

  /**
   * Subscribe a socket to a channel. The socket joins a room identified by the channel name. For presence channels,
   * the socket additionally adds and/or mutates some data in the database.
   *
   * @param socket The user's socket.
   * @param channelName The name of the channel to subscribe to.
   * @param userData The data of the user joining the channel.
   */
  protected async subscribeSocketToChannel(
    socket: SocketIoSocket,
    channelName: string,
    userData?: Record<string, unknown>
  ): Promise<void> {
    socket.join(channelName);

    if (
      Realtime.isPresenceChannel(channelName) &&
      typeof userData !== 'undefined'
    ) {
      await this.database.associateUserDataToSocketId(userData, socket.id);
      await this.database.addUserDataToChannel(userData, channelName);

      const userJustJoinedTheChannel =
        (await this.database.createOrIncreaseUserSocketCount(
          userData,
          channelName
        )) === 1;

      if (userJustJoinedTheChannel) {
        // emit to every socket on the channel EXCEPT the one that just joined the channel.
        socket.to(channelName).emit('presence:joining', userData);

        const channelMembersData = await this.database.getChannelMembers(
          channelName
        );

        this.ioNsp
          .to(channelName)
          .emit('presence:subscribed', channelMembersData);
      }
    }
  }

  /**
   * Unsubscribe a socket from a channel. The socket leaves a room identified by the channel name. For presence
   * channels, the socket additionally adds and/or mutates some data in the database.
   *
   * @param socket The user's socket.
   * @param channelName The name of the channel to unsubscribe from.
   */
  protected async unsubscribeSocketFromChannel(
    socket: SocketIoSocket,
    channelName: string
  ): Promise<void> {
    socket.leave(channelName);

    if (Realtime.isPresenceChannel(channelName)) {
      const userData = await this.database.getUserDataFromSocketId(socket.id);

      if (userData != null) {
        await this.database.dissociateUserDataFromSocketId(socket.id);

        const userJustLeftTheChannel =
          (await this.database.removeOrDecreaseUserSocketCount(
            userData,
            channelName
          )) === 0;

        if (userJustLeftTheChannel) {
          await this.cleanupAndBroadcastLeavingEvents(
            socket,
            channelName,
            userData
          );
        }
      }
    }
  }

  /**
   * If a socket disconnects from the server, we find all the presence channels it was subscribed to, and unsubscribe
   * from them. We don't need to unsubscribe to public or private channels, as they automatically leave the channel
   * when the client socket disconnects.
   *
   * @param socket The user's socket.
   */
  protected async cleanupSocketDataFromServer(
    socket: SocketIoSocket
  ): Promise<void> {
    const socketPresenceChannels = Array.from(socket.rooms).filter(
      Realtime.isPresenceChannel
    );
    const userData = await this.database.getUserDataFromSocketId(socket.id);

    if (userData != null) {
      await this.database.dissociateUserDataFromSocketId(socket.id);

      for (const channelName of socketPresenceChannels) {
        const userJustLeftTheChannel =
          (await this.database.removeOrDecreaseUserSocketCount(
            userData,
            channelName
          )) === 0;

        if (userJustLeftTheChannel) {
          await this.cleanupAndBroadcastLeavingEvents(
            socket,
            channelName,
            userData
          );
        }
      }
    }
  }

  /**
   * Clean-up the user's data from the channel in the database, and emit 'leaving' events to the client.
   *
   * @param socket The user's socket.
   * @param channelName The name of the channel the current socket is leaving.
   * @param userData The user's data.
   */
  protected async cleanupAndBroadcastLeavingEvents(
    socket: SocketIoSocket,
    channelName: string,
    userData: Record<string, unknown>
  ): Promise<void> {
    await this.database.removeUserDataFromChannel(userData, channelName);

    socket.to(channelName).emit('presence:leaving', userData);

    const channelMembersData = await this.database.getChannelMembers(
      channelName
    );

    socket.to(channelName).emit('presence:subscribed', channelMembersData);
  }

  /**
   * BROADCAST a 'client-event' to all the sockets on the specified channel.
   *
   * @param socket The user's socket.
   * @param data {
   *    channel: The channel to broadcast the payload to.
   *    event: The event to emit.
   *    payload: The payload to emit with the event.
   * }
   */
  protected broadcastClientEvent(
    socket: SocketIoSocket,
    {
      channel,
      event,
      payload,
    }: { channel: string; event: string; payload: unknown }
  ): void {
    socket.to(channel).emit(event, payload);
  }

  /**
   * Listen for 'pmessage' events from the Laravel application's redis broadcasting server, and emit or broadcast
   * the data (depending on whether the 'socket' property is null) to socket.io clients.
   */
  protected listenForRedisPublishedEvents(): void {
    try {
      this.subscriber.subscribe(
        (channelName, data) => {
          const {
            event,
            data: { socket: socketId, ...payload },
          } = data as {
            event: string;
            data: { socket: string; [key: string]: unknown };
            socket: string;
          };

          if (typeof socketId === 'string') {
            this.ioNsp.sockets
              .get(socketId)
              ?.to(channelName)
              .emit(event, payload);
          } else {
            this.ioNsp.to(channelName).emit(event, payload);
          }
        },
        (errorMessage, pmessageArguments) => {
          console.error(
            `Error: ${errorMessage} [${JSON.stringify(pmessageArguments)}]`
          );
        }
      );
    } catch (error) {
      console.error(
        `Error while subscribing to the redis server: ${error.message}.`
      );
    }
  }

  /**
   * Check if a channel is a 'presence' channel.
   *
   * @param channelName The name of the channel to check.
   */
  protected static isPresenceChannel(channelName: string): boolean {
    return channelName.startsWith('presence-');
  }
}
