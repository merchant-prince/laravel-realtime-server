import EventEmitter from 'events';

export class RedisMock extends EventEmitter {
  private _subscribedChannelPattern?: string;

  public get subscribedChannelPattern(): string | undefined {
    return this._subscribedChannelPattern;
  }

  public pmessage(
    pattern: string,
    prefixedChannelName: string,
    message: string
  ): void {
    this.emit('pmessage', pattern, prefixedChannelName, message);
  }

  public psubscribe(subscribedChannelPattern: string): void {
    this._subscribedChannelPattern = subscribedChannelPattern;
  }
}
