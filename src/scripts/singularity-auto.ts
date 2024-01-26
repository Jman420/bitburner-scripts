import {CrimeTask, NS, StudyTask} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {
  initializeScript,
  runScript,
  waitForScripts,
} from '/scripts/workflows/execution';
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
import {WGWH_BATCH_ATTACK_SCRIPT} from '/scripts/wgwh-batch';
import {CONTRACTS_AUTO_SCRIPT} from '/scripts/contracts-auto';
import {
  CMD_FLAG_FUNDS_LIMIT_PERCENT,
  STOCKS_TRADER_SCRIPT,
} from '/scripts/stocks-trader';
import {
  STOCKS_TICKER_4SIGMA_SCRIPT,
  STOCKS_TICKER_HISTORY_SCRIPT,
} from '/scripts/workflows/stocks';
import {
  CMD_FLAG_AUTO_INVESTMENT,
  CMD_FLAG_BYPASS_FUNDS_REQ,
  CORP_PUBLIC_SCRIPT,
  CORP_ROUND1_SCRIPT,
  CORP_ROUND2_SCRIPT,
  CORP_ROUND3_SCRIPT,
  CORP_ROUND4_SCRIPT,
  ROUND1_ADVERT_LEVEL as CORP_ROUND1_ADVERT_LEVEL,
} from '/scripts/workflows/corporation-shared';
import {REQUIRED_FUNDS as CORP_ROUND2_REQUIRED_FUNDS} from '/scripts/corp-round2';
import {REQUIRED_FUNDS as CORP_ROUND3_REQUIRED_FUNDS} from '/scripts/corp-round3';
import {GANG_MANAGER_SCRIPT, TaskFocus} from '/scripts/workflows/gangs';
import {
  CMD_FLAG_PURCHASE_AUGMENTATIONS,
  CMD_FLAG_TASK_FOCUS,
  TASK_FOCUS_RESPECT,
} from '/scripts/gang-manager';
import {FARM_FACTION_REPUTATION_SCRIPT} from '/scripts/farm-factionRep';

import {FactionName} from '/scripts/data/faction-enums';
import {FactionData} from '/scripts/data/faction-data';
import {ProgramData} from '/scripts/data/program-data';
import {UniversityName} from '/scripts/data/university-enums';
import {DivisionNames} from '/scripts/data/corporation-enums';
import {
  HOME_SERVER_NAME,
  NETSCRIPT_SERVER_NAME,
  SCRIPTS_DIR,
} from '/scripts/common/shared';

import {sendMessage} from '/scripts/comms/event-comms';
import {GangManagerConfigEvent} from '/scripts/comms/events/gang-manager-config-event';

import {
  filterHostsCanHack,
  findHostPath,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  NEUROFLUX_NAME,
  attendCourse,
  backdoorHost,
  getEligibleAugmentations,
  getFactionsNeedReputation,
  getPurchasedAugmentations,
  getRemainingPrograms,
} from '/scripts/workflows/singularity';
import {killWorkerScripts} from '/scripts/workflows/orchestration';

const SINGULARITY_AUTO_SCRIPT = `${SCRIPTS_DIR}/singularity-auto.js`;

const MODULE_NAME = 'singularity-starter';
const SUBSCRIBER_NAME = 'singularity-starter';

const TAIL_X_POS = 1405;
const TAIL_Y_POS = 35;
const TAIL_WIDTH = 850;
const TAIL_HEIGHT = 565;

const WAIT_DELAY = 500;

const MIN_HACK_LEVEL = 10;
const ATTACK_TARGETS_NEED = 10;
const HOME_TARGET_RAM = 500000; // 500TB
const HOME_TARGET_CORES = 6;
const BATCH_ATTACK_RAM_NEEDED = 8000; //8TB
const GANG_KARMA_REQ = -54000;
const CORP_FUNDS_REQ = 150e9; // 150b
const CORP_DIVIDENDS_RATE = 0.1; // 10%
const MAX_AUGMENTATIONS = 40;

/* Hacking Task Overview
 *   - Run HackExp Farm until sufficient targets for attack
 *   - Until max augmentations are purchased
 *     @ If factions need reputation & active secondary income source then run Reputation Farm
 *     @ If sufficient RAM for Batch Attacks then run WGWH Batch Attack
 *     @ Else run WGWH Serial Attack
 *   - Run WGWH Batch Attack
 *   - Complete
 */
async function handleHacking(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Hacking -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const gangApi = nsLocator.gang;
  const corpApi = nsLocator.corporation;

  let attackTargets = filterHostsCanHack(
    netscript,
    scanWideNetwork(netscript, false, true, false, true)
  );
  if (attackTargets.length < ATTACK_TARGETS_NEED) {
    logWriter.writeLine(`${logPrefix} Running hack exp farm script...`);
    const expFarmArgs = [getCmdFlag(CMD_FLAG_OPTIMAL_ONLY), 3];
    if (netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
      expFarmArgs.push(getCmdFlag(CMD_FLAG_INCLUDE_HOME));
    }
    runScript(netscript, FARM_HACK_EXP_SCRIPT, {
      args: expFarmArgs,
      tempScript: true,
    });

    logWriter.writeLine(
      `${logPrefix} Waiting for ${ATTACK_TARGETS_NEED} attack targets...`
    );
    while (attackTargets.length < ATTACK_TARGETS_NEED) {
      await netscript.asleep(WAIT_DELAY);
      attackTargets = filterHostsCanHack(
        netscript,
        scanWideNetwork(netscript, false, true, false, true)
      );
    }

    logWriter.writeLine(`${logPrefix} Killing hack exp farm...`);
    await nsLocator['scriptKill'](
      FARM_HACK_EXP_SCRIPT,
      netscript.getHostname()
    );
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
  }

  let homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  const purchasedAugs = await getPurchasedAugmentations(nsPackage);
  while (purchasedAugs.length < MAX_AUGMENTATIONS) {
    let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
    let gangInfo = (await gangApi['inGang']())
      ? await gangApi['getGangInformation']()
      : undefined;
    let corpInfo = (await corpApi['hasCorporation']())
      ? await corpApi['getCorporation']()
      : undefined;
    homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);

    if (
      factionsNeedRep.size > 0 &&
      ((gangInfo && gangInfo.moneyGainRate > 0) ||
        (corpInfo && corpInfo.dividendEarnings > 0))
    ) {
      logWriter.writeLine(
        `${logPrefix} Running faction reputation farm script...`
      );
      runScript(netscript, FARM_FACTION_REPUTATION_SCRIPT, {tempScript: true});

      logWriter.writeLine(
        `${logPrefix} Waiting for all factions reputation to be satisifed...`
      );
      while (factionsNeedRep.size > 0) {
        await netscript.asleep(WAIT_DELAY);
        factionsNeedRep = await getFactionsNeedReputation(nsPackage);
      }

      await nsLocator['scriptKill'](
        FARM_FACTION_REPUTATION_SCRIPT,
        netscript.getHostname()
      );
      runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
    } else if (homeServerInfo.maxRam < BATCH_ATTACK_RAM_NEEDED) {
      logWriter.writeLine(`${logPrefix} Running WGWH serial attack script...`);
      runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      const wgwhSerialArgs = netscript.serverExists(NETSCRIPT_SERVER_NAME)
        ? [getCmdFlag(CMD_FLAG_INCLUDE_HOME)]
        : [];
      runScript(netscript, WGWH_SERIAL_ATTACK_SCRIPT, {
        args: wgwhSerialArgs,
        tempScript: true,
      });

      logWriter.writeLine(
        `${logPrefix} Waiting for sufficient available RAM for WGWH batch attacks or for a secondary income source...`
      );
      while (
        homeServerInfo.maxRam < BATCH_ATTACK_RAM_NEEDED ||
        (gangInfo && gangInfo.moneyGainRate <= 0) ||
        (corpInfo && corpInfo.dividendEarnings <= 0)
      ) {
        await netscript.asleep(WAIT_DELAY);
        gangInfo = (await gangApi['inGang']())
          ? await gangApi['getGangInformation']()
          : undefined;
        corpInfo = (await corpApi['hasCorporation']())
          ? await corpApi['getCorporation']()
          : undefined;
        homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
      }

      logWriter.writeLine(`${logPrefix} Killing WGWH serial attack scripts...`);
      await nsLocator['scriptKill'](
        WGWH_SERIAL_ATTACK_SCRIPT,
        netscript.getHostname()
      );
      runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
    } else {
      logWriter.writeLine(`${logPrefix} Running WGWH batch attack script...`);
      runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      const wgwhBatchArgs = netscript.serverExists(NETSCRIPT_SERVER_NAME)
        ? [getCmdFlag(CMD_FLAG_INCLUDE_HOME)]
        : [];
      runScript(netscript, WGWH_BATCH_ATTACK_SCRIPT, {
        args: wgwhBatchArgs,
        tempScript: true,
      });

      logWriter.writeLine(
        `${logPrefix} Waiting for secondary income (gang or corporation)...`
      );
      while (
        (gangInfo && gangInfo.moneyGainRate <= 0) ||
        (corpInfo && corpInfo.dividendEarnings <= 0)
      ) {
        await netscript.asleep(WAIT_DELAY);
        gangInfo = (await gangApi['inGang']())
          ? await gangApi['getGangInformation']()
          : undefined;
        corpInfo = (await corpApi['hasCorporation']())
          ? await corpApi['getCorporation']()
          : undefined;
      }

      logWriter.writeLine(`${logPrefix} Killing WGWH batch attack scripts...`);
      await nsLocator['scriptKill'](
        WGWH_BATCH_ATTACK_SCRIPT,
        netscript.getHostname()
      );
      runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
    }

    await netscript.asleep(WAIT_DELAY);
  }

  homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  if (homeServerInfo.maxRam < BATCH_ATTACK_RAM_NEEDED) {
    logWriter.writeLine(`${logPrefix} Running WGWH serial attack script...`);
    runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
    const wgwhSerialArgs = netscript.serverExists(NETSCRIPT_SERVER_NAME)
      ? [getCmdFlag(CMD_FLAG_INCLUDE_HOME)]
      : [];
    runScript(netscript, WGWH_SERIAL_ATTACK_SCRIPT, {
      args: wgwhSerialArgs,
      tempScript: true,
    });

    logWriter.writeLine(
      `${logPrefix} Waiting for sufficient available RAM for WGWH batch attacks...`
    );
    while (homeServerInfo.maxRam < BATCH_ATTACK_RAM_NEEDED) {
      await netscript.asleep(WAIT_DELAY);
      homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
    }

    logWriter.writeLine(`${logPrefix} Killing WGWH serial attack scripts...`);
    await nsLocator['scriptKill'](
      WGWH_SERIAL_ATTACK_SCRIPT,
      netscript.getHostname()
    );
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
  }

  logWriter.writeLine(`${logPrefix} Running WGWH batch attack script...`);
  runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
  const wgwhBatchArgs = netscript.serverExists(NETSCRIPT_SERVER_NAME)
    ? [getCmdFlag(CMD_FLAG_INCLUDE_HOME)]
    : [];
  runScript(netscript, WGWH_BATCH_ATTACK_SCRIPT, {
    args: wgwhBatchArgs,
    tempScript: true,
  });

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Work Task Overview
 *   - Until sufficient karma for gang or hacking programs remain
 *     @ Create next available hacking program
 *     @ If karma insufficient for gang then perform crime
 *     @ Else attend Algorithms course at ZD Institue
 *   - Until max augmentations are purchased
 *     @ If factions require reputation then perform faction work
 *     @ Else attend Algorithms course at ZD Institue
 *   - Attend Algorithms course at ZD Institue
 *   - Complete
 */
async function handleWorkTasks(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Work -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;
  const netscriptExtended = netscript as NetscriptExtended;

  logWriter.writeLine(
    `${logPrefix} Waiting for karma to reach ${GANG_KARMA_REQ} and all hacking programs created...`
  );
  let remainingPrograms = getRemainingPrograms(netscript);
  let currentKarma = netscriptExtended.heart.break();
  while (currentKarma > GANG_KARMA_REQ || remainingPrograms.length > 0) {
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
          (await singularityApi['getCurrentWork']())?.type === 'CREATE_PROGRAM'
        ) {
          await netscript.asleep(WAIT_DELAY);
        }

        logWriter.writeLine(
          `${logPrefix} Rooting all newly available hosts...`
        );
        runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      }
    }

    const currentWork = (await singularityApi['getCurrentWork']()) as
      | CrimeTask
      | StudyTask
      | undefined;
    if (currentKarma > GANG_KARMA_REQ) {
      const crimeTask = currentWork as CrimeTask | undefined;
      const crimeJob =
        (await singularityApi['getCrimeChance']('Homicide')) >= 0.8
          ? 'Homicide'
          : 'Mug';
      if (crimeTask?.crimeType !== crimeJob) {
        logWriter.writeLine(
          `${logPrefix} Committing crime for cash & karma : ${crimeJob}`
        );
        await singularityApi['commitCrime'](crimeJob);
      }
    } else if (currentWork?.type !== 'CLASS') {
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
    `${logPrefix} Earning reputation for factions to buy augmentations...`
  );
  let purchasedAugs = await getPurchasedAugmentations(nsPackage);
  while (purchasedAugs.length < MAX_AUGMENTATIONS) {
    let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
    const currentWork = (await singularityApi['getCurrentWork']()) as
      | StudyTask
      | undefined;
    if (factionsNeedRep.size > 0) {
      const [factionName, neededRep] = Array.from(factionsNeedRep.entries())[0];

      logWriter.writeLine(
        `${logPrefix} Earning ${netscript.formatNumber(
          neededRep
        )} reputation for faction : ${factionName}`
      );
      await singularityApi['workForFaction'](factionName, 'hacking');
      while ((await singularityApi['getFactionRep'](factionName)) < neededRep) {
        await netscript.asleep(WAIT_DELAY);
      }
    } else if (currentWork?.type !== 'CLASS') {
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
    purchasedAugs = await getPurchasedAugmentations(nsPackage);
    factionsNeedRep = await getFactionsNeedReputation(nsPackage);
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

/* Factions Task Overview
 *   - While there are unjoined factions
 *     @ Accept any pending faction invites for known factions
 *     @ Install any available backdoors needed for faction invitations
 *   - Complete
 */
async function handleFactions(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Faction -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(`${logPrefix} Waiting on membership eligibility...`);
  let playerInfo = netscript.getPlayer();
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

    playerInfo = netscript.getPlayer();
    unjoinedFactions = unjoinedFactions.filter(
      value => !playerInfo.factions.includes(value)
    );
    for (const factionName of unjoinedFactions) {
      const factionData = FactionData[factionName];
      if (
        factionData.server &&
        netscript.hasRootAccess(factionData.server) &&
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
    playerInfo = netscript.getPlayer();
    unjoinedFactions = unjoinedFactions.filter(
      value => !playerInfo.factions.includes(value)
    );
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Tor Purchases Task Overview
 *   @ Purchase Tor Router
 *   @ Purchase all remaining hacking programs from DarkWeb
 *   @ Complete
 */
async function handleTorPurchases(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Tor -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(`${logPrefix} Waiting to purchase Tor Router...`);
  while (
    !netscript.hasTorRouter() &&
    !(await singularityApi['purchaseTor']())
  ) {
    await netscript.asleep(WAIT_DELAY);
  }
  logWriter.writeLine(`${logPrefix} Tor Router purchased.`);

  logWriter.writeLine(`${logPrefix} Waiting to purchase DarkWeb programs...`);
  let remainingPrograms = getRemainingPrograms(netscript);
  while (remainingPrograms.length > 0) {
    for (const programName of remainingPrograms) {
      const programData = ProgramData[programName];
      if (await singularityApi['purchaseProgram'](programData.name)) {
        logWriter.writeLine(
          `${logPrefix} Purchased program from DarkWeb : ${programName}`
        );
        logWriter.writeLine(`${logPrefix} Rooting newly available servers...`);
        runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
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
  const logPrefix = 'Home -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

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

async function handleStockMarket(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Stocks -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const stocksApi = nsLocator.stock;
  const accessUpgrades = [
    {
      name: 'Stock Exchange Account',
      hasUpgradeFunc: netscript.stock.hasWSEAccount,
      purchaseFunc: stocksApi['purchaseWseAccount'],
    },
    {
      name: 'TIX API Access',
      hasUpgradeFunc: netscript.stock.hasTIXAPIAccess,
      purchaseFunc: stocksApi['purchaseTixApi'],
      scriptHandler: async () => {
        logWriter.writeLine(
          `${logPrefix} Starting stocks trader script w/ historical ticker...`
        );
        await killWorkerScripts(nsPackage);
        runScript(netscript, STOCKS_TRADER_SCRIPT, {
          args: [getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT), 0],
          tempScript: true,
        });
      },
    },
    {
      name: '4Sigma Market Data',
      hasUpgradeFunc: netscript.stock.has4SData,
      purchaseFunc: stocksApi['purchase4SMarketData'],
    },
    {
      name: '4Sigma API Access',
      hasUpgradeFunc: netscript.stock.has4SDataTIXAPI,
      purchaseFunc: stocksApi['purchase4SMarketDataTixApi'],
      scriptHandler: async () => {
        logWriter.writeLine(
          `${logPrefix} Killing historical stock ticker script...`
        );
        await nsLocator['scriptKill'](
          STOCKS_TICKER_HISTORY_SCRIPT,
          netscript.getHostname()
        );
        await killWorkerScripts(nsPackage);

        logWriter.writeLine(
          `${logPrefix} Running 4Sigma stock ticker script...`
        );
        runScript(netscript, STOCKS_TICKER_4SIGMA_SCRIPT, {tempScript: true});
      },
    },
  ];

  logWriter.writeLine(
    `${logPrefix} Waiting to purchase stock market access upgrades...`
  );
  while (accessUpgrades.length > 0) {
    while (
      accessUpgrades.length > 0 &&
      (await accessUpgrades[0].purchaseFunc())
    ) {
      const purchasedUpgrade = accessUpgrades.shift();
      if (!purchasedUpgrade) {
        continue;
      }

      logWriter.writeLine(
        `${logPrefix} Purchased stock market access : ${purchasedUpgrade.name}`
      );
      if (purchasedUpgrade.scriptHandler) {
        await purchasedUpgrade.scriptHandler();
      }
    }

    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleGang(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Gang -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const netscriptExtended = netscript as NetscriptExtended;
  const gangApi = nsLocator.gang;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(
    `${logPrefix} Waiting for karma to reach ${GANG_KARMA_REQ}...`
  );
  while (netscriptExtended.heart.break() > GANG_KARMA_REQ) {
    await netscript.asleep(WAIT_DELAY);
  }
  logWriter.writeLine(`${logPrefix} Karma requirement met.`);

  logWriter.writeLine(
    `${logPrefix} Waiting for gang eligible faction membership...`
  );
  while (!(await gangApi['inGang']())) {
    const playerInfo = netscript.getPlayer();
    const joinedFactions = Object.values(FactionName)
      .map(value => value.toString())
      .filter(value => playerInfo.factions.includes(value))
      .map(value => FactionData[value]);
    for (
      let factionCounter = 0;
      factionCounter < joinedFactions.length && !(await gangApi['inGang']());
      factionCounter++
    ) {
      const factionData = joinedFactions[factionCounter];
      if (factionData.gangEligible) {
        logWriter.writeLine(
          `${logPrefix} Creating gang with faction ${factionData.name}`
        );
        await gangApi['createGang'](factionData.name);
      }
    }

    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Running gang manager script...`);
  await killWorkerScripts(nsPackage);
  const gangManagerArgs = [
    getCmdFlag(CMD_FLAG_PURCHASE_AUGMENTATIONS),
    getCmdFlag(CMD_FLAG_TASK_FOCUS),
    TASK_FOCUS_RESPECT,
  ];
  runScript(netscript, GANG_MANAGER_SCRIPT, {
    args: gangManagerArgs,
    tempScript: true,
  });

  const gangInfo = await gangApi['getGangInformation']();
  const gangAugmentations = await singularityApi['getAugmentationsFromFaction'](
    gangInfo.faction
  );
  const maxRepAugmentation = (
    await Promise.all(
      gangAugmentations.map(async value => {
        return {
          name: value,
          reputation: await singularityApi['getAugmentationRepReq'](value),
        };
      })
    )
  ).reduce((maxValue, value) =>
    value.reputation > maxValue.reputation ? value : maxValue
  );
  logWriter.writeLine(
    `${logPrefix} Waiting for ${netscript.formatNumber(
      maxRepAugmentation.reputation
    )} gang reputation...`
  );
  while (
    (await singularityApi['getFactionRep'](gangInfo.faction)) <
    maxRepAugmentation.reputation
  ) {
    await netscript.asleep(WAIT_DELAY);
  }
  logWriter.writeLine(`${logPrefix} Gang reputation satisfied!`);

  logWriter.writeLine(`${logPrefix} Switching gang focus to money...`);
  await sendMessage(new GangManagerConfigEvent({taskFocus: TaskFocus.MONEY}));

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleCorporation(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Corp -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const corpApi = nsLocator.corporation;
  const singularityApi = nsLocator.singularity;

  if (!(await corpApi['hasCorporation']())) {
    logWriter.writeLine(
      `${logPrefix} Waiting for sufficient funds to create corporation : ${netscript.formatNumber(
        CORP_FUNDS_REQ
      )}`
    );
    while (netscript.getPlayer().money <= CORP_FUNDS_REQ) {
      await netscript.asleep(WAIT_DELAY);
    }

    logWriter.writeLine(`${logPrefix} Creating corporation...`);
    await corpApi['createCorporation']('Corp', true);
  }

  const corpRoundScriptArgs = [
    getCmdFlag(CMD_FLAG_AUTO_INVESTMENT),
    getCmdFlag(CMD_FLAG_BYPASS_FUNDS_REQ),
  ];
  const autoInvestmentRounds = [
    {
      round: 1,
      scriptPath: CORP_ROUND1_SCRIPT,
      nextRoundFunds: CORP_ROUND2_REQUIRED_FUNDS,
      waitForFunds: async () =>
        (await corpApi['getHireAdVertCount'](DivisionNames.AGRICULTURE)) <=
        CORP_ROUND1_ADVERT_LEVEL,
    },
    {
      round: 2,
      scriptPath: CORP_ROUND2_SCRIPT,
      nextRoundFunds: CORP_ROUND3_REQUIRED_FUNDS,
      waitForFunds: async () =>
        !corpInfo.divisions.includes(DivisionNames.TOBACCO),
    },
    {round: 3, scriptPath: CORP_ROUND3_SCRIPT},
    {round: 4, scriptPath: CORP_ROUND4_SCRIPT},
  ];

  let corpInfo = await corpApi['getCorporation']();
  let investmentInfo = await corpApi['getInvestmentOffer']();
  while (investmentInfo.round < autoInvestmentRounds.length + 1) {
    const autoRoundInfo = autoInvestmentRounds[investmentInfo.round - 1];

    logWriter.writeLine(
      `${logPrefix} Running round ${autoRoundInfo.round} investment automation...`
    );
    await killWorkerScripts(nsPackage);
    const autoRoundScriptPid = runScript(netscript, autoRoundInfo.scriptPath, {
      args: corpRoundScriptArgs,
      tempScript: true,
    });
    await waitForScripts(netscript, [autoRoundScriptPid]);

    if (
      autoRoundInfo.nextRoundFunds &&
      autoRoundInfo.waitForFunds &&
      (await autoRoundInfo.waitForFunds())
    ) {
      logWriter.writeLine(
        `${logPrefix} Waiting for sufficient funds for round ${
          autoRoundInfo.round + 1
        } investment automation : $${netscript.formatNumber(
          autoRoundInfo.nextRoundFunds
        )}`
      );
      corpInfo = await corpApi['getCorporation']();
      while (corpInfo.funds < autoRoundInfo.nextRoundFunds) {
        await netscript.asleep(WAIT_DELAY);
        corpInfo = await corpApi['getCorporation']();
      }
    }

    await netscript.asleep(WAIT_DELAY);
    investmentInfo = await corpApi['getInvestmentOffer']();
  }
  logWriter.writeLine(`${logPrefix} Investment rounds complete!`);

  if (!corpInfo.public) {
    logWriter.writeLine(`${logPrefix} Taking corporation public...`);
    await corpApi['goPublic'](0);
  }

  logWriter.writeLine(
    `${logPrefix} Running public corporation management script...`
  );
  await killWorkerScripts(nsPackage);
  runScript(netscript, CORP_PUBLIC_SCRIPT, {tempScript: true});

  if (corpInfo.dividendRate !== CORP_DIVIDENDS_RATE) {
    logWriter.writeLine(
      `${logPrefix} Setting corporation dividends rate to ${CORP_DIVIDENDS_RATE}`
    );
    await corpApi['issueDividends'](CORP_DIVIDENDS_RATE);
  }

  logWriter.writeLine(`${logPrefix} Bribing factions for reputation...`);
  let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  while (factionsNeedRep.size > 0) {
    for (const [factionName, totalNeededRep] of factionsNeedRep.entries()) {
      const currentFactionRep =
        await singularityApi['getFactionRep'](factionName);
      const bribeAmount = (totalNeededRep - currentFactionRep) * 1e9; // 1rep -> $1b

      logWriter.writeLine(
        `${logPrefix} Waiting for $${netscript.formatNumber(
          bribeAmount
        )} funds to bribe ${factionName}...`
      );
      corpInfo = await corpApi['getCorporation']();
      while (corpInfo.funds < bribeAmount) {
        await netscript.asleep(WAIT_DELAY);
        corpInfo = await corpApi['getCorporation']();
      }

      logWriter.writeLine(
        `${logPrefix} Bribing ${factionName} with $${netscript.formatNumber(
          bribeAmount
        )}...`
      );
      await corpApi['bribe'](factionName, bribeAmount);
    }

    await netscript.asleep(WAIT_DELAY);
    factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handleAugmentations(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Augments -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(
    `${logPrefix} Waiting for sufficient funds to purchase augmentations...`
  );
  let purchasedAugs = await getPurchasedAugmentations(nsPackage);
  while (purchasedAugs.length < MAX_AUGMENTATIONS) {
    let eligibleAugmentations = await getEligibleAugmentations(nsPackage);

    for (
      let augmentationDetails = eligibleAugmentations.shift();
      augmentationDetails &&
      augmentationDetails.price <= netscript.getPlayer().money &&
      augmentationDetails.reputation <=
        (await singularityApi['getFactionRep'](augmentationDetails.faction));
      augmentationDetails = eligibleAugmentations.shift()
    ) {
      logWriter.writeLine(
        `${logPrefix} Purchasing augmentation ${augmentationDetails.name} from faction ${augmentationDetails.faction}...`
      );
      await singularityApi['purchaseAugmentation'](
        augmentationDetails.faction,
        augmentationDetails.name
      );

      // Re-evaluate eligible augmentations to include newly available pre-requisite augmentations
      eligibleAugmentations = await getEligibleAugmentations(nsPackage);
    }

    await netscript.asleep(WAIT_DELAY);
    purchasedAugs = await getPurchasedAugmentations(nsPackage);
  }

  logWriter.writeLine(
    `${logPrefix} Purchasing all available Home RAM upgrades...`
  );
  while (await singularityApi['upgradeHomeRam']());

  logWriter.writeLine(
    `${logPrefix} Purchasing all available Home Core upgrades...`
  );
  while (await singularityApi['upgradeHomeCores']());

  logWriter.writeLine(
    `${logPrefix} Determining if Neuroflux Governor is available...`
  );
  const neurofluxFactions =
    await singularityApi['getAugmentationFactions'](NEUROFLUX_NAME);
  const factionDetails = await Promise.all(
    neurofluxFactions.map(async value => {
      return {
        name: value,
        reputation: await singularityApi['getFactionRep'](value),
      };
    })
  );
  const targetFaction = factionDetails
    .sort((valueA, valueB) => valueA.reputation - valueB.reputation)
    .at(0);
  if (targetFaction) {
    logWriter.writeLine(
      `${logPrefix} Dumping remaining funds into Neuroflux Governor...`
    );
    while (
      singularityApi['purchaseAugmentation'](targetFaction.name, NEUROFLUX_NAME)
    );
  }

  logWriter.writeLine(`${logPrefix} Installing augmentations...`);
  singularityApi['installAugmentations'](SINGULARITY_AUTO_SCRIPT);

  logWriter.writeLine(`${logPrefix} Complete!`);
}

export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;
  const singularityApi = nsLocator.singularity;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Singularity Quick Start Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Running coding contract auto solver script...');
  runScript(netscript, CONTRACTS_AUTO_SCRIPT, {tempScript: true});

  if (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
    scriptLogWriter.writeLine('Running lambda server manager script...');
    runScript(netscript, SERVER_LAMBDA_SCRIPT, {tempScript: true});

    scriptLogWriter.writeLine(
      'Committing crime while waiting for lambda server to be purchased...'
    );
    while (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
      const currentWork = (await singularityApi['getCurrentWork']()) as
        | CrimeTask
        | undefined;
      const crimeJob =
        (await singularityApi['getCrimeChance']('Homicide')) >= 0.8
          ? 'Homicide'
          : 'Mug';
      if (!currentWork || currentWork.crimeType !== crimeJob) {
        scriptLogWriter.writeLine(`Committing crime for cash : ${crimeJob}`);
        await singularityApi['commitCrime'](crimeJob);
      }

      await netscript.asleep(WAIT_DELAY);
    }
  }

  scriptLogWriter.writeLine('Running hacknet manager script...');
  const hacknetManagerArgs = [
    getCmdFlag(CMD_FLAG_PURCHASE_NODES),
    getCmdFlag(CMD_FLAG_PURCHASE_UPGRADES),
  ];
  runScript(netscript, HACKNET_MANAGER_SCRIPT, {
    args: hacknetManagerArgs,
    tempScript: true,
  });

  const playerInfo = netscript.getPlayer();
  if (playerInfo.skills.hacking < 10) {
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
  }

  scriptLogWriter.writeLine('Rooting all available hosts...');
  runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});

  scriptLogWriter.writeLine('Running concurrent tasks...');
  const concurrentTasks = [];
  concurrentTasks.push(handleHacking(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleWorkTasks(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleFactions(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleHomeUpgrades(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleTorPurchases(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleStockMarket(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleGang(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleCorporation(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleAugmentations(nsPackage, scriptLogWriter));
  await Promise.all(concurrentTasks);

  scriptLogWriter.writeLine('Singularity automation completed!');
}
