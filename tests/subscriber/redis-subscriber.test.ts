import RedisSubscriber from '../../src/subscriber/redis-subscriber';
import RedisMock from 'ioredis-mock';

describe('testing the RedisSubscriber class', () => {
  // subscribe
  it('sanitizes the channel name before calling the callback with it', (done) => {
    const databasePrefix = 'database-prefix-';
    const channelName = 'private-OneTwo';
    const redisMockSubscriber = new RedisMock();
    const redisMockPublisher = redisMockSubscriber.createConnectedClient();
    const redisSubscriber = new RedisSubscriber(
      redisMockSubscriber,
      databasePrefix
    );

    redisSubscriber.subscribe(
      (channelNameReceived) => {
        expect(channelNameReceived).toBe(channelName);
        done();
      },
      (errorMessage) => {
        throw new Error(errorMessage);
      }
    );

    redisMockPublisher.publish(
      `${databasePrefix}${channelName}`,
      JSON.stringify(null)
    );
  });

  it('parses the JSON message before calling the callback with it', (done) => {
    const redisMockSubscriber = new RedisMock();
    const redisMockPublisher = redisMockSubscriber.createConnectedClient();
    const redisSubscriber = new RedisSubscriber(redisMockSubscriber, '');
    const payload = {
      name: 'JoJo',
      email: 'za@waru.do',
      specialAbility: 'nigeroooh!',
    };

    redisSubscriber.subscribe(
      (_, data) => {
        expect(data).toEqual(payload);
        done();
      },
      (errorMessage) => {
        throw new Error(errorMessage);
      }
    );

    redisMockPublisher.publish('Five-O', JSON.stringify(payload));
  });

  it("throws an error if 'psubscribe' fails", () => {
    const errorMessage = 'Could not subscribe to the redis server';
    const redisMock = new RedisMock();
    const redisSubscriber = new RedisSubscriber(redisMock, '');

    redisMock.psubscribe = (
      _: string,
      errorCallback: (error: { message: string }) => void
    ) => {
      errorCallback({ message: errorMessage });
    };

    expect(() => {
      redisSubscriber.subscribe(
        () => undefined,
        () => undefined
      );
    }).toThrowError(errorMessage);
  });

  it("calls 'errorCallback' if any error occurs when calling 'callback'", (done) => {
    const redisMockSubscriber = new RedisMock();
    const redisMockPublisher = redisMockSubscriber.createConnectedClient();
    const redisSubscriber = new RedisSubscriber(redisMockSubscriber, '');

    redisSubscriber.subscribe(
      () => undefined,
      (errorMessage) => {
        expect(errorMessage).toContain('Unexpected end of JSON input');
        done();
      }
    );

    redisMockPublisher.publish('presence-Ninetyfive', '');
  });
});
