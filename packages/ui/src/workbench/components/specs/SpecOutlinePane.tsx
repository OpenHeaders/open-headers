/**
 * SpecOutlinePane — the spec editor's structure rail (vendor parity:
 * Servers / Tags / Paths / Components / Security / Files, left of the
 * code editor).
 *
 * Pure presentation over the derived `SpecOutline` (parse-on-idle
 * result — never stored, never recomputed here) plus the entity's file
 * set for the Files group. Clicking a row hands its character offset
 * to the host, which moves the editor caret; group headers with a
 * source position navigate too.
 */

import type { SpecFile } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Tree, Typography, theme } from 'antd';
import type { TreeDataNode } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { METHOD_COLORS } from '../sidebar/icons';
import type { SpecOutline, SpecOutlineNode } from './spec-outline';

interface SpecOutlinePaneProps {
  outline: SpecOutline | null;
  files: SpecFile[];
  rootFileUid: string;
  onNavigate: (offset: number) => void;
}

/** Group-header keys → their catalog labels. */
const GROUP_LABEL_KEYS: Record<string, MessageKey> = {
  servers: 'workbench.editors.spec.outline.groups.servers',
  tags: 'workbench.editors.spec.outline.groups.tags',
  paths: 'workbench.editors.spec.outline.groups.paths',
  components: 'workbench.editors.spec.outline.groups.components',
  'components:schemas': 'workbench.editors.spec.outline.groups.schemas',
  'components:securitySchemes': 'workbench.editors.spec.outline.groups.securitySchemes',
  security: 'workbench.editors.spec.outline.groups.security',
  files: 'workbench.editors.spec.outline.groups.files',
};

const GROUP_KEYS = Object.keys(GROUP_LABEL_KEYS);

function groupTitle(key: string, count: number | null, t: Translate): React.ReactNode {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
      {t(GROUP_LABEL_KEYS[key])}
      {count !== null && count > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>
          {count}
        </Typography.Text>
      )}
    </span>
  );
}

function entryTitle(node: SpecOutlineNode): React.ReactNode {
  if (node.kind === 'operation' && node.method !== undefined) {
    const color = METHOD_COLORS[node.method] ?? 'var(--ant-color-text, #1a1a1a)';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 11, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, fontFamily: "'SF Mono', monospace", flexShrink: 0 }}>
          {node.method}
        </span>
        {node.label !== node.method && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
        )}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {node.label}
    </span>
  );
}

const SpecOutlinePane: React.FC<SpecOutlinePaneProps> = ({ outline, files, rootFileUid, onNavigate }) => {
  const { token } = theme.useToken();
  const t = useT();

  // Tree data + the key → offset map the click handler resolves
  // against, built in one walk per outline recompute.
  const { treeData, offsets } = useMemo(() => {
    const offsetByKey = new Map<string, number>();
    const toDataNode = (node: SpecOutlineNode): TreeDataNode => {
      if (node.offset !== null) offsetByKey.set(node.key, node.offset);
      // Groups whose children are themselves groups (components) show
      // no count — the subgroup rows carry the real numbers.
      const count = node.children.some((child) => child.kind === 'group') ? null : node.children.length;
      return {
        key: node.key,
        title: node.kind === 'group' ? groupTitle(node.key, count, t) : entryTitle(node),
        children: node.children.map(toDataNode),
      };
    };

    const data: TreeDataNode[] = [];
    if (outline !== null) {
      data.push(
        toDataNode(outline.servers),
        toDataNode(outline.tags),
        toDataNode(outline.paths),
        toDataNode(outline.components),
        toDataNode(outline.security),
      );
    }
    data.push({
      key: 'files',
      title: groupTitle('files', files.length, t),
      children: files.map((file) => {
        // The single v1 root file IS the open buffer — navigating to
        // its top is the honest "select this file" until multi-file.
        offsetByKey.set(`file:${file.uid}`, 0);
        return {
          key: `file:${file.uid}`,
          title: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</span>
              {file.uid === rootFileUid && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    padding: '0 4px',
                    borderRadius: 3,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    color: token.colorTextTertiary,
                    flexShrink: 0,
                  }}
                >
                  {t('workbench.editors.spec.outline.rootBadge')}
                </span>
              )}
            </span>
          ),
          children: [],
        };
      }),
    });
    return { treeData: data, offsets: offsetByKey };
  }, [outline, files, rootFileUid, t, token]);

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: token.colorBgContainer }}
      data-testid="spec-outline-pane"
    >
      <div
        style={{
          padding: '6px 12px 4px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: token.colorTextTertiary,
          flexShrink: 0,
        }}
      >
        {t('workbench.editors.spec.outline.title')}
      </div>
      {outline === null ? (
        <Typography.Text type="secondary" style={{ fontSize: 11, padding: '4px 12px' }}>
          {t('workbench.editors.spec.outline.empty')}
        </Typography.Text>
      ) : (
        <div className="rules-thin-scrollbar" style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: '0 4px 8px' }}>
          <Tree
            blockNode
            defaultExpandedKeys={GROUP_KEYS}
            selectedKeys={[]}
            treeData={treeData}
            onSelect={(_keys, info) => {
              const offset = offsets.get(String(info.node.key));
              if (offset !== undefined) onNavigate(offset);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SpecOutlinePane;
