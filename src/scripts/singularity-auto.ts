import {CrimeTask, NS, StudyTask} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {initializeScript, runScript} from '/scripts/workflows/execution';
import {openTail} from '/scripts/workflows/ui';

import {
  NetscriptExtended,
  NetscriptLocator,
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

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
  sellPortfolio,
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
  corpHasIncome,
} from '/scripts/workflows/corporation-shared';
import {REQUIRED_FUNDS as CORP_ROUND2_REQUIRED_FUNDS} from '/scripts/corp-round2';
import {REQUIRED_FUNDS as CORP_ROUND3_REQUIRED_FUNDS} from '/scripts/corp-round3';
import {
  GANG_MANAGER_SCRIPT,
  TaskFocus,
  gangHasIncome,
} from '/scripts/workflows/gangs';
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
  NEUROFLUX_AUGMENTATION_NAME,
  RED_PILL_AUGMENTATION_NAME,
  attendCourse,
  backdoorHost,
  factionsNeedReset,
  getEligibleAugmentations,
  getFactionsNeedFavor,
  getFactionsNeedReputation,
  getPurchasedAugmentations,
  getRemainingPrograms,
} from '/scripts/workflows/singularity';
import {
  killWorkerScripts,
  waitForScripts,
} from '/scripts/workflows/orchestration';
import {repDonationAmount} from '/scripts/workflows/formulas';
import {getPlayerTotalValue} from '/scripts/workflows/player';
import {StocksTraderConfigEvent} from '/scripts/comms/events/stocks-trader-config-event';
import {FarmHackExpConfigEvent} from '/scripts/comms/events/farm-hackExp-config-event';
import {WgwhManagerConfigEvent} from '/scripts/comms/events/wgwh-manager-config-event';
import {FarmFactionRepConfigEvent} from '/scripts/comms/events/farm-factionRep-config-event';
import {HacknetManagerConfigEvent} from '/scripts/comms/events/hacknet-manager-config-event';

const SINGULARITY_AUTO_SCRIPT = `${SCRIPTS_DIR}/singularity-auto.js`;

const MODULE_NAME = 'singularity-starter';
const SUBSCRIBER_NAME = 'singularity-starter';

const TAIL_X_POS = 1405;
const TAIL_Y_POS = 35;
const TAIL_WIDTH = 850;
const TAIL_HEIGHT = 565;

const WAIT_DELAY = 500;

const MIN_HACK_LEVEL = 10;
const ATTACK_TARGETS_NEED = 8;
const HOME_TARGET_RAM = 500000; // 500TB
const HOME_TARGET_CORES = 6;
const BATCH_ATTACK_RAM_NEEDED = 8000; //8TB
const GANG_KARMA_REQ = -54000;
const CORP_FUNDS_REQ = 150e9; // 150b
const CORP_DIVIDENDS_RATE = 0.1; // 10%
const BYPASS_LAMBDA_HOME_RAM = 1024; // 1TB

let purchasesEnabled = true;

async function togglePurchases(enablePurchases: boolean) {
  purchasesEnabled = enablePurchases;
  const messageTasks = [];
  messageTasks.push(
    sendMessage(
      new HacknetManagerConfigEvent({
        purchaseNodes: enablePurchases,
        purchaseUpgrades: enablePurchases,
      })
    )
  );
  messageTasks.push(
    sendMessage(new StocksTraderConfigEvent({purchaseStocks: enablePurchases}))
  );
  messageTasks.push(
    sendMessage(
      new GangManagerConfigEvent({
        buyAugmentations: enablePurchases,
      })
    )
  );
  await Promise.all(messageTasks);
}

async function handlePurchase(
  nsLocator: NetscriptLocator,
  purchaseFunc: () => void | Promise<void>
) {
  await togglePurchases(false);
  await sellPortfolio(nsLocator);
  await purchaseFunc();
  await togglePurchases(true);
}

/* Hacking Task Overview
 *   - Run HackExp Farm until sufficient targets for attack
 *   - Until all factions have required reputation & favor
 *     @ If factions need reputation & active secondary income source then run Reputation Farm
 *     @ If sufficient RAM for Batch Attacks then run WGWH Batch Attack
 *     @ Else run WGWH Serial Attack
 *   - If insufficient RAM for WGWH Batch Attacks then run WGWH Serial Attack and wait for sufficient RAM for WGWH Batch Attacks
 *   - Run WGWH Batch Attack
 *   - Complete
 */
async function handleHacking(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Hacking -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  let attackTargets = filterHostsCanHack(
    netscript,
    scanWideNetwork(netscript, {rootOnly: true, requireFunds: true})
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
        scanWideNetwork(netscript, {rootOnly: true, requireFunds: true})
      );
    }

    logWriter.writeLine(`${logPrefix} Killing hack exp farm...`);
    await nsLocator['scriptKill'](
      FARM_HACK_EXP_SCRIPT,
      netscript.getHostname()
    );
    await killWorkerScripts(nsPackage);
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
  }

  let homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  let factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
  while (factionsNeedRep.size > 0 || factionsNeedFavor.size > 0) {
    homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);

    if (
      factionsNeedRep.size > 0 &&
      ((await gangHasIncome(nsLocator)) || (await corpHasIncome(nsLocator)))
    ) {
      logWriter.writeLine(
        `${logPrefix} Running faction reputation farm script...`
      );
      const hackExpFarmArgs = netscript.serverExists(NETSCRIPT_SERVER_NAME)
        ? [getCmdFlag(CMD_FLAG_INCLUDE_HOME)]
        : undefined;
      runScript(netscript, FARM_FACTION_REPUTATION_SCRIPT, {
        args: hackExpFarmArgs,
        tempScript: true,
      });

      logWriter.writeLine(
        `${logPrefix} Waiting for all factions reputation to be satisifed...`
      );
      while (factionsNeedRep.size > 0) {
        await netscript.asleep(WAIT_DELAY);
        factionsNeedRep = await getFactionsNeedReputation(nsPackage);
      }

      logWriter.writeLine(`${logPrefix} Killing faction reputation farm...`);
      await nsLocator['scriptKill'](
        FARM_FACTION_REPUTATION_SCRIPT,
        netscript.getHostname()
      );
      await killWorkerScripts(nsPackage);
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
        `${logPrefix} Waiting for sufficient available RAM for WGWH batch attacks or for a secondary income source and factions need reputation...`
      );
      while (
        homeServerInfo.maxRam < BATCH_ATTACK_RAM_NEEDED &&
        (factionsNeedRep.size < 1 ||
          (factionsNeedRep.size > 0 &&
            !(await gangHasIncome(nsLocator)) &&
            !(await corpHasIncome(nsLocator))))
      ) {
        await netscript.asleep(WAIT_DELAY);

        homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
        factionsNeedRep = await getFactionsNeedReputation(nsPackage);
      }

      logWriter.writeLine(`${logPrefix} Killing WGWH serial attack scripts...`);
      await nsLocator['scriptKill'](
        WGWH_SERIAL_ATTACK_SCRIPT,
        netscript.getHostname()
      );
      killWorkerScripts(nsPackage);
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
        `${logPrefix} Waiting for secondary income source and factions need reputation...`
      );
      while (
        factionsNeedRep.size < 1 ||
        (factionsNeedRep.size > 0 &&
          !(await gangHasIncome(nsLocator)) &&
          !(await corpHasIncome(nsLocator)))
      ) {
        await netscript.asleep(WAIT_DELAY);
        factionsNeedRep = await getFactionsNeedReputation(nsPackage);
      }

      logWriter.writeLine(`${logPrefix} Killing WGWH batch attack scripts...`);
      await nsLocator['scriptKill'](
        WGWH_BATCH_ATTACK_SCRIPT,
        netscript.getHostname()
      );
      await killWorkerScripts(nsPackage);
      runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
    }

    await netscript.asleep(WAIT_DELAY);
    factionsNeedRep = await getFactionsNeedReputation(nsPackage);
    factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
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
    await killWorkerScripts(nsPackage);
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

/** Lambda Server Overview
 *   - Wait until the Lambda Server is purchased
 *   - Include home server in currently active hacking attacks
 *   - Complete
 */
async function handleLambdaServer(netscript: NS, logWriter: Logger) {
  const logPrefix = 'Lambda -';

  if (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
    logWriter.writeLine(
      `${logPrefix} Waiting for Lambda Server to be purchased...`
    );
    while (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
      await netscript.asleep(WAIT_DELAY);
    }
  }

  logWriter.writeLine(
    `${logPrefix} Including home server in current hacking activities...`
  );
  sendMessage(new FarmHackExpConfigEvent({includeHomeAttacker: true}));
  sendMessage(new WgwhManagerConfigEvent({includeHomeAttacker: true}));
  sendMessage(new FarmFactionRepConfigEvent({includeHome: true}));

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Work Task Overview
 *   - Until sufficient karma for gang or hacking programs remain
 *     @ Create next available hacking program
 *     @ If karma insufficient for gang then perform crime
 *   - Until all factions have needed reputation & favor
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
          `${logPrefix} Work put on hold to create ${programKey}...`
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
        await killWorkerScripts(nsPackage);
        runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      }
    }

    const crimeTask = (await singularityApi['getCurrentWork']()) as
      | CrimeTask
      | undefined;
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

    await netscript.asleep(WAIT_DELAY);
    currentKarma = netscriptExtended.heart.break();
    remainingPrograms = getRemainingPrograms(netscript);
  }

  logWriter.writeLine(
    `${logPrefix} Earning reputation for factions to buy augmentations...`
  );
  let factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
  let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  while (factionsNeedFavor.size > 0 || factionsNeedRep.size > 0) {
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
    factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
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

/* Tor Task Overview
 *   @ Purchase Tor Router
 *   @ Purchase all remaining hacking programs from DarkWeb
 *   @ Complete
 */
async function handleTor(nsPackage: NetscriptPackage, logWriter: Logger) {
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

      if (
        purchasesEnabled &&
        (await getPlayerTotalValue(nsPackage)) >=
          (await singularityApi['getDarkwebProgramCost'](programData.name))
      ) {
        logWriter.writeLine(
          `${logPrefix} Purchasing program from DarkWeb : ${programName}`
        );
        await handlePurchase(nsLocator, async () => {
          await singularityApi['purchaseProgram'](programData.name);
        });

        logWriter.writeLine(`${logPrefix} Rooting newly available servers...`);
        await killWorkerScripts(nsPackage);
        runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      }
    }

    await netscript.asleep(WAIT_DELAY);
    remainingPrograms = getRemainingPrograms(netscript);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Home Upgrades Overview
 *   - Purchase Home RAM & Core updates when available until their limits are met
 *   - Complete
 */
async function handleHomeServer(
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
      purchasesEnabled &&
      homeServerInfo.maxRam < HOME_TARGET_RAM &&
      (await getPlayerTotalValue(nsPackage)) >=
        (await singularityApi['getUpgradeHomeRamCost']())
    ) {
      logWriter.writeLine(`${logPrefix} Upgrading home server RAM...`);
      await handlePurchase(nsLocator, async () => {
        await singularityApi['upgradeHomeRam']();
      });

      homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
      logWriter.writeLine(
        `${logPrefix} Upgraded home RAM to ${netscript.formatRam(
          homeServerInfo.maxRam
        )}`
      );
    }
    while (
      purchasesEnabled &&
      homeServerInfo.cpuCores < HOME_TARGET_CORES &&
      (await getPlayerTotalValue(nsPackage)) >=
        (await singularityApi['getUpgradeHomeCoresCost']())
    ) {
      logWriter.writeLine(`${logPrefix} Upgrading home server RAM...`);
      await handlePurchase(nsLocator, async () => {
        await singularityApi['upgradeHomeCores']();
      });

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

/* Stock Market Overview
 *   - Purchase all stock market access upgrades in cost order
 *     @ After purchasing API access run the historical ticker & stock trader scripts
 *     @ After purchasing 4S API access run the 4Sigma ticker
 *   - Complete
 */
async function handleStockMarket(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Stocks -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const stocksApi = nsLocator.stock;

  const stocksConstants = netscript.stock.getConstants();
  const accessUpgrades = [
    {
      name: 'Stock Exchange Account',
      cost: stocksConstants.WSEAccountCost,
      hasUpgradeFunc: netscript.stock.hasWSEAccount,
      purchaseFunc: stocksApi['purchaseWseAccount'],
    },
    {
      name: 'TIX API Access',
      cost: stocksConstants.TIXAPICost,
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
      cost: stocksConstants.MarketData4SCost,
      hasUpgradeFunc: netscript.stock.has4SData,
      purchaseFunc: stocksApi['purchase4SMarketData'],
    },
    {
      name: '4Sigma API Access',
      cost: stocksConstants.MarketDataTixApi4SCost,
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
      purchasesEnabled &&
      accessUpgrades.length > 0 &&
      (accessUpgrades[0].hasUpgradeFunc() ||
        (await getPlayerTotalValue(nsPackage)) >= accessUpgrades[0].cost)
    ) {
      const purchasedUpgrade = accessUpgrades.shift();
      if (!purchasedUpgrade) {
        continue;
      }

      if (!purchasedUpgrade.hasUpgradeFunc()) {
        logWriter.writeLine(
          `${logPrefix} Purchasing stock market access : ${purchasedUpgrade.name}`
        );
        await handlePurchase(nsLocator, async () => {
          await purchasedUpgrade.purchaseFunc();
        });
      }

      if (purchasedUpgrade.scriptHandler) {
        await purchasedUpgrade.scriptHandler();
      }
    }

    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Gang Overview
 *   - Wait until karma reaches gang limit (-54000)
 *   - Wait for membership in a gang eligible faction
 *   - Create gang with a gang eligible faction
 *   - Run gang manager script with purchase augmentations & task focus respect args
 *   - Wait until gang sufficient gang reputation to purchase eligible augmentations
 *   - Switch gang manager task focus to money
 *   - Complete
 */
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

/* Corporation Overview
 *   - If no corporation exists then
 *     @ Wait until player has sufficient funds to start corporation
 *     @ Create corporation
 *   - Run applicable corporation investment round automation scripts
 *     @ Wait until investment round automation script completes
 *     @ Wait until sufficient corporation funds to fund next investment round automation
 *   - Take corporation public (issue 0 shares)
 *   - Run corporation public automation script
 *   - Issue dividends
 */
async function handleCorporation(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Corp -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const corpApi = nsLocator.corporation;

  if (!(await corpApi['hasCorporation']())) {
    logWriter.writeLine(
      `${logPrefix} Waiting for sufficient player funds to create corporation : ${netscript.formatNumber(
        CORP_FUNDS_REQ
      )}`
    );
    while (
      !purchasesEnabled ||
      (await getPlayerTotalValue(nsPackage)) <= CORP_FUNDS_REQ
    ) {
      await netscript.asleep(WAIT_DELAY);
    }

    logWriter.writeLine(`${logPrefix} Creating corporation...`);
    await handlePurchase(nsLocator, async () => {
      await corpApi['createCorporation']('Corp', true);
    });
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

    logWriter.writeLine(
      `${logPrefix} Running round ${autoRoundInfo.round} investment automation...`
    );
    await killWorkerScripts(nsPackage);
    const autoRoundScriptPid = runScript(netscript, autoRoundInfo.scriptPath, {
      args: corpRoundScriptArgs,
      tempScript: true,
    });
    await waitForScripts(netscript, [autoRoundScriptPid]);
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

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Bribes Overview
 *   - Until all factions have sufficient reputation & favor
 *     @ For every faction that needs reputation
 *       @ If corporation is able to bribe faction then do so
 *       @ Else if player is able to bribe faction then do so
 *   - Complete
 */
async function handleBribes(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'Bribes -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;
  const corpApi = nsLocator.corporation;

  logWriter.writeLine(
    `${logPrefix} Waiting for factions to bribe for reputation...`
  );
  const favorToDonate = netscript.getFavorToDonate();

  let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  let factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
  while (factionsNeedRep.size > 0 || factionsNeedFavor.size > 0) {
    for (const [factionName, totalNeededRep] of factionsNeedRep.entries()) {
      const currentFactionRep =
        await singularityApi['getFactionRep'](factionName);
      const requiredRep = totalNeededRep - currentFactionRep;

      if (await corpApi['hasCorporation']()) {
        const corpConstants = await corpApi['getConstants']();
        const corpBribeAmount =
          requiredRep * corpConstants.bribeAmountPerReputation;
        if (await corpApi['bribe'](factionName, corpBribeAmount)) {
          logWriter.writeLine(
            `${logPrefix} Corporation bribed faction ${factionName} with $${netscript.formatNumber(
              corpBribeAmount
            )} for ${netscript.formatNumber(requiredRep)}`
          );
          continue;
        }
      }

      const currentFactionFavor =
        await singularityApi['getFactionFavor'](factionName);
      const playerBribeAmount = repDonationAmount(netscript, requiredRep);
      if (
        purchasesEnabled &&
        currentFactionFavor >= favorToDonate &&
        (await getPlayerTotalValue(nsPackage)) >= playerBribeAmount
      ) {
        logWriter.writeLine(
          `${logPrefix} Player bribing faction ${factionName} with $${netscript.formatNumber(
            playerBribeAmount
          )} for ${netscript.formatNumber(requiredRep)}`
        );
        await handlePurchase(nsLocator, async () => {
          await singularityApi['donateToFaction'](
            factionName,
            playerBribeAmount
          );
        });
      }
    }

    await netscript.asleep(WAIT_DELAY);
    factionsNeedRep = await getFactionsNeedReputation(nsPackage);
    factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Augmentations Overview
 *   - While factions need reputation or favor and eligbile augmentations remain
 *     @ Purchase augmentations in reducing cost order
 *   - Complete
 */
async function handleAugmentations(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const logPrefix = 'Augments -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  logWriter.writeLine(
    `${logPrefix} Waiting for sufficient funds & reputation to purchase augmentations...`
  );
  let eligibleAugmentations = await getEligibleAugmentations(nsPackage);
  let factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
  let factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  while (
    eligibleAugmentations.length > 0 ||
    factionsNeedFavor.size > 0 ||
    factionsNeedRep.size > 0
  ) {
    for (
      let augmentationDetails = eligibleAugmentations.shift();
      purchasesEnabled &&
      augmentationDetails &&
      (await getPlayerTotalValue(nsPackage)) >= augmentationDetails.price &&
      augmentationDetails.reputation <=
        (await singularityApi['getFactionRep'](augmentationDetails.faction));
      augmentationDetails = eligibleAugmentations.shift()
    ) {
      logWriter.writeLine(
        `${logPrefix} Purchasing augmentation ${augmentationDetails.name} from faction ${augmentationDetails.faction}...`
      );
      const factionName = augmentationDetails.faction;
      const augmentationName = augmentationDetails.name;
      await handlePurchase(nsLocator, async () => {
        if (
          !(await singularityApi['purchaseAugmentation'](
            factionName,
            augmentationName
          ))
        ) {
          logWriter.writeLine(
            `${logPrefix} Failed to purchase augmentation ${augmentationName} from faction ${factionName}!`
          );
        }
      });

      // Re-evaluate eligible augmentations to include newly available pre-requisite augmentations
      eligibleAugmentations = await getEligibleAugmentations(nsPackage);
    }

    await netscript.asleep(WAIT_DELAY);
    eligibleAugmentations = await getEligibleAugmentations(nsPackage);
    factionsNeedFavor = await getFactionsNeedFavor(nsPackage);
    factionsNeedRep = await getFactionsNeedReputation(nsPackage);
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Soft Reset Overview
 *   - Wait until a faction needs reset for favor, all augmentations are purchased or The Red Pill is purchased
 *   - Purchase any remaining augmentations in reducing cost order
 *   - If augmentations were purchased then
 *     @ Dump any remaining funds into Home RAM
 *     @ Dump any remaining funds into Home Cores
 *     @ Dump any remaining funds into Neuroflux Governor (if available)
 *     @ Install augmentations & restart singularity-auto script
 *   - Complete
 */
async function handleSoftReset(nsPackage: NetscriptPackage, logWriter: Logger) {
  const logPrefix = 'SoftReset -';

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;
  const stocksApi = nsLocator.stock;

  logWriter.writeLine(
    `${logPrefix} Waiting for faction to need reset for favor or The Red Pill or all available augmentations to be purchased...`
  );
  let factionNeedsReset = await factionsNeedReset(nsPackage);
  let purchasedAugs = await getPurchasedAugmentations(nsPackage);
  let eligibleAugmentations = await getEligibleAugmentations(nsPackage);
  while (
    !factionNeedsReset &&
    !purchasedAugs.includes(RED_PILL_AUGMENTATION_NAME) &&
    (eligibleAugmentations.length > 0 || purchasedAugs.length < 1)
  ) {
    await netscript.asleep(WAIT_DELAY);
    factionNeedsReset = await factionsNeedReset(nsPackage);
    purchasedAugs = await getPurchasedAugmentations(nsPackage);
    eligibleAugmentations = await getEligibleAugmentations(nsPackage);
  }

  logWriter.writeLine(`${logPrefix} Determining if soft reset is required...`);
  const criticalPathFactions = Object.values(FactionData)
    .filter(value => value.criticalPath)
    .map(value => value.name);
  const pendingAugmentations = await getEligibleAugmentations(
    nsPackage,
    true,
    false,
    false,
    criticalPathFactions
  );
  if (
    pendingAugmentations.length < 1 &&
    !purchasedAugs.includes(RED_PILL_AUGMENTATION_NAME)
  ) {
    logWriter.writeLine(
      `${logPrefix} All critical path augmentations installed.  Time to destroy the bitnode!`
    );
    logWriter.writeLine(`${logPrefix} Complete!`);
    return;
  }

  logWriter.writeLine(
    `${logPrefix} Disabling purchases and selling stock portfolio...`
  );
  await togglePurchases(false);
  await sellPortfolio(nsLocator);

  logWriter.writeLine(
    `${logPrefix} Purchasing any remaining stock market access upgrades...`
  );
  await stocksApi['purchaseWseAccount']();
  await stocksApi['purchaseTixApi']();
  await stocksApi['purchase4SMarketData']();
  if (netscript.stock.hasWSEAccount() && netscript.stock.hasTIXAPIAccess()) {
    await stocksApi['purchase4SMarketDataTixApi']();
  }

  logWriter.writeLine(
    `${logPrefix} Purchasing any remaining eligible augmentations...`
  );
  for (const augInfo of eligibleAugmentations) {
    if (
      await singularityApi['purchaseAugmentation'](
        augInfo.faction,
        augInfo.name
      )
    ) {
      logWriter.writeLine(`${logPrefix}   Purchased ${augInfo.name}`);
    }
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
  const neurofluxFactions = await singularityApi['getAugmentationFactions'](
    NEUROFLUX_AUGMENTATION_NAME
  );
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
      await singularityApi['purchaseAugmentation'](
        targetFaction.name,
        NEUROFLUX_AUGMENTATION_NAME
      )
    );
  }

  purchasedAugs = await getPurchasedAugmentations(nsPackage);
  if (purchasedAugs.length > 0) {
    logWriter.writeLine(`${logPrefix} Installing augmentations...`);
    await singularityApi['installAugmentations'](SINGULARITY_AUTO_SCRIPT);
  } else {
    logWriter.writeLine(`${logPrefix} Soft resetting for faction favor...`);
    await singularityApi['softReset'](SINGULARITY_AUTO_SCRIPT);
  }

  logWriter.writeLine(
    `${logPrefix} Re-enabling purchases after failed reset...`
  );
  await togglePurchases(true);

  logWriter.writeLine(`${logPrefix} Complete!`);
}

/* Startup Overview
 *   - Run coding contract solver script
 *   - If lambda server doesn't exist
 *     @ Run lambda server manager script
 *     @ Perform crime until lambda server exists
 *   - Run hacknet manager script
 *   - If player's hack level is under 10 then
 *     @ Attend free compSci classes
 *     @ Wait until hack level is at least 10
 *   - Root all available hosts
 *   - Run concurrent tasks
 */
export async function main(netscript: NS) {
  purchasesEnabled = true;

  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;
  const singularityApi = nsLocator.singularity;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Singularity Quick Start Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  scriptLogWriter.writeLine('Running coding contract auto solver script...');
  runScript(netscript, CONTRACTS_AUTO_SCRIPT, {tempScript: true});

  if (!netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
    scriptLogWriter.writeLine('Running lambda server manager script...');
    runScript(netscript, SERVER_LAMBDA_SCRIPT, {tempScript: true});

    scriptLogWriter.writeLine(
      'Committing crime while waiting for lambda server to be purchased...'
    );
    let homeServer = await nsLocator['getServer'](HOME_SERVER_NAME);
    while (
      !netscript.serverExists(NETSCRIPT_SERVER_NAME) &&
      homeServer.maxRam < BYPASS_LAMBDA_HOME_RAM
    ) {
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
      homeServer = await nsLocator['getServer'](HOME_SERVER_NAME);
    }
  }

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
  concurrentTasks.push(handleLambdaServer(netscript, scriptLogWriter));
  concurrentTasks.push(handleWorkTasks(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleFactions(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleHomeServer(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleTor(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleStockMarket(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleGang(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleCorporation(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleBribes(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleAugmentations(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleSoftReset(nsPackage, scriptLogWriter));
  await Promise.all(concurrentTasks);

  scriptLogWriter.writeLine('Singularity automation completed!');
}
