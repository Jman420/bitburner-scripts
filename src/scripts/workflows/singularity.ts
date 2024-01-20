import {CityName, NS, UniversityClassType} from '@ns';

import {HOME_SERVER_NAME} from '/scripts/common/shared';

import {UniversityName} from '/scripts/data/university-enums';
import {UniversityData} from '/scripts/data/university-data';

import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';
import {ProgramName} from '/scripts/data/program-enums';
import {ProgramData} from '/scripts/data/program-data';

async function attendCourse(
  nsPackage: NetscriptPackage,
  universityName: UniversityName,
  courseType: UniversityClassType,
  waitDelay = 500
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const singularityApi = nsLocator.singularity;
  const playerInfo = netscript.getPlayer();
  const universityData = UniversityData[universityName];
  while (
    playerInfo.city !== universityData.city &&
    !(await singularityApi['travelToCity'](universityData.city as CityName))
  ) {
    await netscript.asleep(waitDelay);
  }
  await singularityApi['universityCourse'](universityData.name, courseType);
}

async function backdoorHost(nsLocator: NetscriptLocator, hostPath: string[]) {
  const singularityApi = nsLocator.singularity;
  for (const hostname of hostPath) {
    await singularityApi['connect'](hostname);
  }
  await singularityApi['installBackdoor']();
  await singularityApi['connect'](HOME_SERVER_NAME);
}

function getRemainingPrograms(netscript: NS) {
  return Object.values(ProgramName)
    .map(value => value.toString())
    .filter(value => {
      const programData = ProgramData[value];
      return !netscript.fileExists(programData.name, HOME_SERVER_NAME);
    });
}

export {attendCourse, backdoorHost, getRemainingPrograms};
