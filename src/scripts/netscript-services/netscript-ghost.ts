import {NS, RunOptions} from '@ns';

import {
  BASE_RAM_COST,
  HOME_SERVER_NAME,
  NETSCRIPT_SERVER_NAME,
} from '/scripts/common/shared';

import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {UNDEFINED_STR} from '/scripts/netscript-services/shared';
import {NETSCRIPT_SERVICES_PACKAGE} from '/scripts/netscript-services/package';
import {
  CMD_FLAG_FUNCTION_PATH,
  CMD_FLAG_PARAMETERS,
} from '/scripts/netscript-services/service-template';

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
type NetscriptGhost = {
  [K in keyof Promisify<NS>]: Promisify<NS>[K];
};
type NetscriptPackage = {
  ghost: NetscriptGhost;
  netscript: NS;
};
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ServiceFunc = (...args: any[]) => any;
type NetscriptExtended = NS & {heart: {break(): number}};

const MAX_RETRIES = 20;
const RETRY_DELAY = 250;
const DEFAULT_MEMBER_PATH = 'netscript';

const SERVICE_SCRIPTS_PATH = 'scripts/netscript-services';
const SERVICE_SCRIPT_FILE = `${SERVICE_SCRIPTS_PATH}/service-template.js`;

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

          if (!netscript.fileExists(SERVICE_SCRIPT_FILE, servicesHostname)) {
            netscript.scp(NETSCRIPT_SERVICES_PACKAGE, servicesHostname);
          }

          // All function calls through the Proxy will be offloaded to service scripts
          //   NOTE : These calls should use bracket notation to avoid incuring static ram usage in the consuming script
          //     Example : await nsLocator['getContractTypes']()
          const scriptCost =
            BASE_RAM_COST + netscript.getFunctionRamCost(fullMemberName);
          const scriptArgs = [
            getCmdFlag(CMD_FLAG_FUNCTION_PATH),
            fullMemberName,
          ];
          const execOptions: RunOptions = {
            temporary: true,
            ramOverride: scriptCost,
          };
          if (argArray.length > 0) {
            scriptArgs.push(getCmdFlag(CMD_FLAG_PARAMETERS));
            scriptArgs.push(JSON.stringify(argArray));
          }
          let servicePid = netscript.exec(
            SERVICE_SCRIPT_FILE,
            servicesHostname,
            execOptions,
            ...scriptArgs
          );
          for (
            let retryCount = 0;
            retryCount < MAX_RETRIES && servicePid < 1;
            retryCount++
          ) {
            await netscript.asleep(RETRY_DELAY);
            servicePid = netscript.exec(
              SERVICE_SCRIPT_FILE,
              servicesHostname,
              execOptions,
              ...scriptArgs
            );
          }
          if (servicePid < 1) {
            throw new Error(
              `Unable to offload netscript function '${memberNameStr}' - Insufficient RAM : ${netscript.formatRam(
                scriptCost
              )}`
            );
          }

          const servicePort = netscript.getPortHandle(servicePid);
          await servicePort.nextWrite();
          const resultRaw = servicePort.read();

          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          let result: any;
          if (resultRaw === UNDEFINED_STR) {
            result = undefined;
          } else if (typeof resultRaw === 'number') {
            result = resultRaw;
          } else {
            result = JSON.parse(resultRaw);
          }
          return result;
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

function getGhostPackage(netscript: NS): NetscriptPackage {
  const netscriptProxy = new Proxy(
    netscript,
    new NetscriptProxyHandler<NS>(netscript, DEFAULT_MEMBER_PATH)
  );
  const nsLocator = netscriptProxy as unknown as NetscriptGhost;

  return {ghost: nsLocator, netscript: netscript};
}

export {
  NetscriptGhost,
  NetscriptPackage,
  ServiceFunc,
  NetscriptExtended,
  getGhostPackage,
};
