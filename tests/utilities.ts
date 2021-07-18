import EventEmitter from 'events';

export class RedisMock extends EventEmitter {
  private _subscribedChannelPattern?: string;
  private _psubscribeError?: string;

  public get subscribedChannelPattern(): string | undefined {
    return this._subscribedChannelPattern;
  }

  public set psubscribeError(message: string) {
    this._psubscribeError = message;
  }

  public pmessage(
    pattern: string,
    prefixedChannelName: string,
    message: string
  ): void {
    this.emit('pmessage', pattern, prefixedChannelName, message);
  }

  public psubscribe(
    subscribedChannelPattern: string,
    callback: (error?: { message: string }) => void
  ): void {
    this._subscribedChannelPattern = subscribedChannelPattern;

    callback(
      this._psubscribeError ? { message: this._psubscribeError } : undefined
    );
  }
}
