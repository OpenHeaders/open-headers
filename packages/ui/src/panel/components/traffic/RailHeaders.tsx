/**
 * Header cells for the two OH-native rails (rule-fire dots + annotations).
 * Each carries the rail's own symbol, dimmed — self-describing at 14px
 * where a label cannot fit — and a hover info popover (the same idiom as
 * the rail's row glyphs) explaining what the column shows.
 */

import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const FIRE_RAIL_INFO: InfoPopoverContent = {
  title: 'Rule fires',
  kicker: 'OpenHeaders',
  summary: 'A dot marks each request that one of your rules acted on.',
  sections: [
    {
      heading: 'Dot colors',
      items: [
        { label: 'blue', desc: 'Confirmed — the browser reported the modification applied.' },
        { label: 'amber', desc: 'Inferred — the rule matched, application not directly observable.' },
      ],
    },
  ],
};

const ANNOTATION_RAIL_INFO: InfoPopoverContent = {
  title: 'Annotations',
  kicker: 'OpenHeaders',
  summary:
    'Flags what OpenHeaders knows beyond what the columns show. Hover a glyph for the explanation; click it to open the details.',
  sections: [
    {
      heading: 'Glyphs',
      items: [
        { label: '⚠', desc: 'The row is not what it looks like — e.g. a transfer interrupted mid-download.' },
        { label: 'ℹ', desc: 'Provenance or fidelity context — never finished, capture gap, synthesized row.' },
      ],
    },
  ],
};

export function FireRailHeader() {
  return (
    <InfoPopover content={FIRE_RAIL_INFO} trigger="hover" placement="bottomLeft">
      <span className="dt-rail-head">
        <span className="dt-rail-head-dot" />
      </span>
    </InfoPopover>
  );
}

export function AnnotationRailHeader() {
  return (
    <InfoPopover content={ANNOTATION_RAIL_INFO} trigger="hover" placement="bottomLeft">
      <span className="dt-rail-head">ℹ</span>
    </InfoPopover>
  );
}
