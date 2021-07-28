import RedisDatabase from '../../src/database/redis-database';
import RedisMock from 'ioredis-mock';

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
      new RedisMock({
        data: {
          [socketId]: JSON.stringify(userData),
        },
      })
    );

    expect(await redisDatabase.getUserDataFromSocketId(socketId)).toEqual(
      userData
    );
  });

  it("returns 'null' for a non-existent socket id", async () => {
    expect.assertions(1);

    const redisDatabase = new RedisDatabase(new RedisMock());

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
    const redis = new RedisMock();
    const redisDatabase = new RedisDatabase(redis);

    await redisDatabase.associateUserDataToSocketId(userData, socketId);

    expect(await redis.get(socketId)).toBe(JSON.stringify(userData));
  });

  it("dissociates a user's data from a socket id", async () => {
    expect.assertions(1);

    const socketId = 'socket.idtoremove';
    const userData = {
      email: 'one@one.one',
    };
    const redis = new RedisMock({
      data: {
        [socketId]: JSON.stringify(userData),
      },
    });
    const redisDatabase = new RedisDatabase(redis);

    await redisDatabase.dissociateUserDataFromSocketId(socketId);

    expect(await redis.get(socketId)).toBeNull();
  });

  it("increases or creates a user's socket count", async () => {
    expect.assertions(3);

    const channelName = 'le-channel-one';
    const userData = {
      id: 445,
      name: 'Four Four Five',
    };
    const redis = new RedisMock();
    const redisDatabase = new RedisDatabase(redis);

    expect(
      await redis.get(RedisDatabase['userKey'](channelName, userData))
    ).toBeNull();
    expect(
      await redisDatabase.createOrIncreaseUserSocketCount(userData, channelName)
    ).toBe(1);
    expect(
      await redisDatabase.createOrIncreaseUserSocketCount(userData, channelName)
    ).toBe(2);
  });

  it("decreases or removes a user's socket count", async () => {
    expect.assertions(2);

    const channelName = 'le-channel-two';
    const userData = {
      id: 1001,
      name: 'One Two',
    };
    const redis = new RedisMock({
      data: {
        [RedisDatabase['userKey'](channelName, userData)]: 2,
      },
    });
    const redisDatabase = new RedisDatabase(redis);

    expect(
      await redisDatabase.removeOrDecreaseUserSocketCount(userData, channelName)
    ).toBe(1);
    expect(
      await redisDatabase.removeOrDecreaseUserSocketCount(userData, channelName)
    ).toBe(0);
  });

  it("retrieves a channel's members", async () => {
    expect.assertions(1);

    const channelName = 'Squee-Spleen-and-Spoon';
    const channelMembers = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' },
    ];
    const redis = new RedisMock({
      data: {
        [channelName]: new Set(
          channelMembers.map((member) => JSON.stringify(member))
        ),
      },
    });
    const redisDatabase = new RedisDatabase(redis);

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
    const redis = new RedisMock({
      data: {
        [channelName]: new Set(JSON.stringify({ id: 5, name: 'Five' })),
      },
    });
    const redisDatabase = new RedisDatabase(redis);

    await redisDatabase.addUserDataToChannel(userData, channelName);

    expect(await redis.smembers(channelName)).toContain(
      JSON.stringify(userData)
    );
  });

  it("removes a user's data from a set identified by a channel's name", async () => {
    expect.assertions(1);

    const channelName = 'FiveSix';
    const userDataToRemove = {
      id: 554,
      name: 'FiveFiveFour',
    };
    const redis = new RedisMock({
      data: {
        [channelName]: new Set(JSON.stringify(userDataToRemove)),
      },
    });
    const redisDatabase = new RedisDatabase(redis);

    await redisDatabase.removeUserDataFromChannel(
      userDataToRemove,
      channelName
    );

    expect(redis.smembers(channelName)).not.toContain(
      JSON.stringify(userDataToRemove)
    );
  });
});
