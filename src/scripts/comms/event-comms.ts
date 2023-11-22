import {NS} from '@ns';

import {MessageBase} from '/scripts/comms/msg-base';
import {ExitEvent} from '/scripts/comms/events/exit-event';

type OmitFirstParam<TFunc> = TFunc extends (
  data: MessageBase,
  ...args: infer TArgs
) => infer TRemoved
  ? (...args: TArgs) => TRemoved
  : never;
type CallbackFunc<TData extends MessageBase> = (
  data: TData,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ...args: any[]
) => Promise<void> | void;

interface SubscriberDetails<
  TData extends MessageBase,
  TCallbackFunc extends CallbackFunc<TData>,
> {
  subscriberName: string;
  callbackFunc: TCallbackFunc;
  functionArgs: Parameters<OmitFirstParam<TCallbackFunc>>;
}

// Map Structure : key1 - messageType , value1 - subscriberMap ; key2 - subscriberName , value2 - subscriberDetails
const EVENT_LISTENER_MAP = new Map<
  string,
  Map<string, SubscriberDetails<MessageBase, CallbackFunc<MessageBase>>[]>
>();

class EventListener {
  readonly subscriberName: string;
  readonly messageTypes: Set<string>;

  constructor(subscriberName: string) {
    this.subscriberName = subscriberName;
    this.messageTypes = new Set<string>();

    this.addListener(ExitEvent, this.removeAllListeners.bind(this));
  }

  public addListener<
    TData extends MessageBase,
    TFunc extends CallbackFunc<MessageBase>,
  >(
    messageType: {new (): TData},
    callbackFunc: TFunc,
    ...callbackArgs: Parameters<OmitFirstParam<typeof callbackFunc>>
  ) {
    const dummyMsg = new messageType();
    const subscriptions = this.getSubscriptions(dummyMsg);

    if (
      !subscriptions.find(
        value =>
          value.callbackFunc === callbackFunc &&
          value.functionArgs === callbackArgs
      )
    ) {
      subscriptions.push({
        subscriberName: this.subscriberName,
        callbackFunc: callbackFunc,
        functionArgs: callbackArgs,
      });
      this.setListeners(dummyMsg, subscriptions);
      this.messageTypes.add(dummyMsg.messageType);
    }
  }

  public removeListeners<TData extends MessageBase>(
    messageType: {new (): TData},
    ...callbackFuncs: CallbackFunc<MessageBase>[]
  ) {
    const dummyMsg = new messageType();
    const currentSubscriptions = this.getSubscriptions(dummyMsg);
    const updatedSubscriptions = currentSubscriptions.filter(
      subscriber => !callbackFuncs.includes(subscriber.callbackFunc)
    );
    this.setListeners(dummyMsg, updatedSubscriptions);

    if (updatedSubscriptions.length < 1) {
      const subscriberMap = this.getSubscriberMap(dummyMsg);
      subscriberMap.delete(this.subscriberName);
      this.messageTypes.delete(dummyMsg.messageType);
    }
  }

  public removeAllListeners() {
    for (const msgType of this.messageTypes) {
      const msgSubscriberMap = EVENT_LISTENER_MAP.get(msgType);
      if (msgSubscriberMap) {
        msgSubscriberMap.delete(this.subscriberName);
        EVENT_LISTENER_MAP.set(msgType, msgSubscriberMap);
      }
    }
    this.messageTypes.clear();
  }

  private getSubscriptions<TData extends MessageBase>(dummyMsg: TData) {
    const subscriberMap = this.getSubscriberMap(dummyMsg);
    const listeners =
      subscriberMap.get(this.subscriberName) ??
      new Array<SubscriberDetails<MessageBase, CallbackFunc<MessageBase>>>();
    return listeners;
  }

  private setListeners<TData extends MessageBase>(
    dummyMsg: TData,
    listeners: SubscriberDetails<MessageBase, CallbackFunc<MessageBase>>[]
  ) {
    const subscriberMap = this.getSubscriberMap(dummyMsg);
    subscriberMap.set(this.subscriberName, listeners);
    EVENT_LISTENER_MAP.set(dummyMsg.messageType, subscriberMap);
  }

  private getSubscriberMap<TData extends MessageBase>(dummyMsg: TData) {
    return (
      EVENT_LISTENER_MAP.get(dummyMsg.messageType) ??
      new Map<
        string,
        SubscriberDetails<MessageBase, CallbackFunc<MessageBase>>[]
      >()
    );
  }
}

async function sendMessage<TData extends MessageBase>(
  data: TData,
  recipient?: string
) {
  if (!data.messageType) {
    return false;
  }

  const subscriberMap = EVENT_LISTENER_MAP.get(data.messageType);
  if (!subscriberMap) {
    return false;
  }

  let subscribers: SubscriberDetails<TData, CallbackFunc<TData>>[];
  if (recipient) {
    subscribers = subscriberMap.get(recipient) ?? [];
  } else {
    subscribers = [];
    for (const subscriberFuncs of subscriberMap.values()) {
      subscribers.push(...subscriberFuncs);
    }
  }
  if (subscribers.length < 1) {
    return false;
  }

  for (const subscriberDetails of subscribers) {
    await subscriberDetails.callbackFunc(
      data,
      ...subscriberDetails.functionArgs
    );
  }
  return true;
}

async function sendMessageRetry<TData extends MessageBase>(
  netscript: NS,
  data: TData,
  recipient?: string,
  retryCount = 5,
  retryDelay = 500
) {
  if (!data.messageType) {
    return false;
  }

  let sendSuccess = await sendMessage(data, recipient);
  for (
    let tryCounter = 0;
    tryCounter < retryCount && !sendSuccess;
    tryCounter++
  ) {
    await netscript.asleep(retryDelay);
    sendSuccess = await sendMessage(data, recipient);
  }
  return sendSuccess;
}

export {CallbackFunc, EventListener, sendMessage, sendMessageRetry};
