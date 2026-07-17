/**
 * FilesBrowserField — Phase 12.4b inline file browser.
 *
 * Lists every blob in the active workspace with filename / size /
 * mime / short hash + per-row download, rename, and delete actions.
 * Uses the shared `useFiles` hook so inserts / deletes / renames from
 * any surface (Upload File action, multipart editor's inline Upload
 * button, sibling tabs) show up live without reload.
 *
 * Downloads fetch bytes through the `getFile` bridge RPC (base64
 * transport → Blob reconstruction in the hook). Deletes route through
 * the SW `deleteFile` RPC so the lock discipline is honoured. Rename
 * is an inline editable cell that fires `useFiles.renameFile`, which
 * routes through the SW `renameFile` RPC — durable BlobStore update
 * first, catalog mutation through the oracle second (mirrors the
 * put / delete two-step pattern).
 */

import { DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { useFiles } from '@openheaders/ui/shared/hooks/readers/useFiles';
import { App, Button, Empty, Popconfirm, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ResolvedSettingDef } from '../types';
import FieldRow from './FieldRow';

const { Text } = Typography;

interface FilesBrowserFieldProps {
  def: ResolvedSettingDef;
}

interface Row {
  key: string;
  fileId: string;
  filename: string;
  size: number;
  mimeType?: string;
  hash: string;
}

const FilesBrowserField: React.FC<FilesBrowserFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { files, isReady, deleteFile, renameFile, readFile } = useFiles();
  const { message } = App.useApp();

  const handleRename = useCallback(
    async (fileId: string, current: string, next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === current) return;
      const result = await renameFile(fileId, trimmed);
      if (result.ok) return;
      if (result.reason === 'not-found') {
        message.error(t('workbench.settings.fields.files.renameMissing'));
        return;
      }
      message.error(
        result.message
          ? t('workbench.settings.fields.files.renameFailedReason', { message: result.message })
          : t('workbench.settings.fields.files.renameFailed'),
      );
    },
    [renameFile, message, t],
  );

  const rows = useMemo<Row[]>(
    () =>
      files.map((f) => ({
        key: f.fileId,
        fileId: f.fileId,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        hash: f.hash,
      })),
    [files],
  );

  const handleDownload = async (row: Row) => {
    const result = await readFile(row.fileId);
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnsType<Row> = [
    {
      title: t('workbench.settings.fields.files.colFilename'),
      dataIndex: 'filename',
      key: 'filename',
      render: (name: string, row: Row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <FileOutlined />
          <Text
            editable={{
              tooltip: t('workbench.settings.fields.files.renameTooltip'),
              onChange: (next) => void handleRename(row.fileId, name, next),
              autoSize: { minRows: 1, maxRows: 1 },
              triggerType: ['icon', 'text'],
            }}
            style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, margin: 0 }}
          >
            {name}
          </Text>
        </span>
      ),
    },
    {
      title: t('workbench.settings.fields.files.colSize'),
      dataIndex: 'size',
      key: 'size',
      width: 110,
      render: (n: number) => <Text type="secondary">{formatBytes(n)}</Text>,
    },
    {
      title: t('workbench.settings.fields.files.colMime'),
      dataIndex: 'mimeType',
      key: 'mimeType',
      width: 160,
      render: (m: string | undefined) =>
        m ? <code style={{ fontSize: 11 }}>{m}</code> : <Text type="secondary">—</Text>,
    },
    {
      title: t('workbench.settings.fields.files.colHash'),
      dataIndex: 'hash',
      key: 'hash',
      width: 140,
      render: (hash: string) => (
        <Tooltip title={hash}>
          <code style={{ fontSize: 11 }}>{hash.slice(0, 22)}…</code>
        </Tooltip>
      ),
    },
    {
      title: t('workbench.settings.fields.files.colActions'),
      key: 'actions',
      width: 140,
      render: (_: unknown, row: Row) => (
        <Space size={4}>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => void handleDownload(row)}>
            {t('workbench.settings.fields.files.download')}
          </Button>
          <Popconfirm
            title={t('workbench.settings.fields.files.deleteTitle', { filename: row.filename })}
            description={t('workbench.settings.fields.files.deleteWarning')}
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              void deleteFile(row.fileId);
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      resettable={false}
      block
    >
      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: 6,
          background: token.colorBgContainer,
        }}
      >
        {rows.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              !isReady ? (
                <Text type="secondary">{t('workbench.settings.fields.files.loading')}</Text>
              ) : (
                <Text type="secondary">{t('workbench.settings.fields.files.empty')}</Text>
              )
            }
          />
        ) : (
          <Table<Row> size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ y: 360 }} />
        )}
      </div>
    </FieldRow>
  );
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default FilesBrowserField;
