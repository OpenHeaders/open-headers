import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { SubtreeStats } from '../../../data/cascade/cascade-summary';
import type { InitiatorRowMeta } from '../../../data/initiator/initiator-row-meta';
import { formatBytes, formatMs } from './utils';

// Chip copy resolved once per locale — the chain/tree row loops read
// this object, never `t()` (per-row law). Byte / ms figures ride raw.
export function buildInitiatorRowLabels(t: Translate) {
  return {
    initiatorTypeTitle: t('panel.inspector.initiator.chip.initiatorTypeTitle'),
    httpStatusTitle: t('panel.inspector.initiator.chip.httpStatusTitle'),
    requestFailedTitle: t('panel.inspector.initiator.chip.requestFailedTitle'),
    failed: t('panel.inspector.initiator.chip.failed'),
    transferredTitle: t('panel.inspector.initiator.chip.transferredTitle'),
    durationTitle: t('panel.inspector.initiator.chip.durationTitle'),
    thirdPartyTitle: t('panel.inspector.initiator.chip.thirdPartyTitle'),
    thirdParty: t('panel.inspector.initiator.chip.thirdParty'),
    subtreeTitle: t('panel.inspector.initiator.chip.subtreeTitle'),
    subtree: (count: number, bytes: string) => t('panel.inspector.initiator.chip.subtree', { count, bytes }),
    collapse: t('panel.inspector.initiator.collapse'),
    expand: t('panel.inspector.initiator.expand'),
  };
}
export type InitiatorRowLabels = ReturnType<typeof buildInitiatorRowLabels>;

function Chip({
  tone,
  title,
  children,
}: {
  tone?: 'default' | 'warn' | 'good' | 'muted';
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="dt-initiator-row-chip" data-tone={tone ?? 'default'} title={title}>
      {children}
    </span>
  );
}

export function RowChips({
  meta,
  subtree,
  labels,
}: {
  meta: InitiatorRowMeta;
  subtree: SubtreeStats | null;
  labels: InitiatorRowLabels;
}) {
  const chips: React.ReactNode[] = [];
  if (meta.initiatorType) {
    chips.push(
      <Chip key="init" tone="muted" title={labels.initiatorTypeTitle}>
        {meta.initiatorType}
      </Chip>,
    );
  }
  if (meta.isFailed && meta.statusCode != null) {
    chips.push(
      <Chip key="status" tone="warn" title={labels.httpStatusTitle}>
        {meta.statusCode}
      </Chip>,
    );
  } else if (meta.statusCode != null && meta.statusCode >= 400) {
    chips.push(
      <Chip key="status" tone="warn" title={labels.httpStatusTitle}>
        {meta.statusCode}
      </Chip>,
    );
  } else if (meta.isFailed) {
    chips.push(
      <Chip key="status" tone="warn" title={labels.requestFailedTitle}>
        {labels.failed}
      </Chip>,
    );
  }
  if (meta.sizeBytes != null && meta.sizeBytes >= 50 * 1024) {
    chips.push(
      <Chip key="size" title={labels.transferredTitle}>
        {formatBytes(meta.sizeBytes)}
      </Chip>,
    );
  }
  if (meta.durationMs != null && meta.durationMs >= 200) {
    chips.push(
      <Chip key="dur" title={labels.durationTitle}>
        {formatMs(meta.durationMs)}
      </Chip>,
    );
  }
  if (meta.isThirdParty) {
    chips.push(
      <Chip key="3p" tone="muted" title={labels.thirdPartyTitle}>
        {labels.thirdParty}
      </Chip>,
    );
  }
  if (subtree && subtree.count > 0) {
    chips.push(
      <Chip key="sub" tone="muted" title={labels.subtreeTitle}>
        {labels.subtree(subtree.count, formatBytes(subtree.bytes))}
      </Chip>,
    );
  }
  if (chips.length === 0) return null;
  return <span className="dt-initiator-row-chips">{chips}</span>;
}
