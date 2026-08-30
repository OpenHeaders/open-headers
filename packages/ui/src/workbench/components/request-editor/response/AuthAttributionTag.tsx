/**
 * AuthAttributionTag — the meta-strip attribution tag for the auth a
 * run actually sent with, rendered from the snapshot's `auth` wire
 * truth (never a live tree read): the type as the tag, the popover
 * naming the source — the request's own config, or the ancestor pool
 * entry that supplied it ("Bearer Token — inherited from Collection
 * 'Payments' › Admin token"). A resolved plain none renders nothing —
 * unauthenticated is the baseline, not a badge — unless a dangling
 * pick fell back, which is a warning worth wearing. Shared by the
 * HTTP ResponseMetaStrip and the WS / gRPC / MQTT session strips.
 */

import type { ExecutedAuthAttribution } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag } from 'antd';
import type React from 'react';
import { authTypeLabelKey, inheritSourceLabel } from '../inherited-auth';

function contentOf(auth: ExecutedAuthAttribution, t: Translate): InfoPopoverContent {
  const type = t(authTypeLabelKey(auth.type));
  const summary =
    auth.source === null
      ? t('workbench.editors.request.response.meta.authSummaryNone')
      : auth.source.level === 'request'
        ? t('workbench.editors.request.response.meta.authSummaryRequest', { type })
        : t('workbench.editors.request.response.meta.authSummaryInherited', {
            type,
            source:
              inheritSourceLabel(t, { kind: auth.source.level, name: auth.source.name }) +
              (auth.source.entryName !== '' ? ` › ${auth.source.entryName}` : ''),
          });
  return {
    title: t('workbench.editors.request.response.meta.authTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary,
    ...(auth.danglingAuthUid !== undefined
      ? { description: t('workbench.editors.request.response.meta.authDangling') }
      : {}),
  };
}

/** Whether the attribution earns a badge — a plain resolved none stays
 *  quiet unless a dangling pick fell back to it. The strips gate their
 *  separator dot on this. */
export function authAttributionHasBadge(
  auth: ExecutedAuthAttribution | undefined,
): auth is ExecutedAuthAttribution {
  return auth !== undefined && (auth.type !== 'none' || auth.danglingAuthUid !== undefined);
}

const AuthAttributionTag: React.FC<{ auth: ExecutedAuthAttribution | undefined }> = ({ auth }) => {
  const t = useT();
  if (!authAttributionHasBadge(auth)) return null;
  return (
    <InfoPopover content={contentOf(auth, t)} trigger="hover">
      <Tag
        color={auth.danglingAuthUid !== undefined ? 'warning' : 'default'}
        data-testid="oh-response-auth"
        style={{ marginInlineEnd: 0, cursor: 'help' }}
      >
        {t(authTypeLabelKey(auth.type))}
      </Tag>
    </InfoPopover>
  );
};

export default AuthAttributionTag;
