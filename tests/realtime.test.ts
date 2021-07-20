import Realtime from "../src/realtime";

describe('testing the Realtime class', () => {
  it('correct determines whether a channel is a presence channel', () => {
    const presenceChannel = 'presence-One.Two';
    const nonPresenceChannel = 'private-nope';

    expect(Realtime['isPresenceChannel'](presenceChannel)).toBeTruthy();
    expect(Realtime['isPresenceChannel'](nonPresenceChannel)).toBeFalsy();
  });
});
