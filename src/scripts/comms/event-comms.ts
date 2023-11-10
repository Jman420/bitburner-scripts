import {NS} from '@ns';

import {MessageBase} from '/scripts/comms/msg-base';

type ListenerFunc<TData extends MessageBase> = (
  data: TData
) => Promise<void> | void;

// Map Structure : key1 - messageType , value1 - subscriberMap ; key2 - subscriberName , value2 - listenerFunc
const EVENT_LISTENER_MAP = new Map<
  string,
  Map<string, ListenerFunc<MessageBase>[]>
>();

class EventListener {
  readonly subscriberName: string;
  readonly messageTypes: Set<string>;

  constructor(netscript: NS, subscriberName: string) {
    this.subscriberName = subscriberName;
    this.messageTypes = new Set<string>();

    netscript.atExit(this.removeAllListeners.bind(this));
  }

  public addListeners<TData extends MessageBase>(
    messageType: {new (): TData},
    ...callbackFuncs: ListenerFunc<MessageBase>[]
  ) {
    const dummyMsg = new messageType();
    const listeners = this.getListeners(dummyMsg);
    let callbacksAdded = false;
    for (const callback of callbackFuncs) {
      if (!listeners.includes(callback)) {
        listeners.push(callback);
        callbacksAdded = true;
      }
    }

    if (callbacksAdded) {
      this.setListeners(dummyMsg, listeners);
      this.messageTypes.add(dummyMsg.messageType);
    }
  }

  public removeListeners<TData extends MessageBase>(
    messageType: {new (): TData},
    ...callbackFuncs: ListenerFunc<MessageBase>[]
  ) {
    const dummyMsg = new messageType();
    const prevListeners = this.getListeners(dummyMsg);
    const updatedListeners = prevListeners.filter(
      listener => !callbackFuncs.includes(listener)
    );
    this.setListeners(dummyMsg, updatedListeners);

    if (updatedListeners.length < 1) {
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

  private getListeners<TData extends MessageBase>(dummyMsg: TData) {
    const subscriberMap = this.getSubscriberMap(dummyMsg);
    const listeners =
      subscriberMap.get(this.subscriberName) ??
      new Array<ListenerFunc<MessageBase>>();
    return listeners;
  }

  private setListeners<TData extends MessageBase>(
    dummyMsg: TData,
    listeners: ListenerFunc<MessageBase>[]
  ) {
    const subscriberMap = this.getSubscriberMap(dummyMsg);
    subscriberMap.set(this.subscriberName, listeners);
    EVENT_LISTENER_MAP.set(dummyMsg.messageType, subscriberMap);
  }

  private getSubscriberMap<TData extends MessageBase>(dummyMsg: TData) {
    return (
      EVENT_LISTENER_MAP.get(dummyMsg.messageType) ??
      new Map<string, ListenerFunc<MessageBase>[]>()
    );
  }
}

async function sendEvent<TData extends MessageBase>(
  data: TData,
  subscriber?: string
) {
  if (!data.messageType) {
    return false;
  }

  const subscriberMap = EVENT_LISTENER_MAP.get(data.messageType);
  if (!subscriberMap) {
    return true;
  }

  let listenerFuncs: ListenerFunc<TData>[];
  if (subscriber) {
    listenerFuncs = subscriberMap.get(subscriber) ?? [];
  } else {
    listenerFuncs = [];
    for (const subscriberFuncs of subscriberMap.values()) {
      listenerFuncs.push(...subscriberFuncs);
    }
  }

  for (const callback of listenerFuncs) {
    await callback(data);
  }
  return true;
}

export {ListenerFunc, EventListener, sendEvent};
