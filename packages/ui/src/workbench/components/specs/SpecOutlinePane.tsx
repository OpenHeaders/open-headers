/**
 * SpecOutlinePane — the spec editor's structure rail (vendor parity:
 * Servers / Tags / Paths / Components / Security / Files for OpenAPI,
 * Package / Imports / Services / Messages / Enums / Files for
 * Protobuf, Servers / Channels / Operations / Messages / Components /
 * Files for AsyncAPI; left of the code editor).
 *
 * Pure presentation over the derived outline groups (parse-on-idle
 * result — never stored, never recomputed here) plus the entity's file
 * set for the Files group. Clicking a row hands its character offset
 * to the host, which moves the editor caret; group headers with a
 * source position navigate too. Rpc rows render a call-shape glyph
 * from their streaming metadata; AsyncAPI operation rows a direction
 * glyph from their action, server rows a protocol chip.
 *
 * Add affordances (S6, YAML roots only): hover "+" on insertable group
 * headers and path rows (affordance-visibility rules — hover on
 * chrome), plus an inline "Add …" row inside empty groups (vendor
 * evidence: "No servers defined. Add"). Both hand a `SpecInsertTarget`
 * to the host, which splices the snippet into the Monaco buffer.
 */

import {
  BorderLeftOutlined,
  CaretRightOutlined,
  KeyOutlined,
  MailOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PartitionOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { AsyncApiOperationAction } from '@openheaders/core/asyncapi';
import type { ProtoStreamingShape } from '@openheaders/core/proto';
import type { SpecFile } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Dropdown, Skeleton, Tooltip, Tree, Typography, theme } from 'antd';
import type { MenuProps, TreeDataNode } from 'antd';
import type { AntTreeNodeProps } from 'antd/es/tree';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { METHOD_COLORS } from '../sidebar/icons';
import type { SpecInsertTarget } from './spec-outline-insert';
import type { SpecOutlineNode } from './spec-outline';

interface SpecOutlinePaneProps {
  /** Derived outline groups (format-dispatched); null before the
   *  buffer has ever parsed. */
  groups: SpecOutlineNode[] | null;
  /** True while the document is still loading — no analysis has run
   *  yet. Distinguishes the skeleton from "parses to nothing". */
  loading: boolean;
  files: SpecFile[];
  rootFileUid: string;
  /** `end` bounds the editor's section highlight; absent → own line only. */
  onNavigate: (offset: number, end?: number) => void;
  /** False hides every Add affordance — non-YAML roots (S6: YAML-only). */
  canInsert: boolean;
  onInsert: (target: SpecInsertTarget) => void;
  /** Header − button — the host closes the rail (reopens from the
   *  editor header's outline toggle). */
  onHide: () => void;
  /** File-row ⋯ menu actions (dock-panel parity). Renames write the
   *  SAVED file row — a dirty buffer is never involved. */
  onRenameFile: (fileUid: string, fileName: string) => void;
  onMakeRootFile: (fileUid: string) => void;
  onDeleteFile: (fileUid: string) => void;
}

/** Group-header keys → their catalog labels. */
const GROUP_LABEL_KEYS: Record<string, MessageKey> = {
  servers: 'workbench.editors.spec.outline.groups.servers',
  tags: 'workbench.editors.spec.outline.groups.tags',
  paths: 'workbench.editors.spec.outline.groups.paths',
  components: 'workbench.editors.spec.outline.groups.components',
  'components:schemas': 'workbench.editors.spec.outline.groups.schemas',
  'components:securitySchemes': 'workbench.editors.spec.outline.groups.securitySchemes',
  'components:messages': 'workbench.editors.spec.outline.groups.messages',
  security: 'workbench.editors.spec.outline.groups.security',
  package: 'workbench.editors.spec.outline.groups.package',
  imports: 'workbench.editors.spec.outline.groups.imports',
  services: 'workbench.editors.spec.outline.groups.services',
  messages: 'workbench.editors.spec.outline.groups.messages',
  enums: 'workbench.editors.spec.outline.groups.enums',
  channels: 'workbench.editors.spec.outline.groups.channels',
  operations: 'workbench.editors.spec.outline.groups.operations',
  files: 'workbench.editors.spec.outline.groups.files',
};

/** Call-shape glyph per streaming shape (rpc rows). */
const STREAMING_GLYPHS: Record<ProtoStreamingShape, string> = {
  unary: '→',
  'server-streaming': '⇊',
  'client-streaming': '⇈',
  'bidi-streaming': '⇅',
};

const STREAMING_LABEL_KEYS: Record<ProtoStreamingShape, MessageKey> = {
  unary: 'workbench.editors.spec.outline.streaming.unary',
  'server-streaming': 'workbench.editors.spec.outline.streaming.server',
  'client-streaming': 'workbench.editors.spec.outline.streaming.client',
  'bidi-streaming': 'workbench.editors.spec.outline.streaming.bidi',
};

/** Direction glyph per AsyncAPI operation action. */
const ACTION_GLYPHS: Record<AsyncApiOperationAction, string> = {
  send: '↑',
  receive: '↓',
};

const ACTION_LABEL_KEYS: Record<AsyncApiOperationAction, MessageKey> = {
  send: 'workbench.editors.spec.outline.action.send',
  receive: 'workbench.editors.spec.outline.action.receive',
};

/** Groups open on a fresh tab — Components (its subgroup rows are the
 *  real content) and Files; every other section starts collapsed. */
const DEFAULT_EXPANDED_KEYS = ['components', 'files'];

/** Nested group-header prefix icons — root groups render as dock-style
 *  section headers (uppercase micro-caps, no icon) instead. */
const GROUP_ICONS: Record<string, React.ReactNode> = {
  'components:schemas': <PartitionOutlined />,
  'components:securitySchemes': <KeyOutlined />,
  'components:messages': <MailOutlined />,
};

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

function groupTitle(key: string, count: number | null, wiring: AffordanceWiring, root = false): React.ReactNode {
  const insert = wiring.canInsert ? GROUP_INSERTS[key] : undefined;
  // Root groups echo the dock panel's section headers (RULES /
  // TEMPLATES / …): uppercase micro-caps, secondary color, no icon.
  const rootStyle: React.CSSProperties = root
    ? {
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: 'var(--ant-color-text-secondary, #666)',
      }
    : { fontSize: 12 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', ...rootStyle }}>
      {!root && GROUP_ICONS[key] !== undefined && (
        <span style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary, #999)', flexShrink: 0, display: 'inline-flex' }}>
          {GROUP_ICONS[key]}
        </span>
      )}
      {wiring.t(GROUP_LABEL_KEYS[key])}
      {count !== null && count > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 10, fontWeight: 400, letterSpacing: 'normal' }}>
          {count}
        </Typography.Text>
      )}
      {insert !== undefined && addButton(insert.target, wiring.t(insert.label), wiring)}
    </span>
  );
}

function entryTitle(node: SpecOutlineNode, wiring: AffordanceWiring): React.ReactNode {
  if (node.kind === 'rpc' && node.streaming !== undefined) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 12, minWidth: 0 }}>
        <Tooltip title={wiring.t(STREAMING_LABEL_KEYS[node.streaming])} placement="right">
          <span
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'SF Mono', monospace", flexShrink: 0 }}
            data-testid={`spec-outline-rpc-${node.streaming}`}
          >
            {STREAMING_GLYPHS[node.streaming]}
          </span>
        </Tooltip>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
      </span>
    );
  }
  if (node.kind === 'operation' && node.action !== undefined) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 12, minWidth: 0 }}>
        <Tooltip title={wiring.t(ACTION_LABEL_KEYS[node.action])} placement="right">
          <span
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'SF Mono', monospace", flexShrink: 0 }}
            data-testid={`spec-outline-op-${node.action}`}
          >
            {ACTION_GLYPHS[node.action]}
          </span>
        </Tooltip>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
      </span>
    );
  }
  if (node.kind === 'server' && node.protocol !== undefined) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 0.5,
            padding: '0 4px',
            borderRadius: 3,
            border: '1px solid var(--ant-color-border-secondary, #eee)',
            color: 'var(--ant-color-text-tertiary, #999)',
            flexShrink: 0,
          }}
          data-testid={`spec-outline-server-protocol-${node.protocol}`}
        >
          {node.protocol.toUpperCase()}
        </span>
      </span>
    );
  }
  if (node.kind === 'operation' && node.method !== undefined) {
    const color = METHOD_COLORS[node.method] ?? 'var(--ant-color-text, #1a1a1a)';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 12, minWidth: 0 }}>
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
        fontSize: 12,
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

/** Inline rename input for a file row — the dock tree's rename idiom
 *  (autofocus + select, Enter commits, Escape cancels, blur commits). */
function FileRenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    onCancel();
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      className="rules-sidebar-rename-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') cancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
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
  groups,
  loading,
  files,
  rootFileUid,
  onNavigate,
  canInsert,
  onInsert,
  onHide,
  onRenameFile,
  onMakeRootFile,
  onDeleteFile,
}) => {
  const { token } = theme.useToken();
  const t = useT();

  // The clicked row stays marked (vendor parity) — the keys are stable
  // path-derived strings, so the mark survives outline recomputes.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Controlled expansion so the header's expand/collapse-all actions
  // (dock-panel parity) can drive the whole tree at once.
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(DEFAULT_EXPANDED_KEYS);

  // File row currently renaming inline (⋯ → Rename).
  const [renamingFileUid, setRenamingFileUid] = useState<string | null>(null);

  // Tree data + the key → source-span map the click handler resolves
  // against + every expandable key (expand-all's target set), built in
  // one walk per outline recompute.
  const { treeData, spans, expandableKeys } = useMemo(() => {
    const wiring: AffordanceWiring = { canInsert, onInsert, t };
    const spanByKey = new Map<string, { offset: number; end?: number }>();
    const parentKeys: React.Key[] = [];
    const toDataNode = (node: SpecOutlineNode, depth: number): TreeDataNode => {
      if (node.offset !== null) {
        spanByKey.set(node.key, { offset: node.offset, ...(node.end !== undefined ? { end: node.end } : {}) });
      }
      // Groups whose children are themselves groups (components) show
      // no count — the subgroup rows carry the real numbers.
      const count = node.children.some((child) => child.kind === 'group') ? null : node.children.length;
      const children = node.children.map((child) => toDataNode(child, depth + 1));
      if (node.kind === 'group' && count === 0 && wiring.canInsert) {
        const addRow = emptyAddNode(node.key, wiring);
        if (addRow !== null) children.push(addRow);
      }
      const isRootGroup = node.kind === 'group' && depth === 0;
      if (children.length > 0) parentKeys.push(node.key);
      return {
        key: node.key,
        ...(isRootGroup ? { className: 'oh-spec-outline-root' } : {}),
        title: node.kind === 'group' ? groupTitle(node.key, count, wiring, isRootGroup) : entryTitle(node, wiring),
        children,
      };
    };

    const data: TreeDataNode[] = [];
    if (groups !== null) {
      data.push(...groups.map((group) => toDataNode(group, 0)));
    }
    if (files.length > 0) parentKeys.push('files');
    data.push({
      key: 'files',
      className: 'oh-spec-outline-root',
      title: groupTitle('files', files.length, wiring, true),
      children: files.map((file) => {
        // The single v1 root file IS the open buffer — navigating to
        // its top is the honest "select this file" until multi-file.
        spanByKey.set(`file:${file.uid}`, { offset: 0 });
        // ⋯ menu (dock-row parity, vendor shape): Rename on every
        // file; Mark-as-root + Delete only on non-root files.
        const fileMenuItems: MenuProps['items'] = [
          {
            key: 'rename',
            label: t('workbench.sidebar.menu.rename'),
            onClick: () => setRenamingFileUid(file.uid),
          },
          ...(file.uid !== rootFileUid
            ? [
                {
                  key: 'make-root',
                  label: t('workbench.editors.spec.outline.makeRoot'),
                  onClick: () => onMakeRootFile(file.uid),
                },
                {
                  key: 'delete',
                  label: t('workbench.sidebar.menu.delete'),
                  danger: true,
                  onClick: () => onDeleteFile(file.uid),
                },
              ]
            : []),
        ];
        if (renamingFileUid === file.uid) {
          return {
            key: `file:${file.uid}`,
            selectable: false,
            title: (
              <FileRenameInput
                value={file.fileName}
                onCommit={(name) => onRenameFile(file.uid, name)}
                onCancel={() => setRenamingFileUid(null)}
              />
            ),
            children: [],
          };
        }
        return {
          key: `file:${file.uid}`,
          title: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, width: '100%', minWidth: 0 }}>
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
              <Dropdown menu={{ items: fileMenuItems }} trigger={['click']} placement="bottomRight">
                <button
                  type="button"
                  className="oh-spec-outline-add"
                  aria-label={t('workbench.editors.spec.outline.fileMenuAria')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreOutlined style={{ fontSize: 12 }} />
                </button>
              </Dropdown>
            </span>
          ),
          children: [],
        };
      }),
    });
    return { treeData: data, spans: spanByKey, expandableKeys: parentKeys };
  }, [groups, files, rootFileUid, t, token, canInsert, onInsert, renamingFileUid, onRenameFile, onMakeRootFile, onDeleteFile]);

  const expandAll = () => setExpandedKeys(expandableKeys);
  const collapseAll = () => setExpandedKeys([]);

  const headerActions = (
    <>
      <Tooltip title={t('workbench.sidebar.header.expandAll')} placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={expandAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') expandAll();
          }}
          aria-label={t('workbench.sidebar.header.expandAllAria')}
        >
          <MenuUnfoldOutlined />
        </span>
      </Tooltip>
      <Tooltip title={t('workbench.sidebar.header.collapseAll')} placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={collapseAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') collapseAll();
          }}
          aria-label={t('workbench.sidebar.header.collapseAllAria')}
        >
          <BorderLeftOutlined />
        </span>
      </Tooltip>
    </>
  );

  return (
    <div
      className="oh-spec-outline-pane"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: token.colorBgContainer }}
      data-testid="spec-outline-pane"
    >
      <PanelHeader
        wiring={createPanelHeaderWiring({ onHide })}
        title={t('workbench.editors.spec.outline.title')}
        actions={headerActions}
        optionsMenuItems={[
          { key: 'expand-all', label: t('workbench.sidebar.header.expandAll'), onClick: expandAll },
          { key: 'collapse-all', label: t('workbench.sidebar.header.collapseAll'), onClick: collapseAll },
        ]}
      />
      {groups === null ? (
        loading ? (
          <Skeleton
            active
            title={false}
            paragraph={{ rows: 6, width: ['60%', '40%', '55%', '45%', '65%', '40%'] }}
            style={{ padding: '12px 16px' }}
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 11, padding: '4px 12px' }}>
            {t('workbench.editors.spec.outline.empty')}
          </Typography.Text>
        )
      ) : (
        <div
          className="rules-thin-scrollbar oh-spec-outline-tree"
          style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: '0 4px 8px' }}
        >
          <Tree
            blockNode
            // Dock-section behavior: expand/collapse toggles instantly.
            // An empty motion config suppresses antd's collapse
            // animation (CSSMotion is inert without a motionName) —
            // which also rules out its end-of-motion height snap.
            motion={{}}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            switcherIcon={(props: AntTreeNodeProps) => {
              // Root section rows carry the dock section headers' solid
              // text-glyph caret (SectionHeader); nested rows the dock
              // tree rows' outlined icon (TreeNodeRow). Root keys are
              // the bare group names — every nested key is path-qualified
              // with ':'.
              if (!String(props.eventKey ?? '').includes(':')) {
                return (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 10,
                      transition: 'transform 0.2s ease',
                      transform: props.expanded === true ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  >
                    &#9654;
                  </span>
                );
              }
              return <CaretRightOutlined />;
            }}
            selectedKeys={selectedKey !== null ? [selectedKey] : []}
            treeData={treeData}
            onSelect={(_keys, info) => {
              const key = String(info.node.key);
              const span = spans.get(key);
              if (span === undefined) return;
              setSelectedKey(key);
              onNavigate(span.offset, span.end);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SpecOutlinePane;
