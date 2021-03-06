import IORedis from 'ioredis';

/**
 * This class has all the database-related methods for this project.
 * The database schema is as follows:
 *    ---------------------------------------------------------------------
 *    | Key                              | Value                          |
 *    =====================================================================
 *    | <channel_name: string>           | SET(<user_data: string(json)>) |
 *    ---------------------------------------------------------------------
 *    | <(channel_name:user_id): string> | <socket_count: integer>        |
 *    ---------------------------------------------------------------------
 *    | <socket_id: string>              | <user_data: string(json)>      |
 *    ---------------------------------------------------------------------
 */
export default class RedisDatabase {
  /**
   * Create a new class instance.
   *
   * @param connection The connection to the application's redis server.
   */
  public constructor(public readonly connection: IORedis.Redis) {}

  /**
   * Get the user data associated with a socket id.
   *
   * @param socketId The socket id associated with the user data.
   */
  public async getUserDataFromSocketId(
    socketId: string
  ): Promise<Record<string, unknown> | null> {
    return JSON.parse((await this.connection.get(socketId)) ?? 'null');
  }

  /**
   * Associate a socket id with the (JSON stringified) data of a user.
   *
   * @param userData The user data to associate to the socket id.
   * @param socketId The socket id to associate to the user data.
   */
  public async associateUserDataToSocketId(
    userData: Record<string, unknown>,
    socketId: string
  ): Promise<IORedis.Ok | null> {
    return await this.connection.set(socketId, JSON.stringify(userData));
  }

  /**
   * Dissociate any user data from a given socket id.
   *
   * @param socketId The socket id to dissociate any user data from.
   */
  public async dissociateUserDataFromSocketId(
    socketId: string
  ): Promise<number> {
    return await this.connection.del(socketId);
  }

  /**
   * Increase the current socket counter, or create a new socket counter for the user if one did not exist already.
   * The return value is always '1' if the socket counter was just created.
   * @see https://redis.io/commands/incr
   *
   * This can be used to check if the user is present on a given channel. If the return value is '1', the user was
   * not present on the channel previously. Otherwise, the user was present on the channel.
   *
   * @param userData The data of the user to create/increase the socket-count for.
   * @param channelName The channel to increase the user's socket-count for.
   */
  public async createOrIncreaseUserSocketCount(
    userData: Record<string, unknown>,
    channelName: string
  ): Promise<number> {
    return await this.connection.incr(
      RedisDatabase.userKey(channelName, userData)
    );
  }

  /**
   * Decrease the current socket counter of the user. If the counter reaches 0, delete the counter.
   * The return value is always '0' if the socket counter has just been deleted.
   *
   * This can be used to check if the user is present on a given channel. If the return value is '0', the user is no
   * longer present on the channel. Otherwise, the user is still here.
   *
   * @param userData The data of the user to decrease/remove the socket-count for.
   * @param channelName The channel to decrease the user's socket-count for.
   */
  public async removeOrDecreaseUserSocketCount(
    userData: Record<string, unknown>,
    channelName: string
  ): Promise<number> {
    const userKey = RedisDatabase.userKey(channelName, userData);
    let socketCount = await this.connection.decr(userKey);

    if (socketCount <= 0) {
      socketCount = 0;

      await this.connection.del(userKey);
    }

    return socketCount;
  }

  /**
   * Get all the JSON-parsed data of all the users present on a channel.
   *
   * @param channelName The channel to retrieve the users' data from.
   */
  public async getChannelMembers(channelName: string): Promise<unknown[]> {
    return (await this.connection.smembers(channelName))
      .filter((rawUserData) => Boolean(rawUserData))
      .map((rawUserData) => JSON.parse(rawUserData));
  }

  /**
   * Add a user's data to a set identified by the channel's name.
   *
   * @param userData The user data to JSON stringify, and add to the set.
   * @param channelName The channel-name set to add the data to.
   */
  public async addUserDataToChannel(
    userData: Record<string, unknown>,
    channelName: string
  ): Promise<number> {
    return await this.connection.sadd(channelName, JSON.stringify(userData));
  }

  /**
   * Remove a user's data from a set identified by the channel's name.
   *
   * @param userData The user data to remove from the set.
   * @param channelName The channel-name set to remove the data from.
   */
  public async removeUserDataFromChannel(
    userData: Record<string, unknown>,
    channelName: string
  ): Promise<number> {
    return await this.connection.srem(channelName, JSON.stringify(userData));
  }

  /**
   * Compute a unique 'userKey' from the channel name and user data provided.
   *
   * @param channelName The channel name to compute the 'userKey' from.
   * @param userData The user's data to compute the 'userKey' from.
   */
  protected static userKey(
    channelName: string,
    userData: Record<string, unknown>
  ): string {
    return `${channelName}:${userData['id']}`;
  }
}
