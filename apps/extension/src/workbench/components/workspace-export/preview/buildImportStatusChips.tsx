/**
 * Pure assembly of the import-preview's status chip set. Centralises
 * the conditions that used to render full-width Alert banners
 * (plaintext vault, soft-dedup, stale snapshot, preview error, drops,
 * missing deps) into a single compact chip row at the top-right of the
 * modal.
 */

import {
  diffIncomingAgainstPriorImport,
  type ImportDrop,
  type ImportSinceLastDiff,
  type MissingDep,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import { Tag, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { DedupMatchesResult } from '@/background/modules/workspace-import-dedup';
import type { StatusChip } from './StatusChips';

const { Text } = Typography;

interface Args {
  envelope: WorkspaceExport;
  drops: ImportDrop[];
  dedup: DedupMatchesResult | null;
  dedupDismissed: ReadonlySet<string>;
  onDismissDedup: () => void;
  effectiveEnvelope: WorkspaceExport | null;
  staleSnapshot: boolean;
  previewError: string | null;
  missingDeps: MissingDep[];
  targetWorkspaceId: string | null;
}

export function buildImportStatusChips(args: Args): StatusChip[] {
  const out: StatusChip[] = [];

  // ── Plaintext vault warning ─────────────────────────────────────
  if (args.envelope.meta.redactions.vault === 'plaintext') {
    out.push({
      key: 'plaintext-vault',
      tone: 'warn',
      label: 'Plaintext secrets',
      details: (
        <div>
          <strong>This export contains plaintext vault secrets.</strong>
          <p style={{ margin: '6px 0 0' }}>
            Anyone with this file can read every secret it carries. Consider re-issuing as encrypted before forwarding.
          </p>
        </div>
      ),
    });
  }

  // ── Drops (envelope-valid but per-entity-invalid rows) ──────────
  if (args.drops.length > 0) {
    out.push({
      key: 'drops',
      tone: 'warn',
      label: `${args.drops.length} skipped`,
      details: (
        <div>
          <strong>
            {args.drops.length} entit{args.drops.length === 1 ? 'y' : 'ies'} couldn't be parsed and will be skipped.
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {args.drops.slice(0, 8).map((d, i) => (
              <li key={`${d.path}-${i}`} style={{ fontSize: 11, marginBottom: 2 }}>
                <Text code>{d.path}</Text> — {d.reason}
              </li>
            ))}
            {args.drops.length > 8 && <li style={{ fontSize: 11 }}>…and {args.drops.length - 8} more</li>}
          </ul>
        </div>
      ),
    });
  }

  // ── Soft-dedup (precedence per design §5.2) ─────────────────────
  if (args.dedup) {
    const dedupKey = `${args.envelope.exportId}:${args.targetWorkspaceId ?? 'new'}`;
    const dismissed = args.dedupDismissed.has(dedupKey);
    if (!dismissed) {
      const sameTarget = args.dedup.exportIdSameTarget[0];
      const otherTarget = args.dedup.exportIdOtherTargets[0];
      const uidMatch = args.dedup.workspaceUidMatches[0];

      if (sameTarget) {
        const canDiff = !!(args.effectiveEnvelope && sameTarget.perEntityStrategies);
        const diff: ImportSinceLastDiff | null =
          canDiff && args.effectiveEnvelope && sameTarget.perEntityStrategies
            ? diffIncomingAgainstPriorImport(args.effectiveEnvelope, sameTarget.perEntityStrategies)
            : null;
        out.push({
          key: 'dedup-same',
          tone: 'info',
          label: 'Already imported here',
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>
                You imported this export ({sameTarget.exportId}) here on{' '}
                {new Date(sameTarget.importedAt).toLocaleDateString()}.
              </strong>
              <p style={{ margin: '6px 0 0' }}>Re-importing it will apply your current per-entity strategy choices.</p>
              {diff && <DedupChangesSummary diff={diff} />}
            </div>
          ),
        });
      } else if (otherTarget) {
        out.push({
          key: 'dedup-other',
          tone: 'info',
          label: 'Imported elsewhere',
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>
                You also imported export {otherTarget.exportId} into "{otherTarget.workspaceName}".
              </strong>
              <p style={{ margin: '6px 0 0' }}>That workspace is unaffected by this import.</p>
            </div>
          ),
        });
      } else if (uidMatch) {
        out.push({
          key: 'dedup-uid',
          tone: 'info',
          label: 'Source already exists',
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>A workspace from this source already exists ("{uidMatch.workspaceName}").</strong>
              <p style={{ margin: '6px 0 0' }}>Switch the target above to refresh it, or import as a new copy.</p>
            </div>
          ),
        });
      }
    }
  }

  // ── Stale snapshot ──────────────────────────────────────────────
  if (args.staleSnapshot) {
    out.push({
      key: 'stale',
      tone: 'warn',
      label: 'Data changed',
      details: (
        <div>
          <strong>The target workspace was modified by another tab.</strong>
          <p style={{ margin: '6px 0 0' }}>
            The collision tree below has been refreshed — review and click Import again.
          </p>
        </div>
      ),
    });
  }

  // ── Preview error ───────────────────────────────────────────────
  if (args.previewError) {
    out.push({
      key: 'preview-error',
      tone: 'error',
      label: 'Preview failed',
      details: (
        <div>
          <strong>Couldn't compute collision diff.</strong>
          <p style={{ margin: '6px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>
            {args.previewError}
          </p>
        </div>
      ),
    });
  }

  // ── Missing deps ────────────────────────────────────────────────
  if (args.missingDeps.length > 0) {
    out.push({
      key: 'missing-deps',
      tone: 'warn',
      label: `${args.missingDeps.length} unresolved`,
      details: (
        <div>
          <strong>
            {args.missingDeps.length} unresolved reference{args.missingDeps.length === 1 ? '' : 's'}.
          </strong>
          <p style={{ margin: '6px 0', fontSize: 11 }}>
            These names don't resolve in the export or the target. Imports will land as broken bindings — rebind once
            the missing entity appears.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {args.missingDeps.slice(0, 8).map((d) => (
              <li key={`${d.type}:${d.name}`} style={{ fontSize: 11, marginBottom: 2 }}>
                <Tag style={{ marginRight: 4 }}>{d.type}</Tag>
                <Text>{d.name}</Text>
                <Text type="secondary"> · referenced by {d.referencedBy.length}</Text>
              </li>
            ))}
            {args.missingDeps.length > 8 && (
              <li style={{ fontSize: 11 }}>
                <Text type="secondary">…and {args.missingDeps.length - 8} more</Text>
              </li>
            )}
          </ul>
        </div>
      ),
    });
  }

  return out;
}

const DedupChangesSummary: React.FC<{ diff: ImportSinceLastDiff }> = ({ diff }) => {
  const [expanded, setExpanded] = useState(false);
  const interesting = diff.sections.filter((s) => s.prior > 0 || s.incoming > 0);
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11 }}>
        Then: <strong>{diff.totals.prior}</strong> · Now: <strong>{diff.totals.incoming}</strong> ·{' '}
        <span style={{ color: '#1677ff' }}>{diff.totals.new} new</span> · {diff.totals.kept} kept ·{' '}
        {diff.totals.removed} removed
      </div>
      {interesting.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 6,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: '#1677ff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
        >
          {expanded ? 'Hide breakdown' : 'Show per-section breakdown'}
        </button>
      )}
      {expanded && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
          {interesting.map((s) => (
            <li key={s.type} style={{ fontSize: 11 }}>
              {s.type}: {s.prior} → {s.incoming}
              {s.newUids.length > 0 && <span style={{ color: '#1677ff' }}> (+{s.newUids.length} new)</span>}
              {s.removedUids.length > 0 && <span style={{ color: '#888' }}> ({s.removedUids.length} removed)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
