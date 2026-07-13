/**
 * MigrateToolModal — the desktop migration entry surface, one wide
 * modal (S14 UI law: never modal-over-modal; sections collapse/expand
 * and every step renders inline).
 *
 * "Migrate from other vendors" is always visible with a big centered
 * "Detect and import data" button (consent click 1: the fixed-allowlist
 * detect+scan — tool data files only, never credentials). Vendor rows
 * carry a brand mark and, after detection, status only; backup dates,
 * counts, guided walkthroughs, and skipped stores live in the compact
 * details table below.
 *
 * Postman's Import needs no detection — it collapses everything else
 * and reveals the inline account-pull stepper (key → workspace picker →
 * unattended background pull).
 */

import { hostBridge, type MigrationScanResult } from '@openheaders/core/bridge';
import {
  MIGRATION_TOOL_NAMES,
  MIGRATION_TOOLS,
  type MigrationTool,
  type ToolInstallFinding,
} from '@openheaders/core/import';
import { Alert, Button, Modal, Skeleton, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import DetectionDetailsTable from './migrate/DetectionDetailsTable';
import PostmanPullStepper from './migrate/PostmanPullStepper';
import { VENDOR_GLYPHS } from './migrate/vendor-icons';

const { Text, Paragraph, Title } = Typography;

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

const MigrateToolModal: React.FC<MigrateToolModalProps> = ({ open, onClose, onImportBackupText, onOpenImportHub }) => {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [pullOpen, setPullOpen] = useState(false);
  const [readReason, setReadReason] = useState<string | null>(null);
  const [readingPath, setReadingPath] = useState<string | null>(null);

  // Everything resets on close — the stepper (and with it the API key)
  // unmounts, so nothing outlives the surface (memory-only key, S5).
  useEffect(() => {
    if (open) return;
    setScanning(false);
    setScanError(null);
    setScan(null);
    setPullOpen(false);
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

  const renderVendorRow = (tool: MigrationTool): React.ReactNode => {
    const install = scan?.tools.find((finding) => finding.tool === tool);
    const detected = install?.detected ?? false;
    const Glyph = VENDOR_GLYPHS[tool];
    const displayName = install?.displayName ?? MIGRATION_TOOL_NAMES[tool];
    return (
      <div key={tool} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 }}>
        <Glyph style={{ fontSize: 18 }} />
        <Text strong={detected} style={{ width: 140 }}>
          {displayName}
        </Text>
        {scan !== null && (
          <Text type={detected ? undefined : 'secondary'} style={{ fontSize: 12 }}>
            {detected ? 'Detected' : 'Not found'}
          </Text>
        )}
        <div style={{ flex: 1 }} />
        {tool === 'postman' && (
          <Button size="small" onClick={() => setPullOpen(!pullOpen)}>
            {pullOpen ? 'Cancel' : 'Import'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Modal title="Migrate from another tool" open={open} onCancel={onClose} footer={null} width={1120} destroyOnHidden>
      <Title level={5} style={{ marginTop: 0 }}>
        Migrate from other vendors
      </Title>
      <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
        <Button type="primary" size="large" loading={scanning} onClick={runScan}>
          Detect and import data
        </Button>
        <Paragraph type="secondary" style={{ fontSize: 12, maxWidth: 560, margin: '10px auto 0' }}>
          Detection checks a fixed list of application folders and reads only tool data files (backups and local
          stores). It never opens credential, cookie, or session files, and nothing leaves this computer. Importing
          anything is a separate, explicit step.
        </Paragraph>
        {scanError && (
          <Alert type="error" showIcon message={scanError} style={{ maxWidth: 560, margin: '10px auto 0' }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(pullOpen ? (['postman'] as const) : MIGRATION_TOOLS).map(renderVendorRow)}
      </div>

      {pullOpen && (
        <div style={{ marginTop: 8, paddingLeft: 28 }}>
          <PostmanPullStepper onStarted={onClose} />
        </div>
      )}

      {!pullOpen && (
        <>
          {readReason && <Alert type="error" showIcon message={readReason} style={{ marginTop: 12 }} />}
          {scanning ? (
            <Skeleton active title={false} paragraph={{ rows: 2 }} style={{ marginTop: 16 }} />
          ) : (
            scan !== null && (
              <div style={{ marginTop: 16 }}>
                <DetectionDetailsTable
                  findings={scan.data.findings}
                  skipped={scan.data.skipped}
                  readingPath={readingPath}
                  onImportBackup={importBackup}
                  onOpenImportHub={onOpenImportHub}
                />
              </div>
            )
          )}
        </>
      )}
    </Modal>
  );
};

export default MigrateToolModal;
