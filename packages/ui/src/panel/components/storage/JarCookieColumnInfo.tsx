/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * Cookies grid — the network table's `NetworkColumnInfo` idiom. Every
 * popover leads with the cookie editor's canonical Set-Cookie example
 * (`CookieEditFieldInfo`'s card), each column lighting up its own
 * slice, so the grid and the editor teach against the same cookie.
 * Titles stay the raw column nouns; the Sec corpus reuses the
 * inspector cookie grid's keys — the SecurityGlyphs vocabulary is one
 * referent on both surfaces.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CookieExampleCard, type CookieExampleToken } from '../detail/cookies/CookieEditFieldInfo';

export type JarCookieColumnKey = 'name' | 'value' | 'scope' | 'expires' | 'sec';

/** Which token(s) of the shared Set-Cookie example each column lights
 *  up. Scope spans Domain + Path; Sec collapses the three attribute
 *  flags into one cell. */
const HIGHLIGHT: Record<JarCookieColumnKey, readonly CookieExampleToken[]> = {
  name: ['name'],
  value: ['value'],
  scope: ['domain', 'path'],
  expires: ['expires'],
  sec: ['secure', 'httponly', 'samesite'],
};

function jarCookieColumnInfo(t: Translate): Record<JarCookieColumnKey, InfoPopoverContent> {
  const kicker = t('panel.storage.nav.cookies');
  return {
    name: {
      title: 'Name',
      kicker,
      summary: t('panel.storage.cookieCol.name.summary'),
      description: t('panel.storage.cookieCol.name.description'),
      diagram: <CookieExampleCard highlight={HIGHLIGHT.name} />,
    },
    value: {
      title: 'Value',
      kicker,
      summary: t('panel.storage.cookieCol.value.summary'),
      description: t('panel.storage.cookieCol.value.description'),
      diagram: <CookieExampleCard highlight={HIGHLIGHT.value} />,
    },
    scope: {
      title: 'Domain · Path',
      kicker,
      summary: t('panel.storage.cookieCol.scope.summary'),
      description: t('panel.storage.cookieCol.scope.description'),
      diagram: <CookieExampleCard highlight={HIGHLIGHT.scope} />,
    },
    expires: {
      title: 'Expires',
      kicker,
      summary: t('panel.storage.cookieCol.expires.summary'),
      description: t('panel.storage.cookieCol.expires.description'),
      diagram: <CookieExampleCard highlight={HIGHLIGHT.expires} />,
    },
    sec: {
      title: 'Security (S H L)',
      kicker,
      summary: t('panel.inspector.cookies.columnInfo.sec.summary'),
      diagram: <CookieExampleCard highlight={HIGHLIGHT.sec} />,
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
    },
  };
}

export function JarCookieColumnInfo({ infoKey }: { infoKey: JarCookieColumnKey }) {
  const t = useT();
  return (
    <InfoTrigger
      content={jarCookieColumnInfo(t)[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}
