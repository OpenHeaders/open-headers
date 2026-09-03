/**
 * InheritedSettingsTag — the meta-strip attribution tag for the
 * settings a run took from the levels above the request, rendered from
 * the snapshot's `inheritedSettings` wire truth (never a live tree
 * read): the tag counts them, the popover lists each knob's row label
 * against the level that supplied it ("Request timeout — Collection
 * ‘Payments’"), in the kind's key order (the settings-inheritance
 * law). A run whose every knob was the request's own, or nobody's,
 * renders nothing — the defaults are the baseline, not a badge. Shared
 * by the HTTP ResponseMetaStrip and the WS / MQTT / gRPC strips, beside
 * the auth attribution tag.
 */

import type { AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import type { InheritedSettingSource } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover } from '@openheaders/ui/shared/info-popover';
import { Tag } from 'antd';
import type React from 'react';
import { settingLabelKey } from '../../shared/inherited-settings/setting-labels';
import { inheritSourceLabel } from '../inherited-auth';

/** Whether the attribution earns a badge — a run that inherited
 *  nothing stays quiet. The strips gate their separator dot on this. */
export function inheritedSettingsHasBadge(
  sources: readonly InheritedSettingSource[] | undefined,
): sources is readonly InheritedSettingSource[] {
  return sources !== undefined && sources.length > 0;
}

const InheritedSettingsTag: React.FC<{
  kind: AuthProtocolKind;
  sources: readonly InheritedSettingSource[] | undefined;
}> = ({ kind, sources }) => {
  const t = useT();
  if (!inheritedSettingsHasBadge(sources)) return null;
  return (
    <InfoPopover
      content={{
        title: t('workbench.editors.request.response.meta.inheritedSettingsTitle'),
        kicker: t('workbench.editors.request.response.meta.kicker'),
        summary: t('workbench.editors.request.response.meta.inheritedSettingsSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.response.meta.inheritedSettingsHeading'),
            layout: 'stacked',
            items: sources.map((source) => ({
              key: source.key,
              label: t(settingLabelKey(kind, source.key)),
              desc: inheritSourceLabel(t, { kind: source.level, name: source.name }),
            })),
          },
        ],
      }}
      trigger="hover"
    >
      <Tag color="default" data-testid="oh-response-inherited-settings" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.request.response.meta.inheritedSettingsTag', { count: sources.length })}
      </Tag>
    </InfoPopover>
  );
};

export default InheritedSettingsTag;
