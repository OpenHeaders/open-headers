/**
 * MigrateToolModal — the desktop migration entry surface
 * (MIGRATION_STATUS.md S5 addendum: two clicks of consent, then fully
 * unattended).
 *
 * Step 1 (offer): explains exactly what a scan does — a fixed allowlist
 * of application folders, tool data files only, never credentials —
 * behind an explicit "Scan this computer" button (consent click 1).
 *
 * Step 2 (findings): one row per known tool with its detection state
 * and any scanned data stores. Consent click 2 is per-path:
 *   - a Postman backup finding imports through the standard sectioned
 *     flow (the host re-validates the path against the scan allowlist
 *     before reading);
 *   - the Postman API-key field starts the unattended background pull —
 *     the key crosses the bridge once and is never persisted or logged;
 *   - stores we can't read directly (Insomnia's local data) get the
 *     guided export→drop walkthrough into the import hub.
 */

import { CheckCircleFilled, CloudDownloadOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { hostBridge, type MigrationScanResult } from '@openheaders/core/bridge';
import {
  type InsomniaNedbFinding,
  MIGRATION_TOOLS,
  type MigrationTool,
  type PostmanBackupFinding,
  type ToolDataFinding,
  type ToolInstallFinding,
} from '@openheaders/core/import';
import { Alert, Button, Input, Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const { Text, Paragraph } = Typography;

interface MigrateToolModalProps {
  open: boolean;
  onClose: () => void;
  /** Route a scanned Postman backup's text into the sectioned import flow. */
  onImportBackupText: (text: string) => void;
  /** Guided export→drop hand-off for stores we never read directly. */
  onOpenImportHub: () => void;
}

interface ScanState {
  tools: ToolInstallFinding[];
  data: MigrationScanResult;
}

function formatBackupCounts(finding: PostmanBackupFinding): string {
  const c = finding.counts;
  return `${c.collections} collections · ${c.environments} environments · ${c.headerPresets} header presets · ${c.globals} globals`;
}

function formatInsomniaCounts(finding: InsomniaNedbFinding): string {
  const c = finding.counts;
  return `${c.collections} collections · ${c.environments} environments · ${c.requests} requests`;
}

const MigrateToolModal: React.FC<MigrateToolModalProps> = ({ open, onClose, onImportBackupText, onOpenImportHub }) => {
  const { token } = theme.useToken();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [starting, setStarting] = useState(false);
  const [startReason, setStartReason] = useState<string | null>(null);
  const [readReason, setReadReason] = useState<string | null>(null);
  const [readingPath, setReadingPath] = useState<string | null>(null);

  // Everything resets on close — the key is component state only and
  // must never outlive the surface (memory-only key handling, S5).
  useEffect(() => {
    if (open) return;
    setScanning(false);
    setScanError(null);
    setScan(null);
    setApiKey('');
    setStarting(false);
    setStartReason(null);
    setReadReason(null);
    setReadingPath(null);
  }, [open]);

  const runScan = useCallback(() => {
    setScanning(true);
    setScanError(null);
    void Promise.all([hostBridge.call('oh.migration.detectTools'), hostBridge.call('oh.migration.scanToolData')])
      .then(([tools, data]) => setScan({ tools, data }))
      .catch(() => setScanError('The scan could not run — try again, or use the import hub with an exported file.'))
      .finally(() => setScanning(false));
  }, []);

  const importBackup = useCallback(
    (path: string) => {
      setReadingPath(path);
      setReadReason(null);
      void hostBridge
        .call('oh.migration.readBackup', { path })
        .then((result) => {
          if (result.text !== null) onImportBackupText(result.text);
          else setReadReason(result.reason ?? 'The backup file could not be read.');
        })
        .catch(() => setReadReason('The backup file could not be read.'))
        .finally(() => setReadingPath(null));
    },
    [onImportBackupText],
  );

  const startPull = useCallback(() => {
    const key = apiKey.trim();
    if (!key) return;
    setStarting(true);
    setStartReason(null);
    void hostBridge
      .call('oh.migration.postmanPull.start', { apiKey: key })
      .then((result) => {
        if (result.started) {
          setApiKey('');
          onClose();
        } else {
          setStartReason(result.reason ?? 'The import could not start.');
        }
      })
      .catch(() => setStartReason('The import could not start.'))
      .finally(() => setStarting(false));
  }, [apiKey, onClose]);

  const findingsFor = (tool: MigrationTool): ToolDataFinding[] =>
    scan?.data.findings.filter((finding) => finding.tool === tool) ?? [];

  const renderFinding = (finding: ToolDataFinding): React.ReactNode => {
    if (finding.store === 'postman-backup') {
      return (
        <div
          key={finding.path}
          style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 22, marginTop: 4 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12 }}>Backup from {new Date(finding.mtimeMs).toLocaleDateString()}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {formatBackupCounts(finding)}
            </Text>
          </div>
          <Button size="small" loading={readingPath === finding.path} onClick={() => importBackup(finding.path)}>
            Import…
          </Button>
        </div>
      );
    }
    return (
      <div key={finding.dir} style={{ paddingLeft: 22, marginTop: 4 }}>
        <Text style={{ fontSize: 12 }}>Local data found</Text>
        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
          {formatInsomniaCounts(finding)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
          Export it from Insomnia (Preferences → Data → Export), then drop the file in the{' '}
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12, height: 'auto' }} onClick={onOpenImportHub}>
            import hub
          </Button>
          .
        </Text>
      </div>
    );
  };

  return (
    <Modal
      title="Migrate from another tool"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      {scan === null ? (
        <>
          <Paragraph>
            Open Headers can look for Postman, Insomnia, Thunder Client, and Bruno on this computer and inventory the
            data they left behind.
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            The scan checks a fixed list of application folders and reads only tool data files (backups and local
            stores). It never opens credential, cookie, or session files, and nothing leaves this computer. Importing
            anything is a separate, explicit step.
          </Paragraph>
          {scanError && <Alert type="error" showIcon message={scanError} style={{ marginBottom: 12 }} />}
          {scanning ? (
            <Skeleton active title={false} paragraph={{ rows: 3 }} />
          ) : (
            <Button type="primary" onClick={runScan}>
              Scan this computer
            </Button>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MIGRATION_TOOLS.map((tool) => {
              const install = scan.tools.find((finding) => finding.tool === tool);
              const detected = install?.detected ?? false;
              return (
                <div key={tool}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {detected ? (
                      <CheckCircleFilled style={{ color: token.colorSuccess }} />
                    ) : (
                      <MinusCircleOutlined style={{ color: token.colorTextTertiary }} />
                    )}
                    <Text strong={detected}>{install?.displayName ?? tool}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {detected ? 'Detected' : 'Not found'}
                    </Text>
                  </span>
                  {findingsFor(tool).map(renderFinding)}
                </div>
              );
            })}
          </div>
          {readReason && <Alert type="error" showIcon message={readReason} style={{ marginTop: 12 }} />}
          {scan.data.skipped.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              {scan.data.skipped.length} store file{scan.data.skipped.length === 1 ? ' was' : 's were'} skipped —{' '}
              {scan.data.skipped[0].reason}
            </Text>
          )}

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CloudDownloadOutlined />
              <Text strong>Pull everything from your Postman account</Text>
            </span>
            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>
              Paste a Postman API key (Settings → API keys) to import all workspaces, collections, and environments in
              the background. The key is used for this run only — it is never stored or logged.
            </Paragraph>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onPressEnter={startPull}
                placeholder="PMAK-…"
                autoComplete="off"
                aria-label="Postman API key"
                style={{ flex: 1 }}
              />
              <Button type="primary" loading={starting} disabled={apiKey.trim().length === 0} onClick={startPull}>
                Start background import
              </Button>
            </div>
            {startReason && <Alert type="error" showIcon message={startReason} style={{ marginTop: 8 }} />}
            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Progress appears in the corner — each Postman workspace lands in its own workspace, keeping its exact
              name, with an end-of-run report.
            </Paragraph>
          </div>
        </>
      )}
    </Modal>
  );
};

export default MigrateToolModal;
