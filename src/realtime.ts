import IORedis from 'ioredis';
import { Server as SocketIoServer } from 'socket.io';

export default class Realtime {
  constructor(
    protected readonly socketIoServer: SocketIoServer,
    protected readonly options: {
      subscriber: {
        connection: IORedis.Redis
      },
      database: {
        connection: IORedis.Redis,
        prefix: string
      }
    }
  ) { }

  protected static isPresenceChannel(channelName: string): boolean {
    return channelName.startsWith('presence-');
  }
}
