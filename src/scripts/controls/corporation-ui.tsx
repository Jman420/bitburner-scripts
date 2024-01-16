import {getReactModel} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';
import {
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {TeaPartyUI} from '/scripts/controls/corp-tea-party-ui';
import {ProductLifecycleUI} from '/scripts/controls/corp-product-ui';
import {CorpMaterialsUI} from '/scripts/controls/corp-materials-ui';
import {CorpExportUI} from '/scripts/controls/corp-export-ui';
import {CorpPricingUI} from '/scripts/controls/corp-pricing-ui';
import {CorpSupplyUI} from '/scripts/controls/corp-supply-ui';
import {CorpRoundsUI} from '/scripts/controls/corp-rounds-ui';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';

const React = getReactModel().reactNS;

function CorporationUI({
  nsPackage,
  eventListener,
}: {
  nsPackage: NetscriptPackage;
  eventListener: EventListener;
}) {
  const netscript = nsPackage.netscript;

  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Corporation Automation UI</label>
      </div>
      <TeaPartyUI netscript={netscript} eventListener={eventListener} />
      <ProductLifecycleUI nsPackage={nsPackage} eventListener={eventListener} />
      <CorpMaterialsUI nsPackage={nsPackage} />
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <CorpPricingUI netscript={netscript} />
        <CorpSupplyUI netscript={netscript} />
        <CorpExportUI nsPackage={nsPackage} />
      </div>
      <CorpRoundsUI netscript={netscript} />
    </div>
  );
}

export {CorporationUI};
