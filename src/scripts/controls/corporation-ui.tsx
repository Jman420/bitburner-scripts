import {NS} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';
import {
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {TeaPartyUI} from '/scripts/controls/tea-party-ui';
import {ProductLifecycleUI} from '/scripts/controls/product-lifecycle-ui';
import {IndustryMaterialsUI} from '/scripts/controls/industry-materials-ui';
import {CorpExportUI} from '/scripts/controls/corp-export-ui';
import {CorpPricingUI} from '/scripts/controls/corp-pricing-ui';
import {CorpSupplyUI} from '/scripts/controls/corp-supply-ui';

const React = getReactModel().reactNS;

function CorporationUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Corporation Automation UI</label>
      </div>
      <TeaPartyUI netscript={netscript} eventListener={eventListener} />
      <ProductLifecycleUI netscript={netscript} eventListener={eventListener} />
      <IndustryMaterialsUI netscript={netscript} />
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <CorpPricingUI netscript={netscript} />
        <CorpSupplyUI netscript={netscript} />
        <CorpExportUI netscript={netscript} />
      </div>
    </div>
  );
}

export {CorporationUI};
