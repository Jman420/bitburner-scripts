import { NS } from "@ns";

type ServiceFunc = (...args: any[]) => any;

class MemberProxyHandler<T extends object> implements ProxyHandler<T> {
  get(target: T, memberName: string | symbol): any {
    const targetMember = target[memberName as keyof typeof target];
    if (typeof targetMember === 'function') {
      return new Proxy(targetMember, {
        apply(target, thisArg, argArray) {
          const endpoint = REGISTERED_ENDPOINTS.get(memberName as string);
          if (endpoint)
          {
            return endpoint(...argArray);
          }
          else {
            // Generate & run a new microservice script for the missing endpoint
            // Wait for the script to register itself
            // Call the newly registered function
          }
          return undefined;
        },
      });
    }

    const memberProxy = new MemberProxyHandler();
    return new Proxy(targetMember as object, memberProxy);
  }
}

const REGISTERED_ENDPOINTS = new Map<string, ServiceFunc>();

function getLocator(netscript: NS) {
  return new Proxy(netscript, new MemberProxyHandler<NS>());
}

function registerEndpoint<T>(netscriptObject: T, functionName: keyof T) {
  const functionNameStr = functionName as string;
  const functionPtr = netscriptObject[functionName] as ServiceFunc;
  if (!REGISTERED_ENDPOINTS.has(functionName as string)) {
    REGISTERED_ENDPOINTS.set(functionNameStr, functionPtr);
  }
}

function removeEndpoint<T>(netscriptObject: T, functionName: keyof T) {
  REGISTERED_ENDPOINTS.delete(functionName as string);
}

export {getLocator, registerEndpoint, removeEndpoint};
