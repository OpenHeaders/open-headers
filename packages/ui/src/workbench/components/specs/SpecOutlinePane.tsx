/**
 * SpecOutlinePane — the spec editor's structure rail (vendor parity:
 * Servers / Tags / Paths / Components / Security / Files for OpenAPI,
 * Package / Imports / Services / Messages / Enums / Files for
 * Protobuf; left of the code editor).
 *
 * Pure presentation over the derived outline groups (parse-on-idle
 * result — never stored, never recomputed here) plus the entity's file
 * set for the Files group. Clicking a row hands its character offset
 * to the host, which moves the editor caret; group headers with a
 * source position navigate too. Rpc rows render a call-shape glyph
 * from their streaming metadata.
 *
 * Add affordances (S6, YAML roots only): hover "+" on insertable group
 * headers and path rows (affordance-visibility rules — hover on
 * chrome), plus an inline "Add …" row inside empty groups (vendor
 * evidence: "No servers defined. Add"). Both hand a `SpecInsertTarget`
 * to the host, which splices the snippet into the Monaco buffer.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  FolderOutlined,
  ImportOutlined,
  InboxOutlined,
  KeyOutlined,
  MailOutlined,
  NodeIndexOutlined,
  OrderedListOutlined,
  PartitionOutlined,
  PlusOutlined,
  SafetyOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import type { ProtoStreamingShape } from '@openheaders/core/proto';
import type { SpecFile } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Tooltip, Tree, Typography, theme } from 'antd';
import type { TreeDataNode } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { METHOD_COLORS } from '../sidebar/icons';
import type { SpecInsertTarget } from './spec-outline-insert';
import type { SpecOutlineNode } from './spec-outline';

interface SpecOutlinePaneProps {
  /** Derived outline groups (format-dispatched); null before the
   *  buffer has ever parsed. */
  groups: SpecOutlineNode[] | null;
  files: SpecFile[];
  rootFileUid: string;
  /** `end` bounds the editor's section highlight; absent → own line only. */
  onNavigate: (offset: number, end?: number) => void;
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
  package: 'workbench.editors.spec.outline.groups.package',
  imports: 'workbench.editors.spec.outline.groups.imports',
  services: 'workbench.editors.spec.outline.groups.services',
  messages: 'workbench.editors.spec.outline.groups.messages',
  enums: 'workbench.editors.spec.outline.groups.enums',
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

const GROUP_KEYS = Object.keys(GROUP_LABEL_KEYS);

/** Group-header prefix icons (vendor parity — every group carries one). */
const GROUP_ICONS: Record<string, React.ReactNode> = {
  servers: <CloudServerOutlined />,
  tags: <TagsOutlined />,
  paths: <NodeIndexOutlined />,
  components: <AppstoreOutlined />,
  'components:schemas': <PartitionOutlined />,
  'components:securitySchemes': <KeyOutlined />,
  security: <SafetyOutlined />,
  package: <InboxOutlined />,
  imports: <ImportOutlined />,
  services: <ApiOutlined />,
  messages: <MailOutlined />,
  enums: <OrderedListOutlined />,
  files: <FolderOutlined />,
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

function groupTitle(key: string, count: number | null, wiring: AffordanceWiring): React.ReactNode {
  const insert = wiring.canInsert ? GROUP_INSERTS[key] : undefined;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, width: '100%' }}>
      {GROUP_ICONS[key] !== undefined && (
        <span style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary, #999)', flexShrink: 0, display: 'inline-flex' }}>
          {GROUP_ICONS[key]}
        </span>
      )}
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
  if (node.kind === 'rpc' && node.streaming !== undefined) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 11, minWidth: 0 }}>
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
  groups,
  files,
  rootFileUid,
  onNavigate,
  canInsert,
  onInsert,
}) => {
  const { token } = theme.useToken();
  const t = useT();

  // The clicked row stays marked (vendor parity) — the keys are stable
  // path-derived strings, so the mark survives outline recomputes.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Tree data + the key → source-span map the click handler resolves
  // against, built in one walk per outline recompute.
  const { treeData, spans } = useMemo(() => {
    const wiring: AffordanceWiring = { canInsert, onInsert, t };
    const spanByKey = new Map<string, { offset: number; end?: number }>();
    const toDataNode = (node: SpecOutlineNode): TreeDataNode => {
      if (node.offset !== null) {
        spanByKey.set(node.key, { offset: node.offset, ...(node.end !== undefined ? { end: node.end } : {}) });
      }
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
    if (groups !== null) {
      data.push(...groups.map(toDataNode));
    }
    data.push({
      key: 'files',
      title: groupTitle('files', files.length, wiring),
      children: files.map((file) => {
        // The single v1 root file IS the open buffer — navigating to
        // its top is the honest "select this file" until multi-file.
        spanByKey.set(`file:${file.uid}`, { offset: 0 });
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
    return { treeData: data, spans: spanByKey };
  }, [groups, files, rootFileUid, t, token, canInsert, onInsert]);

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
      {groups === null ? (
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
