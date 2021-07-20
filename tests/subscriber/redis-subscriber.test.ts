import IORedis from 'ioredis';
import Redis from '../utilities/mocks/redis';
import RedisSubscriber from '../../src/subscriber/redis-subscriber';

describe('testing the RedisSubscriber class', () => {
  // subscribe
  it('sanitizes the channel name before calling the callback with it', (done) => {
    const databasePrefix = 'database-prefix-';
    const channelName = 'OneTwo';
    const redisMock = new Redis();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
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

    // this assertion also (logically) checks if IORedis.Redis::psubscribe() was called as intended
    expect(redisMock['additionalData']['subscribedChannelPattern']).toBe(`${databasePrefix}*`);

    redisMock.pmessage(
      `${databasePrefix}*`,
      `${databasePrefix}${channelName}`,
      JSON.stringify({})
    );
  });

  it('parses the JSON message before calling the callback with it', (done) => {
    const redisMock = new Redis();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
      ''
    );
    const payload = {
      name: 'JoJo',
      email: 'za@waru.do',
      specialAbility: 'nigeroooh!',
    };

    redisSubscriber.subscribe(
      (_channelName, data) => {
        expect(data).toEqual(payload);
        done();
      },
      (errorMessage) => {
        throw new Error(errorMessage);
      }
    );

    redisMock.pmessage('*', 'Five-O', JSON.stringify(payload));
  });

  it("throws an error if 'psubscribe' fails", () => {
    const errorMessage = 'Could not subscribe to the redis server';
    const redisSubscriber = new RedisSubscriber(
      new Redis() as unknown as IORedis.Redis,
      `INVOKE_ERROR_CALLBACK_WITH_MESSAGE:${errorMessage}`
    );

    expect(() => {
      redisSubscriber.subscribe(
        () => undefined,
        () => undefined
      );
    }).toThrowError(errorMessage);
  });

  it("calls 'errorCallback' if an error occurs when parsing the json data received from 'pmessage'", (done) => {
    const databasePrefix = 'database-prefix-';
    const redisMock = new Redis();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
      databasePrefix
    );

    redisSubscriber.subscribe(
      () => undefined,
      (errorMessage) => {
        expect(errorMessage).toContain('Unexpected end of JSON input');
        done();
      }
    );

    redisMock.pmessage('', '', '');
  });

  it("calls 'errorCallback' if an error occurs when calling 'callback'", (done) => {
    const errorMessage = 'Something bad happened';
    const databasePrefix = 'database-prefix-';
    const redisMock = new Redis();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
      databasePrefix
    );

    redisSubscriber.subscribe(
      () => {
        throw new Error(errorMessage);
      },
      (errorMessageReceived) => {
        expect(errorMessageReceived).toContain(errorMessage);
        done();
      }
    );

    redisMock.pmessage('', '', JSON.stringify(null));
  });
});
