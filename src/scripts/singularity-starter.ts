import {CrimeTask, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {initializeScript, runScript} from '/scripts/workflows/execution';
import {openTail} from '/scripts/workflows/ui';

import {
  NetscriptExtended,
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

import {
  CMD_FLAG_PURCHASE_NODES,
  CMD_FLAG_PURCHASE_UPGRADES,
  HACKNET_MANAGER_SCRIPT,
} from '/scripts/hacknet-manager';
import {ROOT_HOSTS_SCRIPT} from '/scripts/hosts-root';
import {
  CMD_FLAG_INCLUDE_HOME,
  CMD_FLAG_OPTIMAL_ONLY,
  FARM_HACK_EXP_SCRIPT,
} from '/scripts/farm-hackExp';
import {SERVER_LAMBDA_SCRIPT} from '/scripts/server-lambda';
import {SCRIPTS_KILL_ALL_SCRIPT} from '/scripts/scripts-kill-all';
import {WGWH_SERIAL_ATTACK_SCRIPT} from '/scripts/wgwh-serial';

import {FactionName} from '/scripts/data/faction-enums';
import {FactionData} from '/scripts/data/faction-data';
import {ProgramData} from '/scripts/data/program-data';
import {UniversityName} from '/scripts/data/university-enums';
import {HOME_SERVER_NAME, NETSCRIPT_SERVER_NAME} from '/scripts/common/shared';

import {
  filterHostsCanHack,
  findHostPath,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  attendCourse,
  backdoorHost,
  getRemainingPrograms,
} from '/scripts/workflows/singularity';
import {WGWH_BATCH_ATTACK_SCRIPT} from '/scripts/wgwh-batch';

const MODULE_NAME = 'singularity-starter';
const SUBSCRIBER_NAME = 'singularity-starter';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const WAIT_DELAY = 500;
const MIN_HACK_LEVEL = 10;
const ATTACK_TARGETS_NEED = 10;
const HOME_TARGET_RAM = 10000; // 10TB
const HOME_TARGET_CORES = 4;
const BATCH_ATTACH_RAM_NEEDED = 8000; //8TB

async function handleHackingActivity(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Hacking -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  logWriter.writeLine(
    `${logPrefix} Killing hack exp farm script on home server...`
  );
  await nsLocator['scriptKill'](FARM_HACK_EXP_SCRIPT, HOME_SERVER_NAME);

  logWriter.writeLine(
    `${logPrefix} Rooting & expanding hack exp farm on new hosts...`
  );
  runScript(netscript, ROOT_HOSTS_SCRIPT);
  runScript(
    netscript,
    FARM_HACK_EXP_SCRIPT,
    undefined,
    1,
    false,
    getCmdFlag(CMD_FLAG_OPTIMAL_ONLY),
    3,
    netscript.serverExists(NETSCRIPT_SERVER_NAME)
      ? getCmdFlag(CMD_FLAG_INCLUDE_HOME)
      : ''
  );

  logWriter.writeLine(
    `${logPrefix} Waiting for ${ATTACK_TARGETS_NEED} attack targets...`
  );
  let attackTargets = filterHostsCanHack(
    netscript,
    scanWideNetwork(netscript, false, true, false, true)
  );
  while (attackTargets.length < ATTACK_TARGETS_NEED) {
    await netscript.asleep(WAIT_DELAY);
    attackTargets = filterHostsCanHack(
      netscript,
      scanWideNetwork(netscript, false, true, false, true)
    );
  }

  logWriter.writeLine(`${logPrefix} Killing hack exp farm scripts...`);
  runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT);

  logWriter.writeLine(`${logPrefix} Running WGWH serial attack script...`);
  runScript(netscript, ROOT_HOSTS_SCRIPT);
  runScript(
    netscript,
    WGWH_SERIAL_ATTACK_SCRIPT,
    undefined,
    1,
    false,
    netscript.serverExists(NETSCRIPT_SERVER_NAME)
      ? getCmdFlag(CMD_FLAG_INCLUDE_HOME)
      : ''
  );

  logWriter.writeLine(
    `${logPrefix} Waiting for sufficient available RAM for WGWH batch attacks...`
  );
  const homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  while (homeServerInfo.maxRam < BATCH_ATTACH_RAM_NEEDED) {
    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Killing WGWH serial attack scripts...`);
  runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT);
  await nsLocator['scriptKill'](WGWH_SERIAL_ATTACK_SCRIPT, HOME_SERVER_NAME);

  logWriter.writeLine(`${logPrefix} Running WGWH batch attack script...`);
  runScript(netscript, ROOT_HOSTS_SCRIPT);
  runScript(
    netscript,
    WGWH_BATCH_ATTACK_SCRIPT,
    undefined,
    1,
    false,
    netscript.serverExists(NETSCRIPT_SERVER_NAME)
      ? getCmdFlag(CMD_FLAG_INCLUDE_HOME)
      : ''
  );

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleFactionMembership(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Faction -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(`${logPrefix} Waiting on membership eligibility...`);
  let playerInfo = await nsLocator['getPlayer']();
  let unjoinedFactions = Object.values(FactionName)
    .map(value => value.toString())
    .filter(value => !playerInfo.factions.includes(value));
  while (unjoinedFactions.length > 0) {
    const pendingInvites = await singularityApi['checkFactionInvitations']();
    for (const invitingFaction of pendingInvites) {
      if (unjoinedFactions.includes(invitingFaction)) {
        logWriter.writeLine(
          `${logPrefix} Joining faction : ${invitingFaction}`
        );
        await singularityApi['joinFaction'](invitingFaction);
      }
    }

    playerInfo = await nsLocator['getPlayer']();
    unjoinedFactions = unjoinedFactions.filter(
      value => !playerInfo.factions.includes(value)
    );
    for (const factionName of unjoinedFactions) {
      const factionData = FactionData[factionName];
      if (
        factionData.server &&
        netscript.getServerRequiredHackingLevel(factionData.server) <=
          playerInfo.skills.hacking
      ) {
        const hostPath = findHostPath(
          netscript,
          HOME_SERVER_NAME,
          factionData.server
        );
        if (!hostPath) {
          logWriter.writeLine(
            `${logPrefix} Unable to install backdoor for faction.  Unable to find host path to server : ${factionData.server}`
          );
          continue;
        }

        const factionServer = await nsLocator['getServer'](factionData.server);
        if (!factionServer.backdoorInstalled) {
          logWriter.writeLine(
            `${logPrefix} Installing backdoor on server : ${factionData.server} to join faction : ${factionName}`
          );
          await backdoorHost(nsLocator, hostPath);
          logWriter.writeLine(
            `${logPrefix} Installed backdoor on server : ${factionData.server}`
          );
        }
      }
    }

    await netscript.asleep(WAIT_DELAY);
    playerInfo = await nsLocator['getPlayer']();
    unjoinedFactions = unjoinedFactions.filter(
      value => !playerInfo.factions.includes(value)
    );
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleWorkTasks(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Work -';
  const karmaLimit = -54000;

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;
  const netscriptExtended = netscript as NetscriptExtended;

  logWriter.writeLine(
    `${logPrefix} Waiting for karma to reach ${karmaLimit} and all hacking programs created...`
  );
  let remainingPrograms = getRemainingPrograms(netscript);
  let currentKarma = netscriptExtended.heart.break();
  while (currentKarma > karmaLimit && remainingPrograms.length > 0) {
    for (const programKey of remainingPrograms) {
      const programData = ProgramData[programKey];
      if (
        !netscript.fileExists(programData.name, HOME_SERVER_NAME) &&
        (await singularityApi['createProgram'](programData.name))
      ) {
        logWriter.writeLine(
          `${logPrefix} Crime put on hold to create ${programKey}...`
        );
        // Note : The createProgram() function returns a boolean to indicate if the job assignment was successful
        while (
          netscript.singularity.getCurrentWork()?.type === 'CREATE_PROGRAM'
        ) {
          await netscript.asleep(WAIT_DELAY);
        }

        logWriter.writeLine(
          `${logPrefix} Rooting all newly available hosts...`
        );
        runScript(netscript, ROOT_HOSTS_SCRIPT);
      }
    }

    if (currentKarma > karmaLimit) {
      const currentWork = (await singularityApi['getCurrentWork']()) as
        | CrimeTask
        | undefined;
      const crimeJob =
        (await singularityApi['getCrimeChance']('Homicide')) >= 0.8
          ? 'Homicide'
          : 'Mug';
      if (!currentWork || currentWork.crimeType !== crimeJob) {
        logWriter.writeLine(
          `${logPrefix} Committing crime for cash & karma : ${crimeJob}`
        );
        await singularityApi['commitCrime'](crimeJob);
      }
    } else {
      logWriter.writeLine(
        `${logPrefix} Taking Algorithms course at ZB Institute...`
      );
      await attendCourse(
        nsPackage,
        UniversityName.ZB,
        netscript.enums.UniversityClassType.algorithms
      );
    }

    await netscript.asleep(WAIT_DELAY);
    currentKarma = netscriptExtended.heart.break();
    remainingPrograms = getRemainingPrograms(netscript);
  }

  logWriter.writeLine(
    `${logPrefix} Taking Algorithms course at ZB Institute...`
  );
  await attendCourse(
    nsPackage,
    UniversityName.ZB,
    netscript.enums.UniversityClassType.algorithms
  );
  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleLambdaServerPurchased(netscript: NS, logWriter: Logger) {
  const logPrefix = 'Lambda -';

  logWriter.writeLine(
    `${logPrefix} Waiting for Lambda Server to be purchased...`
  );
  while (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
    await netscript.asleep(WAIT_DELAY);
  }

  const attackTargets = filterHostsCanHack(
    netscript,
    scanWideNetwork(netscript, false, true, false, true)
  );
  if (attackTargets.length < ATTACK_TARGETS_NEED) {
    logWriter.writeLine(
      `${logPrefix} Including home server in hack exp farm...`
    );
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT);
    runScript(
      netscript,
      FARM_HACK_EXP_SCRIPT,
      undefined,
      1,
      false,
      getCmdFlag(CMD_FLAG_OPTIMAL_ONLY),
      3,
      getCmdFlag(CMD_FLAG_INCLUDE_HOME)
    );
  } else {
    logWriter.writeLine(
      `${logPrefix} Including home server in wgwh serial attack...`
    );
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT);
    netscript.scriptKill(WGWH_SERIAL_ATTACK_SCRIPT, HOME_SERVER_NAME);

    runScript(
      netscript,
      WGWH_SERIAL_ATTACK_SCRIPT,
      undefined,
      1,
      false,
      getCmdFlag(CMD_FLAG_INCLUDE_HOME)
    );
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handlePurchasePrograms(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  const logPrefix = 'Tor -';

  logWriter.writeLine(`${logPrefix} Waiting to purchase Tor Router...`);
  while (
    !netscript.hasTorRouter() &&
    !(await singularityApi['purchaseTor']())
  ) {
    await netscript.asleep(WAIT_DELAY);
  }
  logWriter.writeLine(`${logPrefix} Tor Router purchased.`);

  logWriter.writeLine(`${logPrefix} Waiting to purchase DarkWeb Programs...`);
  let remainingPrograms = getRemainingPrograms(netscript);
  while (remainingPrograms.length > 0) {
    for (const programName of remainingPrograms) {
      const programData = ProgramData[programName];
      if (await singularityApi.purchaseProgram(programData.name)) {
        logWriter.writeLine(
          `${logPrefix} Purchased program from DarkWeb : ${programName}`
        );
        logWriter.writeLine(`${logPrefix} Rooting newly available servers...`);
        runScript(netscript, ROOT_HOSTS_SCRIPT);
      }
    }

    await netscript.asleep(WAIT_DELAY);
    remainingPrograms = getRemainingPrograms(netscript);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleHomeUpgrades(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  const logPrefix = 'Home -';

  logWriter.writeLine(
    `${logPrefix} Waiting to purchase home server upgrades...`
  );
  let homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  while (
    homeServerInfo.maxRam < HOME_TARGET_RAM &&
    homeServerInfo.cpuCores < HOME_TARGET_CORES
  ) {
    while (
      homeServerInfo.maxRam < HOME_TARGET_RAM &&
      (await singularityApi['upgradeHomeRam']())
    ) {
      homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
      logWriter.writeLine(
        `${logPrefix} Upgraded home RAM to ${netscript.formatRam(
          homeServerInfo.maxRam
        )}`
      );
    }
    while (
      homeServerInfo.cpuCores < HOME_TARGET_CORES &&
      (await singularityApi['upgradeHomeCores']())
    ) {
      homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
      logWriter.writeLine(
        `${logPrefix} Upgraded home cores to ${homeServerInfo.cpuCores}`
      );
    }

    await netscript.asleep(WAIT_DELAY);
    homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Singularity Quick Start Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Running hacknet manager script...');
  runScript(
    netscript,
    HACKNET_MANAGER_SCRIPT,
    undefined,
    1,
    false,
    getCmdFlag(CMD_FLAG_PURCHASE_NODES),
    getCmdFlag(CMD_FLAG_PURCHASE_UPGRADES)
  );

  scriptLogWriter.writeLine('Running lambda server manager script...');
  runScript(netscript, SERVER_LAMBDA_SCRIPT);

  scriptLogWriter.writeLine('Rooting all available hosts...');
  runScript(netscript, ROOT_HOSTS_SCRIPT);

  scriptLogWriter.writeLine(
    'Training hacking exp via free university class...'
  );
  await attendCourse(
    nsPackage,
    UniversityName.Rothman,
    netscript.enums.UniversityClassType.computerScience
  );

  scriptLogWriter.writeLine(`Waiting for hacking level ${MIN_HACK_LEVEL}...`);
  while (netscript.getHackingLevel() < MIN_HACK_LEVEL) {
    await netscript.asleep(WAIT_DELAY);
  }

  scriptLogWriter.writeLine('Running concurrent tasks...');
  const concurrentTasks = new Array<Promise<void>>();
  concurrentTasks.push(handleHackingActivity(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleWorkTasks(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleFactionMembership(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleLambdaServerPurchased(netscript, scriptLogWriter));
  concurrentTasks.push(handlePurchasePrograms(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleHomeUpgrades(nsPackage, scriptLogWriter));
  await Promise.all(concurrentTasks);

  scriptLogWriter.writeLine('Singularity quick start completed!');
}
