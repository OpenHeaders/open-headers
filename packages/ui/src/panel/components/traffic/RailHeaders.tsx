/**
 * Header cells for the two OH-native rails (rule-fire dots + annotations).
 * Each carries the rail's own symbol, dimmed — self-describing at 14px
 * where a label cannot fit — and a hover info popover (the same idiom as
 * the rail's row glyphs) explaining what the column shows. The ● / ⚠ / ℹ
 * glyphs and the OpenHeaders brand kicker ride raw.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

function fireRailInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.railFires'),
    kicker: 'OpenHeaders',
    summary: t('panel.network.fireRail.summary'),
    sections: [
      {
        heading: t('panel.network.fireRail.dotColorsHeading'),
        items: [
          {
            label: '●',
            labelClassName: 'dt-fire-eg--auth',
            desc: t('panel.network.fireRail.appliedDesc'),
          },
          {
            label: '●',
            labelClassName: 'dt-fire-eg--inferred',
            desc: t('panel.network.fireRail.inferredDesc'),
          },
          {
            label: '●',
            labelClassName: 'dt-fire-eg--contradicted',
            desc: t('panel.network.fireRail.contradictedDesc'),
          },
        ],
      },
    ],
  };
}

function annotationRailInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.railAnnotations'),
    kicker: 'OpenHeaders',
    summary: t('panel.network.annotationRail.summary'),
    sections: [
      {
        heading: t('panel.network.annotationRail.glyphsHeading'),
        items: [
          {
            label: '⚠',
            labelClassName: 'dt-annot-eg--warn',
            desc: t('panel.network.annotationRail.warnDesc'),
          },
          {
            label: 'ℹ',
            labelClassName: 'dt-annot-eg--info',
            desc: t('panel.network.annotationRail.infoDesc'),
          },
        ],
      },
    ],
  };
}

export function FireRailHeader() {
  const t = useT();
  return (
    <InfoPopover content={fireRailInfo(t)} trigger="hover" placement="bottomLeft">
      <span className="dt-rail-head">
        <span className="dt-rail-head-dot" />
      </span>
    </InfoPopover>
  );
}

export function AnnotationRailHeader() {
  const t = useT();
  return (
    <InfoPopover content={annotationRailInfo(t)} trigger="hover" placement="bottomLeft">
      <span className="dt-rail-head">ℹ</span>
    </InfoPopover>
  );
}
