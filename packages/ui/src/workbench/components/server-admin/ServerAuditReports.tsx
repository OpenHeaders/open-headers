/**
 * Audit reports — the daemon-admin console's read surface over the
 * daemon's audit log (Phase 1 slice 3). Every page rides the
 * `oh.daemon.audit.query` RPC: a read projection of the SQLite
 * `audit_log`, filter-parity with `ohd audit`, keyset-paged so a
 * page never loses or repeats rows sharing a timestamp.
 *
 * Display names resolve at view time through the console's
 * already-loaded directory (§9.3 — the row's `actorUserId` is
 * immutable; ids without a directory record, like the operator's
 * synthetic user, render verbatim). Rows stamped `daemon.admission`
 * are the HELLO gate's per-connect admissions and are labeled as such,
 * never presented as enforcement decisions.
 *
 * Export mirrors `ohd audit export`: the active filters, raw
 * rows as JSONL, oldest-first — assembled by walking the cursor so the
 * per-frame page cap is respected.
 */

import { Button, Select, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import { getDateTimeFormat, type MessageKey } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';

type AuditRpcRequest = {
  actorUserId?: string;
  capability?: string;
  allow?: boolean;
  workspaceId?: string;
  sinceIso?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  after?: AuditCursor;
};

interface AuditCursor {
  occurredAt: string;
  orgId: string;
  seq: number;
}

interface AuditRow {
  id: string;
  orgId: string;
  seq: number;
  actorUserId: string;
  capability: string;
  workspaceId?: string;
  decision: { allow: boolean; reason?: string };
  occurredAt: string;
}

interface AuditFilters {
  actorUserId?: string;
  capability?: string;
  decision?: 'allow' | 'deny';
  workspaceId?: string;
  /** Relative lower bound on `occurredAt`; absent = full retention window. */
  sinceMs?: number;
}

const CAPABILITY_OPTIONS: ReadonlyArray<{ value: string; labelKey: MessageKey }> = [
  { value: 'daemon.admission', labelKey: 'workbench.serverAdmin.audit.capAdmission' },
  { value: 'daemon.admin', labelKey: 'workbench.serverAdmin.audit.capAdminPlane' },
  { value: 'daemon.sso-grant', labelKey: 'workbench.serverAdmin.audit.capSsoGrant' },
  { value: 'daemon.sso-revoke', labelKey: 'workbench.serverAdmin.audit.capSsoRevoke' },
  { value: 'workspace.read', labelKey: 'workbench.serverAdmin.audit.capWorkspaceRead' },
  { value: 'workspace.write', labelKey: 'workbench.serverAdmin.audit.capWorkspaceWrite' },
  { value: 'workspace.list', labelKey: 'workbench.serverAdmin.audit.capWorkspaceList' },
];

const RANGE_OPTIONS: ReadonlyArray<{ value: number; labelKey: MessageKey }> = [
  { value: 3_600_000, labelKey: 'workbench.serverAdmin.audit.rangeLastHour' },
  { value: 86_400_000, labelKey: 'workbench.serverAdmin.audit.rangeLast24Hours' },
  { value: 7 * 86_400_000, labelKey: 'workbench.serverAdmin.audit.rangeLast7Days' },
  { value: 30 * 86_400_000, labelKey: 'workbench.serverAdmin.audit.rangeLast30Days' },
];

/** Console page size; the server clamps to its own cap independently. */
const PAGE_LIMIT = 100;
/** Export walks the cursor in server-max pages. */
const EXPORT_PAGE_LIMIT = 500;

function formatTime(locale: string, iso: string): string {
  try {
    return getDateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildRequest(filters: AuditFilters, order: 'asc' | 'desc', limit: number, after?: AuditCursor) {
  const request: AuditRpcRequest = { order, limit };
  if (filters.actorUserId) request.actorUserId = filters.actorUserId;
  if (filters.capability) request.capability = filters.capability;
  if (filters.decision) request.allow = filters.decision === 'allow';
  if (filters.workspaceId) request.workspaceId = filters.workspaceId;
  if (filters.sinceMs !== undefined) request.sinceIso = new Date(Date.now() - filters.sinceMs).toISOString();
  if (after) request.after = after;
  return request;
}

const ServerAuditReports: React.FC<{
  users: ReadonlyArray<{ userId: string; displayName: string }>;
  workspaceName: (id: string) => string;
  workspaceOptions: ReadonlyArray<{ value: string; label: string }>;
}> = ({ users, workspaceName, workspaceOptions }) => {
  const { t, locale } = useLocale();
  const { token } = theme.useToken();
  const [filters, setFilters] = useState<AuditFilters>({});
  const [rows, setRows] = useState<readonly AuditRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<AuditCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useCallback(
    (actorUserId: string): string => users.find((u) => u.userId === actorUserId)?.displayName ?? actorUserId,
    [users],
  );

  const load = useCallback(
    async (after?: AuditCursor): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const resp = await hostBridge.call('oh.daemon.audit.query', buildRequest(filters, 'desc', PAGE_LIMIT, after));
        setRows((prev) => (after && prev ? [...prev, ...resp.entries] : [...resp.entries]));
        setNextCursor(resp.nextCursor);
      } catch (err) {
        setError((err as Error).message);
        if (!after) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport(): Promise<void> {
    setExporting(true);
    setError(null);
    try {
      const lines: string[] = [];
      let after: AuditCursor | undefined;
      // CLI-export parity: oldest-first, raw rows, no page cap leaking
      // into the file — walk the cursor until the log is drained.
      for (;;) {
        const resp = await hostBridge.call(
          'oh.daemon.audit.query',
          buildRequest(filters, 'asc', EXPORT_PAGE_LIMIT, after),
        );
        for (const entry of resp.entries) lines.push(JSON.stringify(entry));
        if (!resp.nextCursor) break;
        after = resp.nextCursor;
      }
      const blob = new Blob([lines.join('\n') + (lines.length > 0 ? '\n' : '')], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'daemon-audit.jsonl';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const columns = [
    {
      title: t('workbench.serverAdmin.audit.colTime'),
      dataIndex: 'occurredAt',
      width: 170,
      render: (iso: string) => <span style={{ whiteSpace: 'nowrap' }}>{formatTime(locale, iso)}</span>,
    },
    {
      title: t('workbench.serverAdmin.audit.colEvent'),
      key: 'event',
      width: 170,
      render: (_: unknown, row: AuditRow) => {
        if (row.capability === 'daemon.admission') {
          return row.decision.allow ? (
            <Tag color="blue">{t('workbench.serverAdmin.audit.eventAdmission')}</Tag>
          ) : (
            <Tooltip title={row.decision.reason}>
              <Tag color="orange">{t('workbench.serverAdmin.audit.eventAdmissionRefused')}</Tag>
            </Tooltip>
          );
        }
        if (row.capability === 'daemon.sso-grant')
          return <Tag color="blue">{t('workbench.serverAdmin.audit.eventSsoGrant')}</Tag>;
        if (row.capability === 'daemon.sso-revoke')
          return <Tag color="purple">{t('workbench.serverAdmin.audit.eventSsoRevoke')}</Tag>;
        return row.decision.allow ? (
          <Tag color="green">{t('workbench.serverAdmin.audit.eventAllow')}</Tag>
        ) : (
          <Tooltip title={row.decision.reason}>
            <Tag color="red">
              {t('workbench.serverAdmin.audit.eventDeny')}
              {row.decision.reason ? ` · ${row.decision.reason}` : ''}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('workbench.serverAdmin.audit.colCapability'),
      dataIndex: 'capability',
      width: 150,
      render: (capability: string) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{capability}</span>,
    },
    {
      title: t('workbench.serverAdmin.audit.colWorkspace'),
      dataIndex: 'workspaceId',
      render: (workspaceId: string | undefined) => (workspaceId ? workspaceName(workspaceId) : '—'),
    },
    {
      title: t('workbench.serverAdmin.audit.colActor'),
      dataIndex: 'actorUserId',
      render: (actorUserId: string) => (
        <Tooltip title={actorUserId}>
          <span>{displayName(actorUserId)}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <section style={{ marginBottom: 12 }} data-testid="daemon-audit-reports">
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: token.colorTextSecondary,
          }}
        >
          {t('workbench.serverAdmin.audit.sectionTitle')}
        </h3>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
          {t('workbench.serverAdmin.audit.sectionHint')}
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <Select
            size="small"
            placeholder={t('workbench.serverAdmin.audit.filterActor')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 140 }}
            value={filters.actorUserId}
            options={users.map((u) => ({ value: u.userId, label: u.displayName }))}
            onChange={(v) => setFilters((f) => ({ ...f, actorUserId: v }))}
            data-testid="daemon-audit-filter-actor"
          />
          <Select
            size="small"
            placeholder={t('workbench.serverAdmin.audit.filterCapability')}
            allowClear
            style={{ minWidth: 160 }}
            value={filters.capability}
            options={CAPABILITY_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            onChange={(v) => setFilters((f) => ({ ...f, capability: v }))}
            data-testid="daemon-audit-filter-capability"
          />
          <Select
            size="small"
            placeholder={t('workbench.serverAdmin.audit.filterDecision')}
            allowClear
            style={{ width: 100 }}
            value={filters.decision}
            options={[
              { value: 'allow', label: t('workbench.serverAdmin.audit.decisionAllow') },
              { value: 'deny', label: t('workbench.serverAdmin.audit.decisionDeny') },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, decision: v }))}
            data-testid="daemon-audit-filter-decision"
          />
          <Select
            size="small"
            placeholder={t('workbench.serverAdmin.audit.filterWorkspace')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 150 }}
            value={filters.workspaceId}
            options={[...workspaceOptions]}
            onChange={(v) => setFilters((f) => ({ ...f, workspaceId: v }))}
          />
          <Select
            size="small"
            placeholder={t('workbench.serverAdmin.audit.filterAnyTime')}
            allowClear
            style={{ width: 130 }}
            value={filters.sinceMs}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            onChange={(v) => setFilters((f) => ({ ...f, sinceMs: v }))}
          />
          <div style={{ flex: 1 }} />
          <Button size="small" onClick={() => void load()} loading={loading} data-testid="daemon-audit-refresh">
            {t('workbench.serverAdmin.audit.refresh')}
          </Button>
          <Button
            size="small"
            onClick={() => void handleExport()}
            loading={exporting}
            disabled={rows === null || rows.length === 0}
            data-testid="daemon-audit-export"
          >
            {t('workbench.serverAdmin.audit.exportJsonl')}
          </Button>
        </div>
        {error && (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {error}
          </Typography.Text>
        )}
        <Table<AuditRow>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={rows ? [...rows] : []}
          loading={rows === null}
          pagination={false}
          locale={{ emptyText: t('workbench.serverAdmin.audit.emptyText') }}
        />
        {nextCursor && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <Button size="small" onClick={() => void load(nextCursor)} loading={loading} data-testid="daemon-audit-load-more">
              {t('workbench.serverAdmin.audit.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServerAuditReports;
