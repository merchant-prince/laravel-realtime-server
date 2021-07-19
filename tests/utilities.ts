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

  public psubscribe(
    subscribedChannelPattern: string,
    errorCallback: (error: { message: string }) => void
  ): void {
    const invokeErrorCallbackPrefix = 'INVOKE_ERROR_CALLBACK_WITH_MESSAGE:';

    if (subscribedChannelPattern.startsWith(invokeErrorCallbackPrefix)) {
      errorCallback({
        message: subscribedChannelPattern.substring(
          invokeErrorCallbackPrefix.length,
          subscribedChannelPattern.length - 1
        ),
      });
    } else {
      this._subscribedChannelPattern = subscribedChannelPattern;
    }
  }
}
