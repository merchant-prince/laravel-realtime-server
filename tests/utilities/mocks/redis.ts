import EventEmitter from 'events';

export default class Redis extends EventEmitter {
  public constructor(
    private database: Record<string, unknown> = {},
    private additionalData: Record<string, unknown> = {}
  ) {
    super();
  }

  public async get(key: string): Promise<unknown> {
    return this.database[key];
  }

  public async set(key: string, value: unknown): Promise<number> {
    this.database[key] = value;

    return 1;
  }

  public async del(key: string): Promise<number> {
    delete this.database[key];

    return 1;
  }

  public async incr(key: string): Promise<number> {
    if (!(key in this.database)) {
      this.database[key] = 0;
    }

    return ++(this.database as { [key: string]: number })[key];
  }

  public async decr(key: string): Promise<number> {
    return --(this.database as { [key: string]: number })[key];
  }

  public async smembers(key: string): Promise<unknown[]> {
    return Array.from(
      (this.database as { [key: string]: Set<unknown> })[key] ?? []
    );
  }

  public async sadd(key: string, value: unknown): Promise<number> {
    if (!(key in this.database)) {
      this.database[key] = new Set();
    }

    (this.database as { [key: string]: Set<unknown> })[key].add(value);

    return 1;
  }

  public async srem(key: string, value: unknown): Promise<number> {
    (this.database as { [key: string]: Set<unknown> })[key].delete(value);

    if ((this.database as { [key: string]: Set<unknown> })[key].size === 0) {
      delete this.database[key];
    }

    return 1;
  }

  public psubscribe(
    subscribedChannelPattern: string,
    errorCallback: (error: { message: string }) => void
  ): void {
    const invokeErrorCallbackPrefix = 'INVOKE_ERROR_CALLBACK_WITH_MESSAGE:';

    if (subscribedChannelPattern.startsWith(invokeErrorCallbackPrefix)) {
      errorCallback({
        message: subscribedChannelPattern.substring(
          invokeErrorCallbackPrefix.length,
          subscribedChannelPattern.endsWith('*')
            ? subscribedChannelPattern.length - 1
            : subscribedChannelPattern.length
        ),
      });
    } else {
      this.additionalData['subscribedChannelPattern'] =
        subscribedChannelPattern;
    }
  }

  public pmessage(
    pattern: string,
    prefixedChannelName: string,
    message: string
  ): void {
    this.emit('pmessage', pattern, prefixedChannelName, message);
  }
}
