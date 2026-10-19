/**
 * The telemetry inspector — the "view it byte for byte" affordance both
 * privacy rows share (the telemetry plan §6; the error reports plan
 * §4.2 law 8). One modal, two sections: the usage events of this
 * session and the crash and error reports of this session, each read
 * from the host over its one-shot RPC exactly as it travels on the
 * wire, sent or suppressed. The opener names the section it is about.
 *
 * The logs live with the host client, so the open modal re-polls both
 * snapshots — the poll only runs while the modal is on screen, keeping
 * the read path one-shot RPCs with no standing wire.
 */

import type { ErrorReportSnapshotWire, ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getDateTimeFormat } from '@openheaders/i18n';
import { Empty, Modal, Tabs, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const REFRESH_INTERVAL_MS = 3000;

const DISPOSITION_COLOR: Record<string, string> = {
  sent: 'green',
  pending: 'blue',
  suppressed: 'default',
  dropped: 'orange',
};

export type TelemetryInspectorSection = 'events' | 'reports';

interface TelemetryInspectorModalProps {
  open: boolean;
  /** The section the opener is about — the active tab when the modal opens. */
  section: TelemetryInspectorSection;
  onClose: () => void;
}

interface LogRowProps {
  at: number;
  disposition: string;
  payload: unknown;
  testId: string;
}

const LogRow: React.FC<LogRowProps> = ({ at, disposition, payload, testId }) => {
  const { locale } = useLocale();
  return (
    <div data-testid={testId} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {getDateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(at))}
      </Text>
      <Tag color={DISPOSITION_COLOR[disposition] ?? 'default'}>{disposition}</Tag>
      <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
        {JSON.stringify(payload)}
      </Text>
    </div>
  );
};

const listStyle: React.CSSProperties = {
  maxHeight: 420,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
  flexWrap: 'wrap',
};

const TelemetryInspectorModal: React.FC<TelemetryInspectorModalProps> = ({ open, section, onClose }) => {
  const { t } = useLocale();
  const [active, setActive] = useState<TelemetryInspectorSection>(section);
  const [events, setEvents] = useState<ProductTelemetrySnapshot | null>(null);
  const [reports, setReports] = useState<ErrorReportSnapshotWire | null>(null);

  const refresh = useCallback(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    void bridge
      .call('productTelemetryRead')
      .then(setEvents)
      .catch(() => setEvents(null));
    void bridge
      .call('errorReportRead')
      .then(setReports)
      .catch(() => setReports(null));
  }, []);

  // Each open lands on the opener's section and reads both logs at once.
  useEffect(() => {
    if (!open) return;
    setActive(section);
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, section, refresh]);

  const eventsBody = (
    <>
      {events && (
        <div style={headerStyle}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {events.enabled
              ? t('workbench.settings.telemetryRow.sessionOn', { sessionId: events.sessionId })
              : t('workbench.settings.telemetryRow.sessionOff', { sessionId: events.sessionId })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {events.installId
              ? t('workbench.settings.telemetryRow.install', { installId: events.installId })
              : t('workbench.settings.telemetryRow.noInstall')}
          </Text>
        </div>
      )}
      {!events || events.entries.length === 0 ? (
        <Empty description={t('workbench.settings.telemetryRow.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={listStyle}>
          {events.entries.map((entry, index) => (
            <LogRow
              // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only and re-rendered whole per snapshot
              key={index}
              at={entry.at}
              disposition={entry.disposition}
              payload={entry.event}
              testId="product-telemetry-event"
            />
          ))}
        </div>
      )}
    </>
  );

  const reportsBody = (
    <>
      {reports && (
        <div style={headerStyle}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reports.enabled
              ? t('workbench.settings.errorReportsRow.sessionOn', { sessionId: reports.sessionId })
              : t('workbench.settings.errorReportsRow.sessionOff', { sessionId: reports.sessionId })}
          </Text>
        </div>
      )}
      {!reports || reports.entries.length === 0 ? (
        <Empty description={t('workbench.settings.errorReportsRow.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={listStyle}>
          {reports.entries.map((entry, index) => (
            <LogRow
              // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only and re-rendered whole per snapshot
              key={index}
              at={entry.at}
              disposition={entry.disposition}
              payload={entry.report}
              testId="error-report-entry"
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Modal
      title={t('workbench.settings.telemetryRow.modalTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      <Tabs
        activeKey={active}
        onChange={(key) => setActive(key as TelemetryInspectorSection)}
        items={[
          { key: 'events', label: t('workbench.settings.telemetryRow.tabEvents'), children: eventsBody },
          { key: 'reports', label: t('workbench.settings.telemetryRow.tabReports'), children: reportsBody },
        ]}
      />
    </Modal>
  );
};

export default TelemetryInspectorModal;
