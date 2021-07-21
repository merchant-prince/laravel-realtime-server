import IORedis from 'ioredis';
import RedisDatabase from '../../src/database/redis-database';
import Redis from '../utilities/mocks/redis';

describe('testing the RedisDatabase class', () => {
  it("creates a (unique) 'user-key' from the channel name and user data provided", () => {
    const channelName = 'One.Two';
    const userData = {
      id: 5443,
      name: 'PooN',
      email: 'noop@poon.oo',
    };
    expect(RedisDatabase['userKey'](channelName, userData)).toBe(
      `${channelName}:${userData.id}`
    );
  });

  it('gets the formatted data of a user from the associated socket id', async () => {
    expect.assertions(1);

    const socketId = 'fa34be5e3aa12';
    const userData = {
      name: 'Johny',
      color: 'yellow',
      eyeCount: 1,
    };
    const redisDatabase = new RedisDatabase(
      new Redis({
        [socketId]: JSON.stringify(userData),
      }) as unknown as IORedis.Redis
    );

    expect(await redisDatabase.getUserDataFromSocketId(socketId)).toEqual(
      userData
    );
  });

  it("returns 'null' for a non-existent socket id", async () => {
    expect.assertions(1);

    const redisDatabase = new RedisDatabase(
      new Redis() as unknown as IORedis.Redis
    );

    expect(
      await redisDatabase.getUserDataFromSocketId('non-existent-socket.id')
    ).toBeNull();
  });

  it("associates a user's data to a socket id", async () => {
    expect.assertions(1);

    const socketId = '14fab354effcda';
    const userData = {
      id: 555,
      address: 'over there',
    };
    const redis = new Redis();
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    await redisDatabase.associateUserDataToSocketId(userData, socketId);

    expect(redis['database'][socketId]).toBe(JSON.stringify(userData));
  });

  it("dissociates a user's data from a socket id", async () => {
    expect.assertions(1);

    const socketId = 'socket.idtoremove';
    const userData = {
      email: 'one@one.one',
    };
    const redis = new Redis({
      [socketId]: JSON.stringify(userData),
    });
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    await redisDatabase.dissociateUserDataFromSocketId(socketId);

    expect(redis['database'][socketId]).toBeUndefined();
  });

  it("increases or creates a user's socket count", async () => {
    expect.assertions(5);

    const channelName = 'le-channel-one';
    const userData = {
      id: 445,
      name: 'Four Four Five',
    };
    const redis = new Redis();
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    expect(
      RedisDatabase['userKey'](channelName, userData) in redis['database']
    ).toBeFalsy();

    expect(
      await redisDatabase.createOrIncreaseUserSocketCount(userData, channelName)
    ).toBe(1);
    expect(
      redis['database'][RedisDatabase['userKey'](channelName, userData)]
    ).toBe(1);

    expect(
      await redisDatabase.createOrIncreaseUserSocketCount(userData, channelName)
    ).toBe(2);
    expect(
      redis['database'][RedisDatabase['userKey'](channelName, userData)]
    ).toBe(2);
  });

  it("decreases or removes a user's socket count", async () => {
    expect.assertions(4);

    const channelName = 'le-channel-two';
    const userData = {
      id: 1001,
      name: 'One Two',
    };
    const redis = new Redis({
      [RedisDatabase['userKey'](channelName, userData)]: 2,
    });
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    expect(
      await redisDatabase.removeOrDecreaseUserSocketCount(userData, channelName)
    ).toBe(1);
    expect(
      redis['database'][RedisDatabase['userKey'](channelName, userData)]
    ).toBe(1);

    expect(
      await redisDatabase.removeOrDecreaseUserSocketCount(userData, channelName)
    ).toBe(0);
    expect(
      RedisDatabase['userKey'](channelName, userData) in redis['database']
    ).toBeFalsy();
  });

  it("retrieves a channel's members", async () => {
    expect.assertions(1);

    const channelName = 'NutPhux';
    const channelMembers = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' },
    ];
    const redis = new Redis({
      [channelName]: new Set(
        channelMembers.map((member) => JSON.stringify(member))
      ),
    });
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    expect(await redisDatabase.getChannelMembers(channelName)).toEqual(
      channelMembers
    );
  });

  it("adds a user's data to a set identified by a channel's name", async () => {
    expect.assertions(1);

    const channelName = 'OneTwo';
    const userData = {
      id: 4,
      name: 'Four',
    };
    const redis = new Redis({
      [channelName]: new Set(JSON.stringify({ id: 5, name: 'Five' })),
    });
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    await redisDatabase.addUserDataToChannel(userData, channelName);

    expect(redis['database'][channelName]).toContain(JSON.stringify(userData));
  });

  it("removes a user's data from a set identified by a channel's name", async () => {
    expect.assertions(1);

    const channelName = 'FiveSix';
    const userData = {
      id: 554,
      name: 'FiveFiveFour',
    };
    const redis = new Redis({
      [channelName]: new Set([
        JSON.stringify({ id: 14, name: 'Fourteen' }),
        JSON.stringify(userData),
      ]),
    });
    const redisDatabase = new RedisDatabase(redis as unknown as IORedis.Redis);

    await redisDatabase.removeUserDataFromChannel(userData, channelName);

    expect(redis['database'][channelName]).not.toContain(
      JSON.stringify(userData)
    );
  });
});
