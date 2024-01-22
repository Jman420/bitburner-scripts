import {CityName, CorpMaterialName} from '@ns';

import {ResearchName} from '/scripts/data/corporation-enums';

interface TeaPartyConfig {
  energyLimit: number;
  moraleLimit: number;
  partyFunds: number;
}

interface ProductLifecycleConfig {
  divisionName: string;
  designCity: CityName;
  productName: string;
  budgetPercent: number;
}

interface ResearchUpgrade {
  name: ResearchName;
  safetyCostMultiplier: number;
}

const TEA_PARTY_SCRIPT = 'scripts/corp-tea-party.js';
const INDUSTRY_MATERIALS_SCRIPT = 'scripts/corp-materials.js';
const PRODUCT_LIFECYCLE_SCRIPT = 'scripts/corp-product.js';
const PRICING_SETUP_SCRIPT = 'scripts/corp-price.js';
const EXPORT_SETUP_SCRIPT = 'scripts/corp-export.js';
const SMART_SUPPLY_SCRIPT = 'scripts/corp-supply.js';
const CORP_ROUND1_SCRIPT = 'scripts/corp-round1.js';
const CORP_ROUND2_SCRIPT = 'scripts/corp-round2.js';
const CORP_ROUND3_SCRIPT = 'scripts/corp-round3.js';
const CORP_ROUND4_SCRIPT = 'scripts/corp-round4.js';
const CORP_PUBLIC_SCRIPT = 'scripts/corp-public.js';

const CMD_FLAG_AUTO_INVESTMENT = 'autoInvestment';
const CMD_FLAG_BYPASS_FUNDS_REQ = 'bypassFundsRequirement';

const EXPORT_FORMULA = '-(IPROD+IINV/10)';

const BENCHMARK_OFFICE = 'Sector-12' as CityName;

const INDUSTRY_MULTIPLIER_MATERIALS: CorpMaterialName[] = [
  'Hardware',
  'AI Cores',
  'Robots',
  'Real Estate',
];

const FRAUD_DIVISION_NAME_PREFIX = 'f-';
const RAW_MAX_DIVISIONS = 20;

const ROUND1_ADVERT_LEVEL = 2;

export {
  TeaPartyConfig,
  ProductLifecycleConfig,
  ResearchUpgrade,
  TEA_PARTY_SCRIPT,
  INDUSTRY_MATERIALS_SCRIPT,
  PRODUCT_LIFECYCLE_SCRIPT,
  PRICING_SETUP_SCRIPT,
  EXPORT_SETUP_SCRIPT,
  SMART_SUPPLY_SCRIPT,
  CORP_ROUND1_SCRIPT,
  CORP_ROUND2_SCRIPT,
  CORP_ROUND3_SCRIPT,
  CORP_ROUND4_SCRIPT,
  CORP_PUBLIC_SCRIPT,
  CMD_FLAG_AUTO_INVESTMENT,
  CMD_FLAG_BYPASS_FUNDS_REQ,
  EXPORT_FORMULA,
  BENCHMARK_OFFICE,
  INDUSTRY_MULTIPLIER_MATERIALS,
  FRAUD_DIVISION_NAME_PREFIX,
  RAW_MAX_DIVISIONS,
  ROUND1_ADVERT_LEVEL,
};
