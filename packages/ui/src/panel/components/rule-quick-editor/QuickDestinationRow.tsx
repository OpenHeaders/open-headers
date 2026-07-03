/**
 * QuickDestinationRow — the "where will this rule land" row of the
 * quick-create popovers, rendered by the shell just above its footer.
 * Collapsed: "→ <collection> / <folder>" with `· new` tags for parts
 * Save will mint. Expanded (click): compact collection + folder
 * selects — the SaveToCollectionModal's spirit at popover size. Folder
 * choices: the domain-folder heuristic (default), the collection root,
 * or any existing folder (nested folders indented).
 */

import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { ConfigProvider, Select, Tag, theme } from 'antd';
import { useState } from 'react';
import { listFolderOptions, type QuickFolderChoice } from '../../data/rule-create/quick-rule-destination';
import type { QuickCreateDestinationApi } from './use-quick-create-destination';

const AUTO_VALUE = '__auto__';
const ROOT_VALUE = '__root__';

export function QuickDestinationRow({ api }: { api: QuickCreateDestinationApi }) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  const activeTree = api.trees.find((t) => t.uid === api.plan.collection?.uid) ?? null;
  const folderOptions = activeTree ? listFolderOptions(activeTree.tree) : [];

  const folderValue =
    api.override == null || api.override.folder.kind === 'auto'
      ? AUTO_VALUE
      : api.override.folder.kind === 'root'
        ? ROOT_VALUE
        : api.override.folder.path;

  const onCollectionChange = (uid: string) => {
    // Switching collections re-arms the domain heuristic within it.
    api.setOverride({ collectionUid: uid, folder: { kind: 'auto' } });
  };
  const onFolderChange = (value: string) => {
    const folder: QuickFolderChoice =
      value === AUTO_VALUE ? { kind: 'auto' } : value === ROOT_VALUE ? { kind: 'root' } : { kind: 'folder', path: value };
    api.setOverride({ ...(api.override ?? {}), folder });
  };

  const newTag = (
    <Tag style={{ marginInlineStart: 4, marginInlineEnd: 0, fontSize: 9, lineHeight: '14px' }} color="green">
      new
    </Tag>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choose where the rule is saved"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 11,
          color: token.colorTextSecondary,
          minWidth: 0,
        }}
      >
        {open ? <DownOutlined style={{ fontSize: 8 }} /> : <RightOutlined style={{ fontSize: 8 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          Saving to <span style={{ color: token.colorText }}>{api.collectionLabel}</span>
          {api.collectionIsNew && newTag}
          {api.folderLabel && (
            <>
              {' / '}
              <span style={{ color: token.colorText }}>{api.folderLabel}</span>
              {api.folderIsNew && newTag}
            </>
          )}
        </span>
      </button>
      {open && (
        <ConfigProvider theme={{ token: { fontSize: 12 } }}>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <Select
              size="small"
              value={api.plan.collection?.uid}
              placeholder={api.collectionLabel}
              onChange={onCollectionChange}
              options={api.trees.map((t) => ({ value: t.uid, label: t.name }))}
              style={{ flex: 1, minWidth: 0 }}
              dropdownStyle={{ zIndex: 1090 }}
              disabled={api.trees.length === 0}
            />
            <Select
              size="small"
              value={folderValue}
              onChange={onFolderChange}
              options={[
                {
                  value: AUTO_VALUE,
                  label: api.autoFolderName ? `Auto — ${api.autoFolderName}` : 'Auto — collection root',
                },
                { value: ROOT_VALUE, label: 'Collection root' },
                ...folderOptions.map((f) => ({
                  value: f.path,
                  label: `${' '.repeat(f.depth * 2)}${f.name}`,
                })),
              ]}
              style={{ flex: 1, minWidth: 0 }}
              dropdownStyle={{ zIndex: 1090 }}
              disabled={!activeTree}
            />
          </div>
        </ConfigProvider>
      )}
    </div>
  );
}
