/**
 * Per-column `(i)` info-popover content for the Cookies table. Same
 * pattern as `headers/GeneralRow.tsx` and the Timing tab's column
 * trigger — explains what the column means, its possible values, and
 * how to read the visual treatments (colour coding, glyphs).
 *
 * Popovers stay small — at most a summary + one short `sections`
 * block. Deeper material belongs in the docs panel, not here.
 *
 * Column-name titles and wire vocabulary (prefixes, format nouns, the
 * S / H / L letters) stay raw; chip-name item labels reuse the chip
 * keys so the popover teaches the exact words the rows show.
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';

export type CookieColumnInfoKey = 'name' | 'value' | 'scope' | 'expires' | 'size' | 'sec';

function cookieColumnInfo(t: Translate, key: CookieColumnInfoKey): InfoPopoverContent {
  const kicker = t('panel.inspector.sections.cookies');
  switch (key) {
    case 'name':
      return {
        title: 'Name',
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.name.summary'),
        description: t('panel.inspector.cookies.columnInfo.name.description'),
        sections: [
          {
            heading: t('panel.inspector.cookies.columnInfo.name.roleHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.role.chipAuth'),
                desc: t('panel.inspector.cookies.columnInfo.name.authDesc'),
              },
              {
                label: t('panel.inspector.cookies.role.chipTracking'),
                desc: t('panel.inspector.cookies.columnInfo.name.trackingDesc'),
              },
              {
                label: t('panel.inspector.cookies.role.chipPref'),
                desc: t('panel.inspector.cookies.columnInfo.name.prefDesc'),
              },
            ],
          },
          {
            heading: t('panel.inspector.cookies.columnInfo.name.lifecycleHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.chips.justSet'),
                desc: t('panel.inspector.cookies.columnInfo.name.justSetDesc'),
              },
              {
                label: t('panel.inspector.cookies.chips.dropped'),
                desc: t('panel.inspector.cookies.columnInfo.name.droppedDesc'),
              },
              {
                label: t('panel.inspector.cookies.chips.filteredOut'),
                desc: t('panel.inspector.cookies.columnInfo.name.filteredOutDesc'),
              },
            ],
          },
          {
            heading: t('panel.inspector.cookies.columnInfo.name.contextHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.chips.thirdParty'),
                desc: t('panel.inspector.cookies.columnInfo.name.thirdPartyDesc'),
              },
              {
                label: t('panel.inspector.cookies.chips.partitioned'),
                desc: t('panel.inspector.cookies.columnInfo.name.partitionedDesc'),
              },
              { label: '!', desc: t('panel.inspector.cookies.columnInfo.name.problemDesc') },
            ],
          },
          {
            heading: t('panel.inspector.cookies.columnInfo.name.prefixesHeading'),
            items: [
              { label: '__Host-', desc: t('panel.inspector.cookies.columnInfo.name.hostPrefixDesc') },
              { label: '__Secure-', desc: t('panel.inspector.cookies.columnInfo.name.securePrefixDesc') },
            ],
          },
        ],
      };
    case 'value':
      return {
        title: 'Value',
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.value.summary'),
        sections: [
          {
            heading: t('panel.inspector.cookies.columnInfo.value.formatsHeading'),
            items: [
              { label: 'JWT', desc: t('panel.inspector.cookies.columnInfo.value.jwtDesc') },
              { label: 'JSON', desc: t('panel.inspector.cookies.columnInfo.value.jsonDesc') },
              { label: 'b64', desc: t('panel.inspector.cookies.columnInfo.value.b64Desc') },
              { label: '%-encoded', desc: t('panel.inspector.cookies.columnInfo.value.urlEncodedDesc') },
            ],
          },
        ],
      };
    case 'scope':
      return {
        title: 'Scope',
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.scope.summary'),
        description: t('panel.inspector.cookies.columnInfo.scope.description'),
      };
    case 'expires':
      return {
        title: 'Expires',
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.expires.summary'),
        sections: [
          {
            heading: t('panel.inspector.cookies.columnInfo.expires.colorHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.columnInfo.expires.red'),
                desc: t('panel.inspector.cookies.columnInfo.expires.redDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.expires.yellow'),
                desc: t('panel.inspector.cookies.columnInfo.expires.yellowDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.expires.plain'),
                desc: t('panel.inspector.cookies.columnInfo.expires.plainDesc'),
              },
              { label: 'Session', desc: t('panel.inspector.cookies.columnInfo.expires.sessionDesc') },
            ],
          },
          {
            heading: t('panel.inspector.cookies.columnInfo.expires.formatHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.columnInfo.expires.relativeLabel'),
                desc: t('panel.inspector.cookies.columnInfo.expires.relativeDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.expires.absoluteLabel'),
                desc: t('panel.inspector.cookies.columnInfo.expires.absoluteDesc'),
              },
            ],
          },
        ],
      };
    case 'size':
      return {
        title: 'Size',
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.size.summary'),
        description: t('panel.inspector.cookies.columnInfo.size.description'),
      };
    case 'sec':
      return {
        title: t('panel.inspector.cookies.columnInfo.sec.title'),
        kicker,
        summary: t('panel.inspector.cookies.columnInfo.sec.summary'),
        sections: [
          {
            heading: t('panel.inspector.cookies.columnInfo.sec.glyphsHeading'),
            items: [
              { label: 'S', desc: t('panel.inspector.cookies.columnInfo.sec.sDesc') },
              { label: 'H', desc: t('panel.inspector.cookies.columnInfo.sec.hDesc') },
              { label: 'L', desc: t('panel.inspector.cookies.columnInfo.sec.lDesc') },
            ],
          },
          {
            heading: t('panel.inspector.cookies.columnInfo.sec.colorHeading'),
            items: [
              {
                label: t('panel.inspector.cookies.columnInfo.sec.green'),
                desc: t('panel.inspector.cookies.columnInfo.sec.greenDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.sec.yellow'),
                desc: t('panel.inspector.cookies.columnInfo.sec.yellowDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.sec.red'),
                desc: t('panel.inspector.cookies.columnInfo.sec.redDesc'),
              },
              {
                label: t('panel.inspector.cookies.columnInfo.sec.gray'),
                desc: t('panel.inspector.cookies.columnInfo.sec.grayDesc'),
              },
            ],
          },
        ],
      };
  }
}

export function CookieColumnInfo({ infoKey }: { infoKey: CookieColumnInfoKey }) {
  const t = useT();
  const content = useMemo(() => cookieColumnInfo(t, infoKey), [t, infoKey]);
  return <InfoTrigger content={content} className="dt-header-info-trigger dt-cookie-col-info-trigger" />;
}
