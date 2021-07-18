import IORedis from 'ioredis';
import { RedisMock } from '../utilities';
import RedisSubscriber from '../../src/subscriber/redis-subscriber';

describe('testing the RedisSubscriber class', () => {
  it('sanitizes the channel name before calling the callback with it', (done) => {
    const databasePrefix = 'database-prefix-';
    const channelName = 'OneTwo';
    const redisMock = new RedisMock();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
      databasePrefix
    );

    redisSubscriber.subscribe((channelNameReceived) => {
      expect(channelNameReceived).toBe(channelName);
      done();
    });

    // this assertion also (logically) checks if IORedis.Redis::psubscribe() was called as intended
    expect(redisMock.subscribedChannelPattern).toBe(`${databasePrefix}*`);

    redisMock.pmessage(
      `${databasePrefix}*`,
      `${databasePrefix}${channelName}`,
      JSON.stringify({})
    );
  });

  it('parses the JSON message before calling the callback with it', (done) => {
    const redisMock = new RedisMock();
    const redisSubscriber = new RedisSubscriber(
      redisMock as unknown as IORedis.Redis,
      ''
    );
    const payload = {
      name: 'JoJo',
      email: 'za@waru.do',
      specialAbility: 'nigeroooh!',
    };

    redisSubscriber.subscribe((_channelName, data) => {
      expect(data).toEqual(payload);
      done();
    });

    redisMock.pmessage('*', 'Five-O', JSON.stringify(payload));
  });
});
