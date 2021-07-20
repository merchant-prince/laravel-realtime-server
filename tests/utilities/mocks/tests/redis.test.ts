import Redis from '../redis';

describe('testing the redis mock', () => {
  it('retrieves the value linked to a key', async () => {
    expect.assertions(2);

    const redis = new Redis({
      one: 1,
    });

    expect(await redis.get('one')).toBe(1);
    expect(await redis.get('zero')).toBeUndefined();
  });

  it('associates a value to a key', async () => {
    expect.assertions(2);

    const redis = new Redis({
      foo: 'bar',
    });

    await redis.set('foo', 'baz');
    expect(await redis.get('foo')).toBe('baz');

    await redis.set('bar', 'pof');
    expect(await redis.get('bar')).toBe('pof');
  });

  it('removes a key from the database', async () => {
    expect.assertions(1);

    const redis = new Redis({
      baz: 'remove-me',
    });

    await redis.del('baz');
    expect(await redis.get('baz')).toBeUndefined();
  });

  it('increments the value associated to a key in the database', async () => {
    expect.assertions(5);

    const redis = new Redis({
      count: 44,
    });
    const incrementedCount = await redis.incr('count');

    expect(incrementedCount).toBe(45);
    expect(await redis.get('count')).toBe(45);

    expect(await redis.get('newCount')).toBeUndefined();
    expect(await redis.incr('newCount')).toBe(1);
    expect(await redis.get('newCount')).toBe(1);
  });

  it('decrements the value associated to a key in the database', async () => {
    expect.assertions(2);

    const redis = new Redis({
      count: 2,
    });
    const decrementedCount = await redis.decr('count');

    expect(decrementedCount).toBe(1);
    expect(await redis.get('count')).toBe(1);
  });

  it('returns all the members of a set in the database', async () => {
    expect.assertions(1);

    const redis = new Redis({
      'tiny-set': new Set(['one', 'two']),
    });

    expect(await redis.smembers('tiny-set')).toEqual(['one', 'two']);
  });

  it('adds data to a set in the database', async () => {
    expect.assertions(3);

    const redis = new Redis({
      'yu:gi:oh': new Set(['red', 'blue']),
    });

    await redis.sadd('yu:gi:oh', 'yellow');
    expect(await redis.smembers('yu:gi:oh')).toEqual(['red', 'blue', 'yellow']);

    expect('beyblade' in redis['database']).toBeFalsy();
    await redis.sadd('beyblade', 'spinner');
    expect(await redis.smembers('beyblade')).toEqual(['spinner']);
  });

  it('removes data from a set in the database', async () => {
    const redis = new Redis({
      trix: new Set([997, 5043]),
    });

    expect(await redis.smembers('trix')).toEqual([997, 5043]);

    await redis.srem('trix', 5043);
    expect(await redis.smembers('trix')).toEqual([997]);

    await redis.srem('trix', 997);
    expect('trix' in redis['database']).toBeFalsy();
  });

  it("sets the 'subscribedChannelPattern' when 'psubscribe' is called", () => {
    const redis = new Redis();

    redis.psubscribe('one*', () => undefined);

    expect(redis['additionalData']['subscribedChannelPattern']).toBe('one*');
  });

  it("calls the 'errorCallback' if the 'subscribedChannelPattern' starts with 'INVOKE_ERROR_CALLBACK_WITH_MESSAGE:'", () => {
    expect.assertions(1);

    const errorMessage = 'An error occured';
    const redis = new Redis();

    redis.psubscribe(
      `INVOKE_ERROR_CALLBACK_WITH_MESSAGE:${errorMessage}*`,
      (error) => {
        expect(error.message).toBe(errorMessage);
      }
    );
  });

  it("emits a 'pmessage' event when the 'pmessage' method is called", (done) => {
    const redis = new Redis();
    const [pattern, prefixedChannelName, message] = [
      '*',
      'private-one',
      'hello, world!',
    ];

    redis.on(
      'pmessage',
      (receivedPattern, receivedPrefixedChannelName, receivedMessage) => {
        expect([
          receivedPattern,
          receivedPrefixedChannelName,
          receivedMessage,
        ]).toEqual([pattern, prefixedChannelName, message]);
        done();
      }
    );

    redis.pmessage(pattern, prefixedChannelName, message);
  });
});
