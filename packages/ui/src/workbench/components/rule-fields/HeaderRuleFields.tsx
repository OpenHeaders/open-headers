/**
 * HeaderRuleFields — multiple request + response header actions.
 *
 * Maps 1:1 to Chrome's modifyHeaders DNR action. Two tabs:
 *   Request Headers — actions to outgoing headers
 *   Response Headers — actions to incoming headers
 *
 * Both tabs are ALWAYS mounted (destroyInactiveTabPane=false) so form.setFieldsValue
 * works regardless of which tab is visible. Auto-navigates to the tab with content.
 *
 * Header-name input is a TemplateInput so `{{var}}` segments render
 * as pills and resolve at request-compile time alongside the value.
 * Each row runs the capability check live: if the user authors an
 * invalid combination
 * (e.g. `Append` on `X-Custom-Header`, which Chrome's DNR rejects), the
 * row shows an inline warning and the rule becomes a draft via
 * `isRuleComplete` so it can never leave stale DNR rules behind.
 */

import { CloseOutlined, HolderOutlined, InfoCircleOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HeaderDirection } from '@openheaders/core/utils';
import { generateUid, getHeaderOperationCapability } from '@openheaders/core/utils';
import { Alert, Button, Form, Input, Select, Tabs, Tooltip, Typography } from 'antd';
import type React from 'react';
import { EntityField, TabPresenceBadge, useActionPaths, useEntityScope } from '@openheaders/ui/shared/awareness';
import { FieldConflictChip, SetRowChip } from '@openheaders/ui/shared/conflicts/Field';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import SectionInfo from '../shared/SectionInfo';
import { getDocId } from '../docs/doc-ids';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

const OPERATIONS = [
  // Labels describe what each op does to a header. The schema literals stay
  // ('override', 'add') for back-compat with the compiler; the user-facing
  // labels are unified across rule types so the same concept always reads
  // the same way (header "Add / Replace" matches query-param "Add / Replace").
  { value: 'override', label: 'Add / Replace' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];

type HeaderOp = 'override' | 'add' | 'remove' | 'merge';

interface ModificationListProps {
  /** Form.List parent field name — 'requestHeaders' or 'responseHeaders'. */
  name: 'requestHeaders' | 'responseHeaders';
  direction: HeaderDirection;
  /** Live rule uid + surface id, used to render presence chips beside
   *  rows another surface is currently editing. Both undefined for
   *  drafts (create mode) — chips are entity-bound, drafts have no uid. */
  ruleUid?: string;
  excludeInstanceId?: string;
}

function ModificationList({ name, direction, ruleUid, excludeInstanceId }: ModificationListProps) {
  const { openDocs: openDocsInline } = useInspectorNav();
  const paths = useActionPaths();
  const form = Form.useFormInstance();
  // Subscribe to the parent list so each row's persisted uid is available
  // when computing canonical RULE_FIELD paths for the per-leaf
  // `<EntityField>` wrappers. The hidden `uid` Form.Item binds it; useWatch
  // surfaces it reactively without a per-row sub-component.
  const rowsWatch = Form.useWatch(name, form) as Array<{ uid?: string }> | undefined;
  const rowUidAt = (index: number): string | undefined => rowsWatch?.[index]?.uid;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <Form.List name={name}>
      {(fields, { add, remove, move }) => {
        const handleDragEnd = (e: DragEndEvent) => {
          const { active, over } = e;
          if (!over || active.id === over.id) return;
          const from = fields.findIndex((f) => f.key === active.id);
          const to = fields.findIndex((f) => f.key === over.id);
          if (from < 0 || to < 0) return;
          move(from, to);
        };
        const rowIds = fields.map((f) => f.key);
        return (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                {fields.map((field) => {
                  const rowUid = rowUidAt(field.name);
                  // `wrap` short-circuits to the children directly when the
                  // row's persisted uid hasn't propagated through the form
                  // yet (one-tick race during a fresh `add()`). The fallback
                  // means the input still renders; presence chips light up
                  // on the next tick once the hidden uid binding flushes.
                  const wrap = (
                    leaf: 'headerName' | 'value' | 'operation' | 'mergeSeparator',
                    child: React.ReactNode,
                  ) =>
                    rowUid ? <EntityField path={paths.headerMod(direction, rowUid, leaf)}>{child}</EntityField> : child;
                  return (
                    <SortableHeaderRow key={field.key} id={field.key}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Hidden uid binding — preserves the row's persisted
                         *  identity through `getFieldsValue` so reorders /
                         *  edits don't churn itemIds on every save. Without
                         *  this, antd Form.List drops unbound subkeys from
                         *  its output, and the per-itemId LWW path on the
                         *  oracle treats every save as "remove+add" instead
                         *  of in-place edit. The schema-required `uid` is
                         *  also re-injected at the persist boundary
                         *  (`synthesizeSetDiff`) for defense in depth — that
                         *  catches any future editor that ships without this
                         *  hidden binding. */}
                        <Form.Item {...field} name={[field.name, 'uid']} hidden noStyle>
                          <input type="hidden" />
                        </Form.Item>
                        {wrap(
                          'operation',
                          <Form.Item
                            {...field}
                            name={[field.name, 'operation']}
                            style={{ marginBottom: 0, width: 125, flexShrink: 0 }}
                          >
                            <Select size="small" options={OPERATIONS} />
                          </Form.Item>,
                        )}
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, cur) =>
                            prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation
                          }
                        >
                          {({ getFieldValue }) => {
                            const op =
                              (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                            return (
                              <InfoCircleOutlined
                                style={{
                                  fontSize: 10,
                                  color: 'var(--ant-color-text-quaternary)',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                                onClick={() => openDocsInline(getDocId(op, 'action'))}
                              />
                            );
                          }}
                        </Form.Item>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, cur) =>
                            prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation ||
                            prev[name]?.[field.name]?.headerName !== cur[name]?.[field.name]?.headerName
                          }
                        >
                          {({ getFieldValue }) => {
                            const op =
                              (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                            const headerName =
                              (getFieldValue([name, field.name, 'headerName']) as string | undefined) ?? '';
                            const capability = getHeaderOperationCapability(direction, op, headerName);
                            const showWarning = !capability.allowed;
                            // Header name uses TemplateInput (same as the value
                            // field) so `{{var}}` segments render as pills and
                            // get the variable-suggestion popover. Standard
                            // header-name autocomplete (Authorization, etc.)
                            // is dropped — having two competing popovers on
                            // the same input was the worse UX, and template
                            // support for header names is the more frequently
                            // useful primitive.
                            return wrap(
                              'headerName',
                              <Form.Item
                                {...field}
                                name={[field.name, 'headerName']}
                                style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                                validateStatus={showWarning ? 'warning' : undefined}
                              >
                                <TemplateInput
                                  size="small"
                                  placeholder="Header Name"
                                  wrap
                                  maxRows={4}
                                  resizable
                                  allowClear
                                />
                              </Form.Item>,
                            );
                          }}
                        </Form.Item>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, cur) => {
                            const prevOp = prev[name]?.[field.name]?.operation;
                            const curOp = cur[name]?.[field.name]?.operation;
                            return prevOp !== curOp;
                          }}
                        >
                          {({ getFieldValue }) => {
                            const op = getFieldValue([name, field.name, 'operation']);
                            if (op === 'remove') return null;
                            if (op === 'merge') {
                              return (
                                <>
                                  <Input
                                    size="small"
                                    disabled
                                    value="existing value"
                                    style={{
                                      marginBottom: 0,
                                      width: 105,
                                      flexShrink: 0,
                                      fontStyle: 'italic',
                                      opacity: 0.5,
                                    }}
                                  />
                                  {wrap(
                                    'mergeSeparator',
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'mergeSeparator']}
                                      style={{ marginBottom: 0, width: 50, flexShrink: 0 }}
                                    >
                                      <Input
                                        size="small"
                                        placeholder="; "
                                        style={{ textAlign: 'center', fontFamily: 'monospace' }}
                                      />
                                    </Form.Item>,
                                  )}
                                  {wrap(
                                    'value',
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'value']}
                                      style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                                    >
                                      <TemplateInput
                                        size="small"
                                        placeholder="Value to append"
                                        wrap
                                        maxRows={4}
                                        resizable
                                        allowClear
                                      />
                                    </Form.Item>,
                                  )}
                                </>
                              );
                            }
                            return wrap(
                              'value',
                              <Form.Item
                                {...field}
                                name={[field.name, 'value']}
                                style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                              >
                                <TemplateInput
                                  size="small"
                                  placeholder="Header Value"
                                  wrap
                                  maxRows={4}
                                  resizable
                                  allowClear
                                />
                              </Form.Item>,
                            );
                          }}
                        </Form.Item>
                        {/* Per-row + per-leaf conflict affordances — replaced the
                    legacy inline shouldUpdate-Form.Item-ConflictDiffChip
                    plumbing with the field-tree primitive. `<SetRowChip>`
                    surfaces "saved version removed this row";
                    `<FieldConflictChip>` surfaces per-leaf diffs for
                    free-text leaves only (operation + mergeSeparator are
                    short typed scalars where a banner-style "they changed
                    it" doesn't add value beyond presence). */}
                        {ruleUid && rowUid && (
                          <SetRowChip
                            setPath={paths.headerSet(direction)}
                            uid={rowUid}
                            formContainsUid={true}
                            onUseSaved={() => remove(field.name)}
                          />
                        )}
                        {ruleUid && rowUid && (
                          <>
                            <FieldConflictChip
                              path={paths.headerMod(direction, rowUid, 'headerName')}
                              formName={[name, field.name, 'headerName']}
                            />
                            <FieldConflictChip
                              path={paths.headerMod(direction, rowUid, 'operation')}
                              formName={[name, field.name, 'operation']}
                            />
                            {/* `value` and `mergeSeparator` are operation-conditional —
                        the inputs hide for op='remove' / non-'merge' so the
                        chips would otherwise sit next to a column that's
                        not visible. shouldUpdate gates each chip on the
                        operation it belongs to. */}
                            <Form.Item
                              noStyle
                              shouldUpdate={(prev, cur) =>
                                prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation
                              }
                            >
                              {({ getFieldValue }) => {
                                const op =
                                  (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ??
                                  'override';
                                return op === 'remove' ? null : (
                                  <FieldConflictChip
                                    path={paths.headerMod(direction, rowUid, 'value')}
                                    formName={[name, field.name, 'value']}
                                  />
                                );
                              }}
                            </Form.Item>
                            <Form.Item
                              noStyle
                              shouldUpdate={(prev, cur) =>
                                prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation
                              }
                            >
                              {({ getFieldValue }) => {
                                const op =
                                  (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ??
                                  'override';
                                return op === 'merge' ? (
                                  <FieldConflictChip
                                    path={paths.headerMod(direction, rowUid, 'mergeSeparator')}
                                    formName={[name, field.name, 'mergeSeparator']}
                                  />
                                ) : null;
                              }}
                            </Form.Item>
                          </>
                        )}
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined style={{ fontSize: 10 }} />}
                          onClick={() => remove(field.name)}
                          style={{ color: 'var(--ant-color-text-tertiary)', flexShrink: 0 }}
                        />
                      </div>
                      {/* Inline capability warning — separate row so long reasons wrap cleanly. */}
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) =>
                          prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation ||
                          prev[name]?.[field.name]?.headerName !== cur[name]?.[field.name]?.headerName
                        }
                      >
                        {({ getFieldValue }) => {
                          const op =
                            (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                          const headerName =
                            (getFieldValue([name, field.name, 'headerName']) as string | undefined) ?? '';
                          const capability = getHeaderOperationCapability(direction, op, headerName);
                          if (capability.allowed) return null;
                          const switchToSuggested = () => {
                            if (!capability.suggestion) return;
                            form.setFieldValue([name, field.name, 'operation'], capability.suggestion);
                          };
                          return (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 6,
                                marginLeft: 147,
                                marginTop: 2,
                                fontSize: 11,
                                color: 'var(--ant-color-warning)',
                                lineHeight: 1.4,
                              }}
                            >
                              <WarningOutlined style={{ fontSize: 11, marginTop: 2 }} />
                              <span style={{ flex: 1 }}>
                                {capability.reason}
                                {capability.suggestion && (
                                  <>
                                    {' '}
                                    <Button
                                      type="link"
                                      size="small"
                                      onClick={switchToSuggested}
                                      style={{ padding: 0, height: 'auto', fontSize: 11 }}
                                    >
                                      Switch to{' '}
                                      {capability.suggestion === 'override' ? 'Add / Replace' : capability.suggestion}
                                    </Button>
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        }}
                      </Form.Item>
                    </SortableHeaderRow>
                  );
                })}
              </SortableContext>
            </DndContext>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => add({ uid: generateUid(), operation: 'override', headerName: '', value: '' })}
            >
              Add Action
            </Button>
          </>
        );
      }}
    </Form.List>
  );
}

/**
 * Sortable wrapper for one header-mod row. Provides the drag handle
 * column on the left and forwards the rest of the row content as
 * children. Uses dnd-kit's `useSortable` keyed by Form.List's stable
 * `field.key` — Form.List's `move(from, to)` reorders the underlying
 * `requestHeaders` / `responseHeaders` array, and the editor's save
 * pipeline emits the minimum diff (`moveBefore` per row outside the
 * LIS) via the unified set-diff synthesizer (session 40).
 */
function SortableHeaderRow({ id, children }: { id: string | number; children: React.ReactNode }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 6,
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? 'var(--ant-color-fill-tertiary)' : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 24,
          cursor: 'grab',
          color: 'var(--ant-color-text-tertiary)',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <HolderOutlined />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/**
 * Neutral count chip — replaces antd's red `<Badge count={…} />` for
 * tab labels. Communicates "N items" without screaming "N alerts" at
 * the user, and matches the visual weight of `<AwarenessPill>` so the
 * count + presence badge sit side-by-side as a coherent unit.
 */
function CountChip({ count }: { count: number }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 16,
        padding: '0 6px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.06)',
        color: 'var(--ant-color-text-secondary)',
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  );
}

interface HeaderRuleFieldsProps {
  /** Controlled active tab — parent (RuleEditor) owns this state. */
  activeTab: string;
  /** Tab change callback — parent updates state on user click. */
  onTabChange: (tab: string) => void;
  /** Request header count — parent (RuleEditor) owns this to avoid useWatch timing issues. */
  reqCount: number;
  /** Response header count — parent (RuleEditor) owns this to avoid useWatch timing issues. */
  resCount: number;
  /** Live rule uid; passed to per-row presence chips. Undefined for drafts. */
  ruleUid?: string;
  /** Local surface id ('workbench'), so per-row chips don't render this surface. */
  excludeInstanceId?: string;
}

const HeaderRuleFields: React.FC<HeaderRuleFieldsProps> = ({
  activeTab,
  onTabChange,
  reqCount,
  resCount,
  ruleUid,
  excludeInstanceId,
}) => {
  const paths = useActionPaths();
  const scope = useEntityScope();
  const entityType = scope.entityType;
  const hasResponse = resCount > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {hasResponse && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, fontSize: 12 }}
          message="Response header actions are not visible in the browser DevTools Network tab, but they are actually applied. The browser shows the original server headers."
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <SectionInfo
          content={{
            kicker: 'Header Rule',
            title: 'Actions',
            summary: 'Rewrites request and response headers on matching traffic.',
            description:
              'Invalid combinations (e.g. Append on a custom header) mark the rule as a draft. Drafts are saved but not executed.',
          }}
          docId="header-actions"
        />
      </div>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={onTabChange}
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'request',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Request Headers
                {reqCount > 0 && <CountChip count={reqCount} />}
                {ruleUid && entityType && excludeInstanceId !== undefined && (
                  <TabPresenceBadge
                    entityType={entityType}
                    entityId={ruleUid}
                    pathPrefix={`${paths.headerSet('request')}.`}
                    excludeInstanceId={excludeInstanceId}
                  />
                )}
              </span>
            ),
            children: (
              <ModificationList
                name="requestHeaders"
                direction="request"
                ruleUid={ruleUid}
                excludeInstanceId={excludeInstanceId}
              />
            ),
          },
          {
            key: 'response',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Response Headers
                {resCount > 0 && <CountChip count={resCount} />}
                {ruleUid && entityType && excludeInstanceId !== undefined && (
                  <TabPresenceBadge
                    entityType={entityType}
                    entityId={ruleUid}
                    pathPrefix={`${paths.headerSet('response')}.`}
                    excludeInstanceId={excludeInstanceId}
                  />
                )}
              </span>
            ),
            children: (
              <ModificationList
                name="responseHeaders"
                direction="response"
                ruleUid={ruleUid}
                excludeInstanceId={excludeInstanceId}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default HeaderRuleFields;
