import type { SubtreeStats } from '../../../data/cascade/cascade-summary';
import type { InitiatorRowMeta } from '../../../data/initiator-row-meta';
import { formatBytes, formatMs } from './utils';

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

export function RowChips({ meta, subtree }: { meta: InitiatorRowMeta; subtree: SubtreeStats | null }) {
  const chips: React.ReactNode[] = [];
  if (meta.initiatorType) {
    chips.push(
      <Chip key="init" tone="muted" title="Initiator type">
        {meta.initiatorType}
      </Chip>,
    );
  }
  if (meta.isFailed && meta.statusCode != null) {
    chips.push(
      <Chip key="status" tone="warn" title="HTTP status">
        {meta.statusCode}
      </Chip>,
    );
  } else if (meta.statusCode != null && meta.statusCode >= 400) {
    chips.push(
      <Chip key="status" tone="warn" title="HTTP status">
        {meta.statusCode}
      </Chip>,
    );
  } else if (meta.isFailed) {
    chips.push(
      <Chip key="status" tone="warn" title="Request failed">
        failed
      </Chip>,
    );
  }
  if (meta.sizeBytes != null && meta.sizeBytes >= 50 * 1024) {
    chips.push(
      <Chip key="size" title="Transferred">
        {formatBytes(meta.sizeBytes)}
      </Chip>,
    );
  }
  if (meta.durationMs != null && meta.durationMs >= 200) {
    chips.push(
      <Chip key="dur" title="Duration">
        {formatMs(meta.durationMs)}
      </Chip>,
    );
  }
  if (meta.isThirdParty) {
    chips.push(
      <Chip key="3p" tone="muted" title="Third-party origin">
        3rd-party
      </Chip>,
    );
  }
  if (subtree && subtree.count > 0) {
    chips.push(
      <Chip key="sub" tone="muted" title="Subtree weight (descendants · bytes)">
        +{subtree.count} req · {formatBytes(subtree.bytes)}
      </Chip>,
    );
  }
  if (chips.length === 0) return null;
  return <span className="dt-initiator-row-chips">{chips}</span>;
}
