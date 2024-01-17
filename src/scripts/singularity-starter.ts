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
import {HOME_SERVER_NAME} from '/scripts/common/shared';

import {
  filterHostsCanHack,
  findHostPath,
  scanWideNetwork,
} from '/scripts/workflows/recon';

const MODULE_NAME = 'singularity-starter';
const SUBSCRIBER_NAME = 'singularity-starter';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const WAIT_DELAY = 500;
const MIN_HACK_LEVEL = 10;
const ATTACK_TARGETS_NEED = 10;

async function handleHackingActivity(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Hacking -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

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
    getCmdFlag(CMD_FLAG_INCLUDE_HOME),
    getCmdFlag(CMD_FLAG_OPTIMAL_ONLY),
    3
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
  await nsLocator['scriptKill'](FARM_HACK_EXP_SCRIPT, HOME_SERVER_NAME);

  logWriter.writeLine(`${logPrefix} Running WGWH serial attack script...`);
  runScript(
    netscript,
    WGWH_SERIAL_ATTACK_SCRIPT,
    undefined,
    1,
    false,
    getCmdFlag(CMD_FLAG_INCLUDE_HOME)
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
        logWriter.writeLine(
          `${logPrefix} Installing backdoor on server : ${factionData.server} to join faction : ${factionName}`
        );
        for (const hostname of hostPath) {
          await singularityApi['connect'](hostname);
        }
        await singularityApi['installBackdoor']();
        await singularityApi['connect'](HOME_SERVER_NAME);
        logWriter.writeLine(
          `${logPrefix} Installed backdoor on server : ${factionData.server}`
        );
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
    `${logPrefix} Waiting for karma to reach ${karmaLimit}...`
  );
  while (netscriptExtended.heart.break() > karmaLimit) {
    const currentWork = (await singularityApi['getCurrentWork']()) as CrimeTask;
    if (
      (await singularityApi['getCrimeChance']('Homicide')) > 0.8 &&
      currentWork.crimeType !== 'Homicide'
    ) {
      await singularityApi['commitCrime']('Homicide');
    } else if (currentWork.crimeType !== 'Mug') {
      await singularityApi['commitCrime']('Mug');
    }

    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Traveling to Volhaven for training...`);
  while (!(await singularityApi['travelToCity']('Volhaven'))) {
    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(
    `${logPrefix} Taking Algorithms course at ZB Institute...`
  );
  await singularityApi['universityCourse'](
    netscript.enums.LocationName.VolhavenZBInstituteOfTechnology,
    netscript.enums.UniversityClassType.algorithms
  );
  logWriter.writeLine(`${logPrefix} Complete!`);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Singularity Quick Start Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const singularityApi = nsLocator.singularity;

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
  singularityApi['universityCourse'](
    netscript.enums.LocationName.Sector12RothmanUniversity,
    netscript.enums.UniversityClassType.computerScience
  );

  scriptLogWriter.writeLine(`Waiting for hacking level ${MIN_HACK_LEVEL}...`);
  while (netscript.getHackingLevel() < MIN_HACK_LEVEL) {
    await netscript.asleep(WAIT_DELAY);
  }

  scriptLogWriter.writeLine('Running hack exp farming scripts...');
  runScript(
    netscript,
    FARM_HACK_EXP_SCRIPT,
    undefined,
    1,
    false,
    getCmdFlag(CMD_FLAG_INCLUDE_HOME),
    getCmdFlag(CMD_FLAG_OPTIMAL_ONLY),
    3
  );

  if (!netscript.fileExists('BruteSSH.exe', HOME_SERVER_NAME)) {
    scriptLogWriter.writeLine(
      'Waiting for BruteSSH to be available for creation...'
    );
    while (!(await singularityApi['createProgram']('BruteSSH.exe', true))) {
      await netscript.asleep(WAIT_DELAY);
    }
    scriptLogWriter.writeLine('Creating BruteSSH...');

    scriptLogWriter.writeLine('Waiting for BruteSSH to complete...');
    while (netscript.singularity.getCurrentWork()?.type === 'CREATE_PROGRAM') {
      await netscript.asleep(WAIT_DELAY);
    }
  }

  scriptLogWriter.writeLine(
    'Running concurrent hacking, work & faction membership tasks...'
  );
  const concurrentTasks = new Array<Promise<void>>();
  concurrentTasks.push(handleHackingActivity(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleWorkTasks(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleFactionMembership(nsPackage, scriptLogWriter));
  await Promise.allSettled(concurrentTasks);

  scriptLogWriter.writeLine('Singularity quick start completed!');
}
