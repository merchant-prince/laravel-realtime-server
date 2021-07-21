import IORedis from 'ioredis';
import {
  Namespace as SocketIoNamespace,
  Server as SocketIoServer,
  Socket as SocketIoSocket,
} from 'socket.io';
import RedisDatabase from './database/redis-database';
import RedisSubscriber from './subscriber/redis-subscriber';

export default class Realtime {
  protected readonly io: SocketIoNamespace;
  protected readonly subscriber: RedisSubscriber;
  protected readonly database: RedisDatabase;

  constructor(options: {
    websocket: {
      connection: SocketIoServer;
      namespace: string;
    };
    subscriber: {
      connection: IORedis.Redis;
      prefix: string;
    };
    database: {
      connection: IORedis.Redis;
    };
  }) {
    this.io = options.websocket.connection.of(options.websocket.namespace);
    this.subscriber = new RedisSubscriber(
      options.subscriber.connection,
      options.subscriber.prefix
    );
    this.database = new RedisDatabase(options.database.connection);

    this.io.on('connection', (socket) => {
      socket.on('subscribe', async (channelName, userData?) => {
        await this.subscribeSocketToChannel(socket, channelName, userData);
      });

      socket.on('unsubscribe', async (channelName) => {
        await this.unsubscribeSocketFromChannel(socket, channelName);
      });

      socket.on('disconnecting', async () => {
        await this.cleanupSocketDataFromServer(socket);
      });

      socket.on(
        'client-event',
        (data: { channel: string; event: string; payload: unknown }) => {
          this.broadcastClientEvent(socket, data);
        }
      );
    });

    this.listenForRedisPublishedEvents();
  }

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
      const userJustJoinedTheChannel =
        (await this.database.createOrIncreaseUserSocketCount(
          userData,
          channelName
        )) === 1;

      await this.database.associateUserDataToSocketId(userData, socket.id);
      await this.database.addUserDataToChannel(userData, channelName);

      if (userJustJoinedTheChannel) {
        socket.to(channelName).emit('presence:joining', userData);

        const channelMembersData = await this.database.getChannelMembers(
          channelName
        );

        this.io.to(channelName).emit('presence:subscribed', channelMembersData);
      }
    }
  }

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

  protected broadcastClientEvent(
    socket: SocketIoSocket,
    data: { channel: string; event: string; payload: unknown }
  ): void {
    socket.to(data.channel).emit(data.event, data.payload);
  }

  protected listenForRedisPublishedEvents(): void {
    this.subscriber.subscribe(
      (channelName, data) => {
        const {
          event,
          data: { socket: socketId, ...payload },
        } = data as { event: string; data: Record<string, unknown> };

        if (socketId != null && typeof socketId === 'string') {
          this.io.sockets.get(socketId)?.to(channelName).emit(event, payload);
        } else {
          this.io.to(channelName).emit(event, payload);
        }
      },
      (errorMessage, pmessageArguments) => {
        console.error(
          `Error: ${errorMessage} [${JSON.stringify(pmessageArguments)}]`
        );
      }
    );
  }

  protected static isPresenceChannel(channelName: string): boolean {
    return channelName.startsWith('presence-');
  }
}
