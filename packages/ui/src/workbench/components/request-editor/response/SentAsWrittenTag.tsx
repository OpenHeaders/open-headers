/**
 * SentAsWrittenTag — the meta-strip attribution tag for the references
 * a send carried AS WRITTEN, rendered from the snapshot's
 * `sentAsWritten` wire truth (never a live resolver read): the tag
 * counts them in the warning tone, the popover lists each reference
 * against the resolver's fix — the same line the gates speak, so a
 * reader learns why the server saw `{{env.HOST}}` and what to define.
 * A send whose every reference resolved renders nothing — resolved is
 * the baseline, not a badge. Shared by the HTTP ResponseMetaStrip and
 * the WS / MQTT / gRPC strips, beside the auth attribution tag.
 */

import type { SentAsWrittenReference } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover } from '@openheaders/ui/shared/info-popover';
import { Tag } from 'antd';
import type React from 'react';

/** Whether the attribution earns a badge — a send that carried nothing
 *  as written stays quiet. The strips gate their separator dot on this. */
export function sentAsWrittenHasBadge(
  references: readonly SentAsWrittenReference[] | undefined,
): references is readonly SentAsWrittenReference[] {
  return references !== undefined && references.length > 0;
}

const SentAsWrittenTag: React.FC<{ references: readonly SentAsWrittenReference[] | undefined }> = ({
  references,
}) => {
  const t = useT();
  if (!sentAsWrittenHasBadge(references)) return null;
  return (
    <InfoPopover
      content={{
        title: t('workbench.editors.request.response.meta.sentAsWrittenTitle'),
        kicker: t('workbench.editors.request.response.meta.kicker'),
        summary: t('workbench.editors.request.response.meta.sentAsWrittenSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.response.meta.sentAsWrittenHeading'),
            layout: 'stacked',
            items: references.map((reference) => ({
              key: reference.reference,
              label: `{{${reference.reference}}}`,
              desc: reference.hint,
            })),
          },
        ],
      }}
      trigger="hover"
    >
      <Tag color="warning" data-testid="oh-response-sent-as-written" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.request.response.meta.sentAsWrittenTag', { count: references.length })}
      </Tag>
    </InfoPopover>
  );
};

export default SentAsWrittenTag;
