import IORedis from 'ioredis';

/**
 * This class subscribes to events on Laravel application's redis server.
 */
export default class RedisSubscriber {
  /**
   * Create a new class instance.
   *
   * @param redis The connection to the Laravel application's redis server.
   * @param databasePrefix The database prefix defined in the Laravel application
   *                       (@see REDIS_PREFIX in Laravel's database.redis configuration).
   */
  public constructor(
    protected readonly redis: IORedis.Redis,
    protected readonly databasePrefix: string
  ) {}

  /**
   * Subscribe for messages on the Laravel application's redis server.
   *
   * @param callback The function to call when a message is published on redis.
   */
  public subscribe(
    callback: (channelName: string, data: unknown) => void
  ): void {
    this.redis.on('pmessage', (pattern, prefixedChannelName, jsonMessage) => {
      try {
        callback(
          prefixedChannelName.substring(this.databasePrefix.length),
          JSON.parse(jsonMessage)
        );
      } catch (error) {
        console.error(
          `[${new Date().toLocaleString()}] Error during redis 'pmessage' processing: ${
            error.message
          }. (pattern: ${pattern}, channel: ${prefixedChannelName}, message: ${jsonMessage})`
        );
      }
    });

    this.redis.psubscribe(`${this.databasePrefix}*`, (error) => {
      if (error) {
        console.error(
          `[${new Date().toLocaleString()}] Could not subscribe to the redis server (${
            error.message
          })`
        );
      }
    });
  }
}
