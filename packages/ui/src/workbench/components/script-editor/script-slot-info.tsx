/**
 * The rail's `(i)` cards — one per script slot, each leading with the
 * Settings tab's shared example card: the scripts bracket that same
 * send, so the before-request card lights the request line the script
 * may rewrite and the after-response card lights the outcome it tests,
 * both alongside the scripts slot they execute in. The `oh.*` API
 * glossary sits beneath the card; API labels are code, only the
 * descriptions localize.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { EXAMPLE_CARD_POPOVER_WIDTH, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { settingsExampleCard } from '../request-editor/SettingsRowInfo';

export function scriptSlotInfo(kind: ScriptKind, t: Translate): InfoPopoverContent {
  if (kind === 'pre-request') {
    return {
      title: t('workbench.editors.request.scripts.preInfoTitle'),
      kicker: t('workbench.editors.request.tab.scripts'),
      diagram: settingsExampleCard(['url', 'scripts']),
      maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
      summary: t('workbench.editors.request.scripts.preInfoSummary'),
      sections: [
        {
          heading: t('workbench.editors.request.scripts.apiHeading'),
          items: [
            { label: 'oh.setHeader(name, value)', desc: t('workbench.editors.request.scripts.apiSetHeader') },
            { label: 'oh.setQueryParam(name, value)', desc: t('workbench.editors.request.scripts.apiSetQueryParam') },
            { label: 'oh.setUrl(url)', desc: t('workbench.editors.request.scripts.apiSetUrl') },
            { label: 'oh.setBody(body)', desc: t('workbench.editors.request.scripts.apiSetBody') },
            { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
          ],
        },
      ],
    };
  }
  return {
    title: t('workbench.editors.request.scripts.postInfoTitle'),
    kicker: t('workbench.editors.request.tab.scripts'),
    diagram: settingsExampleCard(['chain', 'scripts']),
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
    summary: t('workbench.editors.request.scripts.postInfoSummary'),
    sections: [
      {
        heading: t('workbench.editors.request.scripts.apiHeading'),
        items: [
          { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
          { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
        ],
      },
    ],
  };
}
