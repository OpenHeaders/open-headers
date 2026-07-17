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
import { getDateTimeFormat } from '@openheaders/i18n';
import type { DedupMatchesResult } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { StatusChip } from './StatusChips';

const { Text } = Typography;

interface Args {
  t: Translate;
  locale: string;
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
  const { t } = args;
  const out: StatusChip[] = [];

  // ── Plaintext vault warning ─────────────────────────────────────
  if (args.envelope.meta.redactions.vault === 'plaintext') {
    out.push({
      key: 'plaintext-vault',
      tone: 'warn',
      label: t('workbench.importExport.chips.plaintextLabel'),
      details: (
        <div>
          <strong>{t('workbench.importExport.chips.plaintextTitle')}</strong>
          <p style={{ margin: '6px 0 0' }}>{t('workbench.importExport.chips.plaintextBody')}</p>
        </div>
      ),
    });
  }

  // ── Drops (envelope-valid but per-entity-invalid rows) ──────────
  if (args.drops.length > 0) {
    out.push({
      key: 'drops',
      tone: 'warn',
      label: t('workbench.importExport.chips.skippedLabel', { count: args.drops.length }),
      details: (
        <div>
          <strong>{t('workbench.importExport.chips.skippedTitle', { count: args.drops.length })}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {args.drops.slice(0, 8).map((d, i) => (
              <li key={`${d.path}-${i}`} style={{ fontSize: 11, marginBottom: 2 }}>
                <Text code>{d.path}</Text> — {d.reason}
              </li>
            ))}
            {args.drops.length > 8 && (
              <li style={{ fontSize: 11 }}>
                {t('workbench.importExport.chips.andMore', { count: args.drops.length - 8 })}
              </li>
            )}
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
          label: t('workbench.importExport.chips.dedupSameLabel'),
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>
                {t('workbench.importExport.chips.dedupSameTitle', {
                  id: sameTarget.exportId,
                  date: getDateTimeFormat(args.locale).format(new Date(sameTarget.importedAt)),
                })}
              </strong>
              <p style={{ margin: '6px 0 0' }}>{t('workbench.importExport.chips.dedupSameBody')}</p>
              {diff && <DedupChangesSummary diff={diff} />}
            </div>
          ),
        });
      } else if (otherTarget) {
        out.push({
          key: 'dedup-other',
          tone: 'info',
          label: t('workbench.importExport.chips.dedupOtherLabel'),
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>
                {t('workbench.importExport.chips.dedupOtherTitle', {
                  id: otherTarget.exportId,
                  name: otherTarget.workspaceName,
                })}
              </strong>
              <p style={{ margin: '6px 0 0' }}>{t('workbench.importExport.chips.dedupOtherBody')}</p>
            </div>
          ),
        });
      } else if (uidMatch) {
        out.push({
          key: 'dedup-uid',
          tone: 'info',
          label: t('workbench.importExport.chips.dedupUidLabel'),
          onDismiss: args.onDismissDedup,
          details: (
            <div>
              <strong>{t('workbench.importExport.chips.dedupUidTitle', { name: uidMatch.workspaceName })}</strong>
              <p style={{ margin: '6px 0 0' }}>{t('workbench.importExport.chips.dedupUidBody')}</p>
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
      label: t('workbench.importExport.chips.staleLabel'),
      details: (
        <div>
          <strong>{t('workbench.importExport.chips.staleTitle')}</strong>
          <p style={{ margin: '6px 0 0' }}>{t('workbench.importExport.chips.staleBody')}</p>
        </div>
      ),
    });
  }

  // ── Preview error ───────────────────────────────────────────────
  if (args.previewError) {
    out.push({
      key: 'preview-error',
      tone: 'error',
      label: t('workbench.importExport.chips.previewErrorLabel'),
      details: (
        <div>
          <strong>{t('workbench.importExport.chips.previewErrorTitle')}</strong>
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
      label: t('workbench.importExport.chips.unresolvedLabel', { count: args.missingDeps.length }),
      details: (
        <div>
          <strong>{t('workbench.importExport.chips.unresolvedTitle', { count: args.missingDeps.length })}</strong>
          <p style={{ margin: '6px 0', fontSize: 11 }}>{t('workbench.importExport.chips.unresolvedBody')}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {args.missingDeps.slice(0, 8).map((d) => (
              <li key={`${d.type}:${d.name}`} style={{ fontSize: 11, marginBottom: 2 }}>
                <Tag style={{ marginRight: 4 }}>{d.type}</Tag>
                <Text>{d.name}</Text>
                <Text type="secondary">
                  {' · '}
                  {t('workbench.importExport.chips.referencedBy', { count: d.referencedBy.length })}
                </Text>
              </li>
            ))}
            {args.missingDeps.length > 8 && (
              <li style={{ fontSize: 11 }}>
                <Text type="secondary">
                  {t('workbench.importExport.chips.andMore', { count: args.missingDeps.length - 8 })}
                </Text>
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
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const interesting = diff.sections.filter((s) => s.prior > 0 || s.incoming > 0);
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11 }}>
        {t('workbench.importExport.chips.summaryThen')} <strong>{diff.totals.prior}</strong> ·{' '}
        {t('workbench.importExport.chips.summaryNow')} <strong>{diff.totals.incoming}</strong> ·{' '}
        <span style={{ color: '#1677ff' }}>
          {t('workbench.importExport.chips.summaryNew', { count: diff.totals.new })}
        </span>{' '}
        · {t('workbench.importExport.chips.summaryKept', { count: diff.totals.kept })} ·{' '}
        {t('workbench.importExport.chips.summaryRemoved', { count: diff.totals.removed })}
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
          {expanded
            ? t('workbench.importExport.chips.hideBreakdown')
            : t('workbench.importExport.chips.showBreakdown')}
        </button>
      )}
      {expanded && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
          {interesting.map((s) => (
            <li key={s.type} style={{ fontSize: 11 }}>
              {s.type}: {s.prior} → {s.incoming}
              {s.newUids.length > 0 && (
                <span style={{ color: '#1677ff' }}>
                  {' '}
                  {t('workbench.importExport.chips.sectionNew', { count: s.newUids.length })}
                </span>
              )}
              {s.removedUids.length > 0 && (
                <span style={{ color: '#888' }}>
                  {' '}
                  {t('workbench.importExport.chips.sectionRemoved', { count: s.removedUids.length })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
