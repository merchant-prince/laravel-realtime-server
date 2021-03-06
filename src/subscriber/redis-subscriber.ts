import IORedis from 'ioredis';

/**
 * This class subscribes to events on the Laravel application's redis server.
 */
export default class RedisSubscriber {
  /**
   * Create a new class instance.
   *
   * @param connection The connection to the Laravel application's redis server responsible for broadcasting.
   * @param databasePrefix The database prefix defined in the Laravel application
   *                       (@see REDIS_PREFIX in Laravel's database.redis configuration).
   */
  public constructor(
    public readonly connection: IORedis.Redis,
    public readonly databasePrefix: string
  ) {}

  /**
   * Subscribe for messages on the Laravel application's redis server.
   *
   * @param callback The function to call when a message is published via redis' PUB/SUB.
   * @param errorCallback The function to call if an error is thrown when calling the aforementioned callback.
   * @throws Error if 'psubscribe' fails.
   */
  public subscribe(
    callback: (channelName: string, data: unknown) => void,
    errorCallback: (
      errorMessage: string,
      pmessageArguments: {
        pattern: string;
        prefixedChannelName: string;
        jsonMessage: string;
      }
    ) => void
  ): void {
    this.connection.on(
      'pmessage',
      (pattern, prefixedChannelName, jsonMessage) => {
        try {
          callback(
            prefixedChannelName.substring(this.databasePrefix.length),
            JSON.parse(jsonMessage)
          );
        } catch (error) {
          errorCallback(error.message, {
            pattern,
            prefixedChannelName,
            jsonMessage,
          });
        }
      }
    );

    this.connection.psubscribe(`${this.databasePrefix}*`, (error) => {
      if (error) {
        throw new Error(error.message);
      }
    });
  }
}
