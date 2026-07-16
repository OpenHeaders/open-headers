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
 *
 * Add affordances (S6, YAML roots only): hover "+" on insertable group
 * headers and path rows (affordance-visibility rules — hover on
 * chrome), plus an inline "Add …" row inside empty groups (vendor
 * evidence: "No servers defined. Add"). Both hand a `SpecInsertTarget`
 * to the host, which splices the snippet into the Monaco buffer.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { SpecFile } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Tooltip, Tree, Typography, theme } from 'antd';
import type { TreeDataNode } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { METHOD_COLORS } from '../sidebar/icons';
import type { SpecInsertTarget } from './spec-outline-insert';
import type { SpecOutline, SpecOutlineNode } from './spec-outline';

interface SpecOutlinePaneProps {
  outline: SpecOutline | null;
  files: SpecFile[];
  rootFileUid: string;
  onNavigate: (offset: number) => void;
  /** False hides every Add affordance — non-YAML roots (S6: YAML-only). */
  canInsert: boolean;
  onInsert: (target: SpecInsertTarget) => void;
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

/** Insertable group headers → their target + Add label. Components and
 *  Files carry no affordance (subgroups / entity data). */
const GROUP_INSERTS: Record<string, { target: SpecInsertTarget; label: MessageKey }> = {
  servers: { target: { kind: 'server' }, label: 'workbench.editors.spec.outline.add.server' },
  tags: { target: { kind: 'tag' }, label: 'workbench.editors.spec.outline.add.tag' },
  paths: { target: { kind: 'path' }, label: 'workbench.editors.spec.outline.add.path' },
  'components:schemas': { target: { kind: 'schema' }, label: 'workbench.editors.spec.outline.add.schema' },
  'components:securitySchemes': {
    target: { kind: 'securityScheme' },
    label: 'workbench.editors.spec.outline.add.securityScheme',
  },
  security: {
    target: { kind: 'securityRequirement' },
    label: 'workbench.editors.spec.outline.add.securityRequirement',
  },
};

interface AffordanceWiring {
  canInsert: boolean;
  onInsert: (target: SpecInsertTarget) => void;
  t: Translate;
}

function addButton(target: SpecInsertTarget, label: string, wiring: AffordanceWiring): React.ReactNode {
  return (
    <Tooltip title={label} placement="right">
      <button
        type="button"
        className="oh-spec-outline-add"
        aria-label={label}
        onClick={(e) => {
          // The row beneath navigates — adding must not also jump.
          e.stopPropagation();
          wiring.onInsert(target);
        }}
      >
        <PlusOutlined style={{ fontSize: 10 }} />
      </button>
    </Tooltip>
  );
}

function groupTitle(key: string, count: number | null, wiring: AffordanceWiring): React.ReactNode {
  const insert = wiring.canInsert ? GROUP_INSERTS[key] : undefined;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, width: '100%' }}>
      {wiring.t(GROUP_LABEL_KEYS[key])}
      {count !== null && count > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>
          {count}
        </Typography.Text>
      )}
      {insert !== undefined && addButton(insert.target, wiring.t(insert.label), wiring)}
    </span>
  );
}

function entryTitle(node: SpecOutlineNode, wiring: AffordanceWiring): React.ReactNode {
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
      {node.kind === 'path' &&
        wiring.canInsert &&
        addButton(
          { kind: 'operation', pathKey: node.label },
          wiring.t('workbench.editors.spec.outline.add.operation'),
          wiring,
        )}
    </span>
  );
}

/** Muted inline "Add …" row inside an empty insertable group. */
function emptyAddNode(groupKey: string, wiring: AffordanceWiring): TreeDataNode | null {
  const insert = GROUP_INSERTS[groupKey];
  if (insert === undefined) return null;
  return {
    key: `add:${groupKey}`,
    selectable: false,
    title: (
      <span
        role="button"
        tabIndex={0}
        className="oh-spec-outline-empty-add"
        onClick={() => wiring.onInsert(insert.target)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            wiring.onInsert(insert.target);
          }
        }}
      >
        <PlusOutlined style={{ fontSize: 9 }} />
        {wiring.t(insert.label)}
      </span>
    ),
    children: [],
  };
}

const SpecOutlinePane: React.FC<SpecOutlinePaneProps> = ({
  outline,
  files,
  rootFileUid,
  onNavigate,
  canInsert,
  onInsert,
}) => {
  const { token } = theme.useToken();
  const t = useT();

  // Tree data + the key → offset map the click handler resolves
  // against, built in one walk per outline recompute.
  const { treeData, offsets } = useMemo(() => {
    const wiring: AffordanceWiring = { canInsert, onInsert, t };
    const offsetByKey = new Map<string, number>();
    const toDataNode = (node: SpecOutlineNode): TreeDataNode => {
      if (node.offset !== null) offsetByKey.set(node.key, node.offset);
      // Groups whose children are themselves groups (components) show
      // no count — the subgroup rows carry the real numbers.
      const count = node.children.some((child) => child.kind === 'group') ? null : node.children.length;
      const children = node.children.map(toDataNode);
      if (node.kind === 'group' && count === 0 && wiring.canInsert) {
        const addRow = emptyAddNode(node.key, wiring);
        if (addRow !== null) children.push(addRow);
      }
      return {
        key: node.key,
        title: node.kind === 'group' ? groupTitle(node.key, count, wiring) : entryTitle(node, wiring),
        children,
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
      title: groupTitle('files', files.length, wiring),
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
  }, [outline, files, rootFileUid, t, token, canInsert, onInsert]);

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
        <div
          className="rules-thin-scrollbar oh-spec-outline-tree"
          style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: '0 4px 8px' }}
        >
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
