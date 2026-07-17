/**
 * MigrateToolModal — the desktop migration entry surface, one wide
 * modal (S14 UI law: never modal-over-modal; sections collapse/expand
 * and every step renders inline).
 *
 * Two equal entry paths sit side by side as centered hero buttons:
 * "Scan this computer" (consent click 1: the fixed-allowlist detect+scan
 * — tool data files only, never credentials) and "Import from Postman
 * account" (the remote pull, which needs no local detection). Vendor
 * rows render as a centered column with a brand mark and, after
 * detection, status only; backup dates, counts, guided walkthroughs,
 * and skipped stores live in the compact details table below.
 *
 * The account import collapses everything else and reveals the inline
 * pull stepper (key → workspace picker → unattended background pull).
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
import { useT } from '@openheaders/ui/context/LocaleContext';
import DetectionDetailsTable from './migrate/DetectionDetailsTable';
import PostmanPullStepper from './migrate/PostmanPullStepper';
import { VENDOR_GLYPHS } from './migrate/vendor-icons';

const { Text, Paragraph } = Typography;

interface MigrateToolModalProps {
  open: boolean;
  onClose: () => void;
  /** Route a scanned store's text (backup JSON or a synthesized export
   *  envelope) into the standard detection → import flow. */
  onImportText: (text: string) => void;
  /** Guided export→drop hand-off for stores we never read directly. */
  onOpenImportHub: () => void;
}

interface ScanState {
  tools: ToolInstallFinding[];
  data: MigrationScanResult;
}

const MigrateToolModal: React.FC<MigrateToolModalProps> = ({ open, onClose, onImportText, onOpenImportHub }) => {
  const t = useT();
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
      .catch(() => setScanError(t('workbench.importExport.migrate.scanFailed')))
      .finally(() => setScanning(false));
  }, [t]);

  const importBackup = useCallback(
    (path: string) => {
      setReadingPath(path);
      setReadReason(null);
      void hostBridge
        .call('oh.migration.readBackup', { path })
        .then((result) => {
          if (result.text !== null) onImportText(result.text);
          else setReadReason(result.reason ?? t('workbench.importExport.migrate.backupReadFailed'));
        })
        .catch(() => setReadReason(t('workbench.importExport.migrate.backupReadFailed')))
        .finally(() => setReadingPath(null));
    },
    [onImportText, t],
  );

  const importInsomniaData = useCallback(
    (dir: string) => {
      setReadingPath(dir);
      setReadReason(null);
      void hostBridge
        .call('oh.migration.readInsomniaData', { dir })
        .then((result) => {
          if (result.text !== null) onImportText(result.text);
          else setReadReason(result.reason ?? t('workbench.importExport.migrate.localReadFailed'));
        })
        .catch(() => setReadReason(t('workbench.importExport.migrate.localReadFailed')))
        .finally(() => setReadingPath(null));
    },
    [onImportText, t],
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
        <Text type={detected ? undefined : 'secondary'} style={{ fontSize: 12, width: 72 }}>
          {scan === null
            ? '–'
            : detected
              ? t('workbench.importExport.migrate.detected')
              : t('workbench.importExport.migrate.notFound')}
        </Text>
        {tool === 'postman' && pullOpen && (
          <Button onClick={() => setPullOpen(false)}>{t('workbench.importExport.migrate.cancel')}</Button>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={t('workbench.importExport.migrate.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1120}
      maskClosable={false}
      destroyOnHidden
    >
      {!pullOpen && (
        <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <Button type="primary" size="large" loading={scanning} onClick={runScan}>
              {t('workbench.importExport.migrate.scanCta')}
            </Button>
            <Button type="primary" size="large" onClick={() => setPullOpen(true)}>
              {t('workbench.importExport.migrate.pullCta')}
            </Button>
          </div>
          <Paragraph type="secondary" style={{ fontSize: 12, maxWidth: 560, margin: '10px auto 0' }}>
            {t('workbench.importExport.migrate.scanNote')}
          </Paragraph>
          {scanError && (
            <Alert type="error" showIcon message={scanError} style={{ maxWidth: 560, margin: '10px auto 0' }} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 'fit-content', margin: '0 auto' }}>
        {(pullOpen ? (['postman'] as const) : MIGRATION_TOOLS).map(renderVendorRow)}
      </div>

      {pullOpen && (
        <div style={{ maxWidth: 840, margin: '8px auto 0' }}>
          <PostmanPullStepper onStarted={onClose} />
        </div>
      )}

      {!pullOpen && (
        <>
          {readReason && <Alert type="error" showIcon message={readReason} style={{ marginTop: 12 }} />}
          {scanning ? (
            <Skeleton active title={false} paragraph={{ rows: 2 }} style={{ marginTop: 16 }} />
          ) : (
            <div style={{ marginTop: 16 }}>
              <DetectionDetailsTable
                scanned={scan !== null}
                findings={scan?.data.findings ?? []}
                skipped={scan?.data.skipped ?? []}
                readingPath={readingPath}
                onImportBackup={importBackup}
                onImportInsomniaData={importInsomniaData}
                onOpenImportHub={onOpenImportHub}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default MigrateToolModal;
