abstract class MessageBase {
  readonly messageType: string;

  constructor(messageType: string) {
    this.messageType = messageType;
  }
}

export {MessageBase};
