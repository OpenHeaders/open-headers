/**
 * ReimportDiffPanel — renders a `diffImportReports(prev, next)`
 * result as an Ant `Alert` with per-partition detail lists. Used by
 * every importer modal so the diff UX stays uniform.
 *
 * Surfaces:
 *   • Progress — "X drops resolved since last import."
 *   • Regression — "Y new drops since last import."
 *   • Persistent — folded away under a detail dropdown so the user
 *     can audit but doesn't drown in repeats.
 *
 * Design: unlike the live preview in the curl/HAR modals (which
 * shows the current parse's full drop list), this panel only surfaces
 * entries that CHANGED vs the previous report. If nothing changed,
 * `diff.hasChanges === false` → caller should skip rendering entirely.
 */

import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { ImportReportDiff } from '@openheaders/core/import';
import { getRelativeTimeFormat } from '@openheaders/i18n';
import { Alert, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

interface ReimportDiffPanelProps {
  diff: ImportReportDiff;
}

function relativeAge(previousIso: string, locale: string): string {
  const then = Date.parse(previousIso);
  if (Number.isNaN(then)) return 'previously';
  const delta = Date.now() - then;
  const minutes = Math.round(delta / 60_000);
  if (delta < 0 || minutes < 1) return getRelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
  const format = getRelativeTimeFormat(locale, { numeric: 'always' });
  if (minutes < 60) return format.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return format.format(-days, 'day');
  const months = Math.round(days / 30);
  if (months < 12) return format.format(-months, 'month');
  return format.format(-Math.round(months / 12), 'year');
}

const ReimportDiffPanel: React.FC<ReimportDiffPanelProps> = ({ diff }) => {
  const { token } = theme.useToken();
  const { t, locale } = useLocale();
  const age = relativeAge(diff.previousImportedAt, locale);

  // Decide headline tone. Regression wins over progress — the user
  // needs to see new drops most urgently.
  const added = diff.drops.added.length + diff.transforms.added.length;
  const resolved = diff.drops.resolved.length + diff.transforms.resolved.length;
  const summaryChanged =
    diff.summaryDelta.imported !== 0 || diff.summaryDelta.dropped !== 0 || diff.summaryDelta.transformed !== 0;

  const headline =
    added > 0
      ? t('workbench.importExport.reimport.newIssues', { count: added })
      : resolved > 0
        ? t('workbench.importExport.reimport.nowHandled', { count: resolved })
        : summaryChanged
          ? t('workbench.importExport.reimport.countsChanged')
          : t('workbench.importExport.reimport.minorChanges');

  const tone: 'warning' | 'success' | 'info' = added > 0 ? 'warning' : resolved > 0 ? 'success' : 'info';
  const Icon = added > 0 ? WarningOutlined : resolved > 0 ? CheckCircleOutlined : ArrowUpOutlined;

  return (
    <Alert
      type={tone}
      showIcon
      icon={<Icon />}
      style={{ marginBottom: 12 }}
      message={
        <Space size={8} wrap>
          <Text strong style={{ fontSize: 12 }}>
            {headline}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.importExport.reimport.previouslyImported', { age })}
          </Text>
        </Space>
      }
      description={
        <div style={{ fontSize: 12 }}>
          <SummaryDeltaRow diff={diff} />
          {diff.drops.added.length > 0 && (
            <DetailList
              heading={t('workbench.importExport.reimport.newDrops', { count: diff.drops.added.length })}
              tone="regression"
              items={diff.drops.added.map((d) => ({ path: d.path, detail: d.reason }))}
              token={token}
            />
          )}
          {diff.drops.resolved.length > 0 && (
            <DetailList
              heading={t('workbench.importExport.reimport.dropsResolved', { count: diff.drops.resolved.length })}
              tone="progress"
              items={diff.drops.resolved.map((d) => ({ path: d.path, detail: d.reason }))}
              token={token}
            />
          )}
          {diff.transforms.added.length > 0 && (
            <DetailList
              heading={t('workbench.importExport.reimport.newTransforms', { count: diff.transforms.added.length })}
              tone="neutral"
              items={diff.transforms.added.map((t) => ({
                path: t.path,
                detail: `${t.from} → ${t.to}: ${t.reason}`,
              }))}
              token={token}
            />
          )}
          {diff.transforms.resolved.length > 0 && (
            <DetailList
              heading={t('workbench.importExport.reimport.transformsResolved', {
                count: diff.transforms.resolved.length,
              })}
              tone="progress"
              items={diff.transforms.resolved.map((t) => ({
                path: t.path,
                detail: `${t.from} → ${t.to}: ${t.reason}`,
              }))}
              token={token}
            />
          )}
        </div>
      }
    />
  );
};

// ── Summary delta row ──────────────────────────────────────────────

const SummaryDeltaRow: React.FC<{ diff: ImportReportDiff }> = ({ diff }) => {
  const parts: Array<{ label: string; delta: number }> = [
    { label: 'imported', delta: diff.summaryDelta.imported },
    { label: 'dropped', delta: diff.summaryDelta.dropped },
    { label: 'transformed', delta: diff.summaryDelta.transformed },
  ].filter((p) => p.delta !== 0);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
      {parts.map((p) => (
        <Tag key={p.label}>
          {p.label}: {p.delta > 0 ? '+' : ''}
          {p.delta}{' '}
          {p.delta > 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
        </Tag>
      ))}
    </div>
  );
};

// ── Detail list ────────────────────────────────────────────────────

interface DetailListProps {
  heading: string;
  tone: 'regression' | 'progress' | 'neutral';
  items: Array<{ path: string; detail: string }>;
  token: ReturnType<typeof theme.useToken>['token'];
}

const DetailList: React.FC<DetailListProps> = ({ heading, tone, items, token }) => {
  const color =
    tone === 'regression' ? token.colorWarning : tone === 'progress' ? token.colorSuccess : token.colorPrimary;
  return (
    <div style={{ marginTop: 4 }}>
      <Text strong style={{ color, fontSize: 11, letterSpacing: 0.3 }}>
        {heading.toUpperCase()}
      </Text>
      <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
        {items.map((it, i) => (
          <li key={i}>
            <strong>{it.path}:</strong>{' '}
            <span style={{ color: token.colorTextSecondary, fontSize: 11 }}>{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReimportDiffPanel;
