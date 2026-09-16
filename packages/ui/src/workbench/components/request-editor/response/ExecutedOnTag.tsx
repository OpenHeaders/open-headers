/**
 * ExecutedOnTag — the meta-strip attribution tag for a run answered by
 * another host on this surface's behalf, rendered from the record's
 * `executedOn` stamp (set by the ANSWERING host, never a live read):
 * "Sent from <place>" with the popover naming what that means for the
 * egress address the target saw. Shared by the HTTP ResponseMetaStrip,
 * the gRPC meta strip and the WebSocket / MQTT session strips — the
 * four snapshot kinds carry the same shape (the Execution Place plan,
 * Phase A attribution).
 */

import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag } from 'antd';
import type React from 'react';

export type ExecutedOnStamp = NonNullable<ExecutedGrpcSnapshot['executedOn']>;

function executedOnContent(name: string, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.executedOnTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.executedOnSummary', { name }),
  };
}

const ExecutedOnTag: React.FC<{ executedOn: ExecutedOnStamp }> = ({ executedOn }) => {
  const t = useT();
  return (
    <InfoPopover content={executedOnContent(executedOn.name, t)} trigger="hover">
      <Tag color="default" data-testid="oh-response-executed-on" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.request.response.meta.executedOnTag', { name: executedOn.name })}
      </Tag>
    </InfoPopover>
  );
};

export default ExecutedOnTag;
