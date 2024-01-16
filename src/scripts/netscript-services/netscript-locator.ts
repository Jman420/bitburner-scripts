import {NS} from '@ns';

import {HOME_SERVER_NAME, NETSCRIPT_SERVER_NAME} from '/scripts/common/shared';

import {NETSCRIPT_SERVICES_PACKAGE} from '/scripts/netscript-services/package';

type Promisify<T> = {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [K in keyof T]: T[K] extends (...args: any[]) => infer R
    ? /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      R extends Promise<any>
      ? T[K]
      : (...args: Parameters<T[K]>) => Promise<R>
    : T[K] extends object
    ? Promisify<T[K]>
    : T[K];
};
type NetscriptLocator = {
  [K in keyof Promisify<NS>]: Promisify<NS>[K];
};
type NetscriptPackage = {
  locator: NetscriptLocator;
  netscript: NS;
};
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ServiceFunc = (...args: any[]) => any;

const DEBUG = false;

const MAX_RETRIES = 5;
const RETRY_DELAY = 500;
const DEFAULT_MEMBER_PATH = 'netscript';

const SERVICE_SCRIPTS_PATH = 'scripts/netscript-services';
const SERVICE_SCRIPT_TEMPLATE_FILE = `${SERVICE_SCRIPTS_PATH}/service-template.js`;
const SERVICE_SCRIPT_NETSCRIPT_PATH_FIELD = 'netscript.path';
const SERVICE_SCRIPT_FUNCTION_FIELD = 'FUNCTION_NAME';
const SERVICE_SCRIPT_SHUTDOWN_DELAY = 'SHUTDOWN_DELAY';

const DEFAULT_SHUTDOWN_DELAY = 'await netscript.asleep(100)';
const SHUTDOWN_DELAY_MAP = new Map<string, string>();

const REGISTERED_ENDPOINTS = new Map<string, ServiceFunc>();

let serviceScriptTemplate: string;

class NetscriptProxyHandler<TTarget extends NS>
  implements ProxyHandler<TTarget>
{
  readonly netscript: NS;
  readonly memberPath: string;

  constructor(netscript: NS, memberPath: string) {
    this.netscript = netscript;
    this.memberPath = memberPath;
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  get(target: TTarget, memberName: string | symbol): any {
    const targetMember = target[memberName as keyof TTarget];
    const memberNameStr = memberName as string;

    if (typeof targetMember === 'function') {
      const memberPath = this.memberPath;
      const netscript = this.netscript;

      return new Proxy(targetMember, {
        async apply(target, thisArg, argArray) {
          const trimmedMemberPath = memberPath
            .replace(`${DEFAULT_MEMBER_PATH}.`, '')
            .replace(DEFAULT_MEMBER_PATH, '');
          const fullMemberName = trimmedMemberPath
            ? `${trimmedMemberPath}.${memberNameStr}`
            : memberNameStr;
          const servicesHostname = netscript.serverExists(NETSCRIPT_SERVER_NAME)
            ? NETSCRIPT_SERVER_NAME
            : HOME_SERVER_NAME;
          const scriptName = `${SERVICE_SCRIPTS_PATH}/${memberNameStr}.js`;

          if (!netscript.fileExists(scriptName, servicesHostname) || DEBUG) {
            // Generate the service script
            const shutdownDelay =
              SHUTDOWN_DELAY_MAP.get(trimmedMemberPath) ??
              SHUTDOWN_DELAY_MAP.get(fullMemberName) ??
              DEFAULT_SHUTDOWN_DELAY;
            const serviceContents = serviceScriptTemplate
              .replaceAll(SERVICE_SCRIPT_NETSCRIPT_PATH_FIELD, memberPath)
              .replaceAll(SERVICE_SCRIPT_FUNCTION_FIELD, memberNameStr)
              .replaceAll(SERVICE_SCRIPT_SHUTDOWN_DELAY, shutdownDelay);
            netscript.write(scriptName, serviceContents, 'w');
            if (servicesHostname !== HOME_SERVER_NAME) {
              const scriptsPackage = NETSCRIPT_SERVICES_PACKAGE.concat([
                scriptName,
              ]);
              netscript.scp(scriptsPackage, servicesHostname);
            }
          }

          // If there is a registered endpoint for the function then use it
          let endpoint = REGISTERED_ENDPOINTS.get(memberNameStr);
          if (endpoint) {
            return endpoint(...argArray);
          }

          // All function calls through the Proxy will be offloaded to service scripts
          //   NOTE : These calls should use bracket notation to avoid incuring static ram usage in the consuming script
          //     Example : await nsLocator['getContractTypes']()
          const functionCost = netscript.getFunctionRamCost(fullMemberName);
          let servicePid = netscript.exec(scriptName, servicesHostname, {
            temporary: true,
          });
          for (
            let retryCount = 0;
            retryCount < MAX_RETRIES && servicePid < 1;
            retryCount++
          ) {
            await netscript.asleep(RETRY_DELAY);
            servicePid = netscript.exec(scriptName, servicesHostname, {
              temporary: true,
            });
          }
          if (servicePid < 1) {
            throw new Error(
              `Unable to offload netscript function ${memberNameStr} - Insufficient RAM : ${functionCost}`
            );
          }

          const servicePort = netscript.getPortHandle(servicePid);
          await servicePort.nextWrite();
          endpoint = REGISTERED_ENDPOINTS.get(memberNameStr);
          if (!endpoint) {
            throw new Error(
              `Unable to offload netscript function ${memberNameStr} - Endpoint function not found`
            );
          }
          return endpoint(...argArray);
        },
      });
    }

    const memberProxy = new NetscriptProxyHandler(
      this.netscript,
      `${this.memberPath}.${memberNameStr}`
    );
    return new Proxy(targetMember as object, memberProxy);
  }
}

function getLocatorPackage(netscript: NS): NetscriptPackage {
  if (!serviceScriptTemplate) {
    serviceScriptTemplate = netscript.read(SERVICE_SCRIPT_TEMPLATE_FILE);
  }

  const netscriptProxy = new Proxy(
    netscript,
    new NetscriptProxyHandler<NS>(netscript, DEFAULT_MEMBER_PATH)
  );
  const nsLocator = netscriptProxy as unknown as NetscriptLocator;

  return {locator: nsLocator, netscript: netscript};
}

function registerEndpoint<T>(
  netscriptObject: T,
  functionName: keyof T,
  handler: ServiceFunc
) {
  const functionNameStr = functionName as string;
  if (!REGISTERED_ENDPOINTS.has(functionNameStr)) {
    REGISTERED_ENDPOINTS.set(functionNameStr, handler);
  }
}

function removeEndpoint<T>(netscriptObject: T, functionName: keyof T) {
  REGISTERED_ENDPOINTS.delete(functionName as string);
}

export {
  NetscriptLocator,
  NetscriptPackage,
  ServiceFunc,
  getLocatorPackage,
  registerEndpoint,
  removeEndpoint,
};
