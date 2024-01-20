import {CrimeTask, NS} from '@ns';

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
import {CONTRACTS_AUTO_SCRIPT} from '/scripts/contracts-auto';
import {STOCKS_TRADER_SCRIPT} from '/scripts/stocks-trader';
import {STOCKS_TICKER_HISTORY_SCRIPT} from '/scripts/workflows/stocks';
import {
  CMD_FLAG_AUTO_INVESTMENT,
  CORP_ROUND1_SCRIPT,
  CORP_ROUND2_SCRIPT,
  CORP_ROUND3_SCRIPT,
  CORP_ROUND4_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {REQUIRED_FUNDS as CORP_ROUND2_REQUIRED_FUNDS} from '/scripts/corp-round2';
import {REQUIRED_FUNDS as CORP_ROUND3_REQUIRED_FUNDS} from '/scripts/corp-round3';

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
const GANG_KARMA_REQ = -54000;
const CORP_FUNDS_REQ = 150e9; // 150b
const CORP_DIVIDENDS_RATE = 0.1; // 10%

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
  runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
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
  runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});

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
  const homeServerInfo = await nsLocator['getServer'](HOME_SERVER_NAME);
  while (homeServerInfo.maxRam < BATCH_ATTACH_RAM_NEEDED) {
    await netscript.asleep(WAIT_DELAY);
  }

  logWriter.writeLine(`${logPrefix} Killing WGWH serial attack scripts...`);
  runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
  await nsLocator['scriptKill'](WGWH_SERIAL_ATTACK_SCRIPT, HOME_SERVER_NAME);

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
          netscript.singularity.getCurrentWork()?.type === 'CREATE_PROGRAM'
        ) {
          await netscript.asleep(WAIT_DELAY);
        }

        logWriter.writeLine(
          `${logPrefix} Rooting all newly available hosts...`
        );
        runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});
      }
    }

    if (currentKarma > GANG_KARMA_REQ) {
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
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});

    const expFarmArgs = [
      getCmdFlag(CMD_FLAG_OPTIMAL_ONLY),
      3,
      getCmdFlag(CMD_FLAG_INCLUDE_HOME),
    ];
    runScript(netscript, FARM_HACK_EXP_SCRIPT, {
      args: expFarmArgs,
      tempScript: true,
    });
  } else {
    logWriter.writeLine(
      `${logPrefix} Including home server in wgwh serial attack...`
    );
    runScript(netscript, SCRIPTS_KILL_ALL_SCRIPT, {tempScript: true});
    netscript.scriptKill(WGWH_SERIAL_ATTACK_SCRIPT, HOME_SERVER_NAME);

    const wgwhSerialArgs = [getCmdFlag(CMD_FLAG_INCLUDE_HOME)];
    runScript(netscript, WGWH_SERIAL_ATTACK_SCRIPT, {
      args: wgwhSerialArgs,
      tempScript: true,
    });
  }

  logWriter.writeLine(`${logPrefix} Complete!`);
}

async function handlePurchasePrograms(
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

  logWriter.writeLine(`${logPrefix} Waiting to purchase DarkWeb Programs...`);
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
      purchaseFunc: stocksApi['purchaseWseAccount'],
    },
    {
      name: 'TIX API Access',
      purchaseFunc: stocksApi['purchaseTixApi'],
      scriptHandler: () => {
        logWriter.writeLine(
          `${logPrefix} Starting stocks trader script w/ historical ticker...`
        );
        runScript(netscript, STOCKS_TRADER_SCRIPT);
      },
    },
    {
      name: '4Sigma Market Data',
      purchaseFunc: stocksApi['purchase4SMarketData'],
    },
    {
      name: '4Sigma API Access',
      purchaseFunc: stocksApi['purchase4SMarketDataTixApi'],
      scriptHandler: () => {
        logWriter.writeLine(
          `${logPrefix} Killing stocks trader & historical ticker scripts...`
        );
        netscript.scriptKill(STOCKS_TRADER_SCRIPT, HOME_SERVER_NAME);
        netscript.scriptKill(STOCKS_TICKER_HISTORY_SCRIPT, HOME_SERVER_NAME);

        logWriter.writeLine(
          `${logPrefix} Restarting stocks trader script w/ 4Sigma ticker...`
        );
        runScript(netscript, STOCKS_TRADER_SCRIPT);
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
        purchasedUpgrade.scriptHandler();
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
  const gangCreated = await gangApi['inGang']();
  while (!gangCreated) {
    const playerInfo = await nsLocator['getPlayer']();
    const joinedFactions = Object.values(FactionName)
      .map(value => value.toString())
      .filter(value => playerInfo.factions.includes(value))
      .map(value => FactionData[value]);
    for (const factionData of joinedFactions) {
      if (factionData.gangEligible) {
        logWriter.writeLine(
          `${logPrefix} Creating gang with faction ${factionData.name}`
        );
        gangApi['createGang'](factionData.name);
      }
    }
  }

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

  if (!(await corpApi['hasCorporation']())) {
    logWriter.writeLine(
      `${logPrefix} Waiting for sufficient funds to create corporation : ${CORP_FUNDS_REQ}`
    );
    const playerInfo = await nsLocator['getPlayer']();
    while (playerInfo.money < CORP_FUNDS_REQ) {
      await netscript.asleep(WAIT_DELAY);
    }

    logWriter.writeLine(`${logPrefix} Creating corporation...`);
    await corpApi['createCorporation']('Corp', true);
  }

  const corpRoundScriptArgs = [getCmdFlag(CMD_FLAG_AUTO_INVESTMENT)];
  const autoInvestmentRounds = [
    {
      round: 1,
      scriptPath: CORP_ROUND1_SCRIPT,
      nextRoundFunds: CORP_ROUND2_REQUIRED_FUNDS,
    },
    {
      round: 2,
      scriptPath: CORP_ROUND2_SCRIPT,
      nextRoundFunds: CORP_ROUND3_REQUIRED_FUNDS,
    },
    {round: 3, scriptPath: CORP_ROUND3_SCRIPT},
    {round: 4, scriptPath: CORP_ROUND4_SCRIPT},
  ];
  let corpInfo = await corpApi['getCorporation']();
  for (const autoRoundInfo of autoInvestmentRounds) {
    const investmentInfo = await corpApi['getInvestmentOffer']();
    if (investmentInfo.round !== autoRoundInfo.round) {
      continue;
    }

    logWriter.writeLine(
      `${logPrefix} Running round ${autoRoundInfo.round} investment automation...`
    );
    const autoRoundScriptPid = runScript(netscript, autoRoundInfo.scriptPath, {
      args: corpRoundScriptArgs,
    });
    await waitForScripts(netscript, [autoRoundScriptPid]);

    if (autoRoundInfo.nextRoundFunds) {
      logWriter.writeLine(
        `${logPrefix} Waiting for sufficient funds for round ${
          autoRoundInfo.round
        } investment automation : $${netscript.formatNumber(
          autoRoundInfo.nextRoundFunds
        )}`
      );
      while (corpInfo.funds < autoRoundInfo.nextRoundFunds) {
        await netscript.asleep(WAIT_DELAY);
        corpInfo = await corpApi['getCorporation']();
      }
    }
  }
  logWriter.writeLine(`${logPrefix} Investment rounds complete!`);

  if (!corpInfo.public) {
    logWriter.writeLine(`${logPrefix} Taking corporation public...`);
    await corpApi['goPublic'](0);
  }

  if (corpInfo.dividendRate !== CORP_DIVIDENDS_RATE) {
    logWriter.writeLine(
      `${logPrefix} Setting corporation dividends rate to ${CORP_DIVIDENDS_RATE}`
    );
    await corpApi['issueDividends'](CORP_DIVIDENDS_RATE);
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
  scriptLogWriter.writeLine('Running coding contract auto solver script...');
  runScript(netscript, CONTRACTS_AUTO_SCRIPT, {tempScript: true});

  scriptLogWriter.writeLine('Running hacknet manager script...');
  const hacknetManagerArgs = [
    getCmdFlag(CMD_FLAG_PURCHASE_NODES),
    getCmdFlag(CMD_FLAG_PURCHASE_UPGRADES),
  ];
  runScript(netscript, HACKNET_MANAGER_SCRIPT, {
    args: hacknetManagerArgs,
    tempScript: true,
  });

  scriptLogWriter.writeLine('Running lambda server manager script...');
  runScript(netscript, SERVER_LAMBDA_SCRIPT, {tempScript: true});

  scriptLogWriter.writeLine('Rooting all available hosts...');
  runScript(netscript, ROOT_HOSTS_SCRIPT, {tempScript: true});

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
  concurrentTasks.push(handleStockMarket(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleGang(nsPackage, scriptLogWriter));
  concurrentTasks.push(handleCorporation(nsPackage, scriptLogWriter));
  await Promise.all(concurrentTasks);

  scriptLogWriter.writeLine('Singularity quick start completed!');
}
