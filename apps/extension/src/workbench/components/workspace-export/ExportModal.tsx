/**
 * ExportModal — emit a workspace-export envelope as YAML.
 *
 * PR 1B scope (per docs/V5_WORKSPACE_EXPORT_DESIGN.md §6 and
 * docs/V5_WORKSPACE_EXPORT_STATUS.md):
 *   - Destinations: download file, copy to clipboard.
 *   - Vault: omitted (only mode supported until PR 4).
 *   - Scope: 'workspace' (whole workspace) or 'selection' (one rule).
 *   - No deep-link destination (PR 3), no encryption UI (PR 4),
 *     no Advanced overrides (PR 5).
 *
 * Filename: `<workspace-slug>-<scope>.openheaders.yaml` per design §6.2.
 * The double-extension is intentional — `.yaml` keeps editors syntax-
 * highlighted, `.openheaders` makes the file recognizable to humans
 * and to the importer's drag-drop handler.
 */

import { CopyOutlined, DownloadOutlined, InfoCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { slugify } from '@openheaders/core/utils';
import { DeepLinkPayloadTooLargeError, encodeWorkspaceExportDeepLink } from '@openheaders/core/workspace-export';
import { IMPORT_INLINE_PAYLOAD_MAX_BYTES, intentToHash } from '@openheaders/core/workspace-intent';
import { App as AntApp, Button, Modal, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { call } from '@/utils/bridge';

/**
 * Hosted entry point that redirects into the extension's workspace tab.
 * Recipients without the extension installed land on the page's
 * "install OpenHeaders" prompt; recipients with the extension installed
 * are redirected via `chrome-extension://<id>/workbench.html#/import/...`
 * so the workspace router picks the inline payload off the URL hash.
 */
const HOSTED_IMPORT_URL = 'https://workspace.openheaders.io/import';

const { Text, Paragraph } = Typography;

export type ExportModalScope = { kind: 'workspace' } | { kind: 'selection-rule'; ruleUid: string; ruleName: string };

interface ExportModalProps {
  open: boolean;
  /** Source workspace (defaults to active when omitted at the SW). */
  workspaceId?: string;
  workspaceName: string;
  scope: ExportModalScope;
  onCancel: () => void;
}

function buildFilename(workspaceName: string, scope: ExportModalScope): string {
  const slug = slugify(workspaceName) || 'workspace';
  const suffix = scope.kind === 'workspace' ? 'workspace' : `rule-${slugify(scope.ruleName) || 'untitled'}`;
  return `${slug}-${suffix}.openheaders.yaml`;
}

function downloadYaml(filename: string, yaml: string): void {
  const blob = new Blob([yaml], { type: 'application/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Defer revoke so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

const ExportModal: React.FC<ExportModalProps> = ({ open, workspaceId, workspaceName, scope, onCancel }) => {
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);

  const filename = buildFilename(workspaceName, scope);

  const fetchYaml = useCallback(async (): Promise<string | null> => {
    const swScope =
      scope.kind === 'workspace'
        ? { kind: 'workspace' as const }
        : { kind: 'selection-rule' as const, ruleUid: scope.ruleUid };
    const resp = await call('exportWorkspace', { workspaceId, scope: swScope });
    if (!resp?.success || !resp.yaml) {
      message.error(resp?.error ?? 'Export failed');
      return null;
    }
    return resp.yaml;
  }, [scope, workspaceId, message]);

  const onDownload = useCallback(async () => {
    setBusy(true);
    try {
      const yaml = await fetchYaml();
      if (!yaml) return;
      downloadYaml(filename, yaml);
      message.success(`Exported ${filename}`);
      onCancel();
    } finally {
      setBusy(false);
    }
  }, [fetchYaml, filename, message, onCancel]);

  const onCopyDeepLink = useCallback(async () => {
    setBusy(true);
    try {
      const yaml = await fetchYaml();
      if (!yaml) return;
      try {
        const payload = await encodeWorkspaceExportDeepLink(yaml, {
          maxCompressedBytes: IMPORT_INLINE_PAYLOAD_MAX_BYTES,
        });
        const hash = intentToHash({ kind: 'open-import', payload });
        const url = `${HOSTED_IMPORT_URL}${hash}`;
        await navigator.clipboard.writeText(url);
        message.success('Copied deep link to clipboard');
        onCancel();
      } catch (err) {
        if (err instanceof DeepLinkPayloadTooLargeError) {
          message.warning('This export is too large for a deep link — falling back to a downloaded file.');
          downloadYaml(filename, yaml);
          onCancel();
          return;
        }
        message.error(err instanceof Error ? err.message : 'Could not build deep link');
      }
    } finally {
      setBusy(false);
    }
  }, [fetchYaml, filename, message, onCancel]);

  const onCopy = useCallback(async () => {
    setBusy(true);
    try {
      const yaml = await fetchYaml();
      if (!yaml) return;
      await navigator.clipboard.writeText(yaml);
      message.success('Copied YAML to clipboard');
      onCancel();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not copy to clipboard');
    } finally {
      setBusy(false);
    }
  }, [fetchYaml, message, onCancel]);

  const scopeLabel =
    scope.kind === 'workspace' ? (
      <Tag color="blue">Whole workspace</Tag>
    ) : (
      <Tag color="purple">Single rule — {scope.ruleName}</Tag>
    );

  return (
    <Modal
      title="Export"
      open={open}
      onCancel={onCancel}
      destroyOnClose
      width={560}
      footer={
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button icon={<LinkOutlined />} onClick={onCopyDeepLink} loading={busy}>
            Copy deep link
          </Button>
          <Button icon={<CopyOutlined />} onClick={onCopy} loading={busy}>
            Copy YAML
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload} loading={busy}>
            Download
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>Source: </Text>
            <Text>{workspaceName}</Text>
          </Paragraph>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>Scope: </Text>
            {scopeLabel}
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            <Text strong>Filename: </Text>
            <Text code>{filename}</Text>
          </Paragraph>
        </div>

        <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          <InfoCircleOutlined style={{ marginRight: 6 }} />
          Vault secrets and OAuth client secrets are <Text strong>omitted</Text>. Encryption + plaintext include modes
          arrive in a future update. The recipient will need to provide their own credentials at first auth.
        </Paragraph>
      </Space>
    </Modal>
  );
};

export default ExportModal;
