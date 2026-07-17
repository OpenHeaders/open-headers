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

import { CloseOutlined, HolderOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
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
import { Button, Form, Input, Select, Tabs, Typography } from 'antd';
import type React from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, TabPresenceBadge, useActionPaths, useEntityScope } from '@openheaders/ui/shared/awareness';
import { headerValidationMessage } from '@openheaders/ui/shared/headers';
import { FieldConflictChip, SetRowChip } from '@openheaders/ui/shared/conflicts/Field';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import DocInfo from '../shared/DocInfo';
import SectionInfo from '../shared/SectionInfo';
import { getDocId } from '../docs/doc-ids';
import { TemplateInput } from '../template-input';
import { DetectedValueInput } from '../value-editors';
import type { ColumnSplit } from './use-column-split';
import { useColumnSplit } from './use-column-split';

const { Text } = Typography;

// Labels describe what each op does to a header. The schema literals stay
// ('override', 'add') for back-compat with the compiler; the user-facing
// labels are unified across rule types so the same concept always reads
// the same way (header "Add / Replace" matches query-param "Add / Replace").
const buildOperationOptions = (t: Translate) => [
  { value: 'override', label: t('workbench.editors.rule.fields.opAddReplace') },
  { value: 'add', label: t('workbench.editors.rule.fields.opAppend') },
  { value: 'remove', label: t('workbench.editors.rule.fields.opRemove') },
  { value: 'merge', label: t('workbench.editors.rule.fields.opMerge') },
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
  /** Shared name/value column boundary — owned by HeaderRuleFields so
   *  the request and response tabs keep one split. */
  split: ColumnSplit;
}

function ModificationList({ name, direction, ruleUid, excludeInstanceId, split }: ModificationListProps) {
  const t = useT();
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
        // Same card chrome as ConditionEditor — rounded bordered box,
        // centered empty-state line, add-button row separated by an
        // inset border — so Actions and Conditions read as siblings.
        return (
          <div
            style={{
              border: '1px solid var(--ant-color-border)',
              borderRadius: 6,
              background: 'var(--ant-color-bg-container)',
            }}
          >
            {fields.length === 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  color: 'var(--ant-color-text-tertiary)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {direction === 'request'
                  ? t('workbench.editors.rule.fields.header.emptyRequest')
                  : t('workbench.editors.rule.fields.header.emptyResponse')}
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                <div style={{ padding: fields.length > 0 ? '8px 10px 2px' : 0 }}>
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
                    <SortableHeaderRow
                      key={field.key}
                      id={field.key}
                      ariaLabel={t('workbench.editors.rule.fields.header.dragToReorder')}
                    >
                      <div {...split.rowProps} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                            <Select size="small" options={buildOperationOptions(t)} />
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
                            return <DocInfo docId={getDocId(op, 'action')} />;
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
                            return (
                              <div {...split.leftCellProps}>
                                {wrap(
                                  'headerName',
                                  <Form.Item
                                    {...field}
                                    name={[field.name, 'headerName']}
                                    style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                                    validateStatus={showWarning ? 'warning' : undefined}
                                  >
                                    <TemplateInput
                                      size="small"
                                      placeholder={t('workbench.editors.rule.fields.header.namePlaceholder')}
                                      wrap
                                      maxRows={4}
                                      resizable
                                      onResizeX={split.onResizeX}
                                      allowClear
                                    />
                                  </Form.Item>,
                                )}
                              </div>
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
                                    value={t('workbench.editors.rule.fields.header.existingValue')}
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
                                  <div {...split.rightCellProps}>
                                    {wrap(
                                      'value',
                                      <Form.Item
                                        {...field}
                                        name={[field.name, 'value']}
                                        style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                                      >
                                        <DetectedValueInput
                                          size="small"
                                          placeholder={t('workbench.editors.rule.fields.header.appendValuePlaceholder')}
                                          wrap
                                          maxRows={4}
                                          resizable
                                          onResizeX={split.onResizeX}
                                          allowClear
                                        />
                                      </Form.Item>,
                                    )}
                                  </div>
                                </>
                              );
                            }
                            return (
                              <div {...split.rightCellProps}>
                                {wrap(
                                  'value',
                                  <Form.Item
                                    {...field}
                                    name={[field.name, 'value']}
                                    style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                                  >
                                    <DetectedValueInput
                                      size="small"
                                      placeholder={t('workbench.editors.rule.fields.header.valuePlaceholder')}
                                      wrap
                                      maxRows={4}
                                      resizable
                                      onResizeX={split.onResizeX}
                                      allowClear
                                    />
                                  </Form.Item>,
                                )}
                              </div>
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
                                {headerValidationMessage(t, capability)}
                                {capability.suggestion && (
                                  <>
                                    {' '}
                                    <Button
                                      type="link"
                                      size="small"
                                      onClick={switchToSuggested}
                                      style={{ padding: 0, height: 'auto', fontSize: 11 }}
                                    >
                                      {t('workbench.editors.rule.fields.header.switchTo', {
                                        operation:
                                          capability.suggestion === 'override'
                                            ? t('workbench.editors.rule.fields.opAddReplace')
                                            : capability.suggestion,
                                      })}
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
                </div>
              </SortableContext>
            </DndContext>
            {/* Empty state: centered under the hint text. With rows: a
                left-aligned footer row below an inset separator. */}
            <div
              style={{
                padding: fields.length > 0 ? '6px 10px' : '0 10px 14px',
                borderTop: fields.length > 0 ? '1px solid var(--ant-color-border-secondary)' : undefined,
                textAlign: fields.length > 0 ? undefined : 'center',
              }}
            >
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => add({ uid: generateUid(), operation: 'override', headerName: '', value: '' })}
                style={{ fontSize: 12 }}
              >
                {t('workbench.editors.rule.fields.addAction')}
              </Button>
            </div>
          </div>
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
function SortableHeaderRow({
  id,
  ariaLabel,
  children,
}: {
  id: string | number;
  ariaLabel: string;
  children: React.ReactNode;
}): React.ReactElement {
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
        aria-label={ariaLabel}
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
  const t = useT();
  const paths = useActionPaths();
  const scope = useEntityScope();
  const entityType = scope.entityType;
  // One name/value boundary for both tabs — dragging any row's grip in
  // either direction keeps every header row's columns aligned.
  const split = useColumnSplit({ minLeft: 140, minRight: 120 });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: t('workbench.editors.rule.fields.header.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.header.infoSummary'),
            description: t('workbench.editors.rule.fields.header.infoDescription'),
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
                {t('workbench.editors.rule.fields.header.requestTab')}
                <SectionInfo
                  content={{
                    kicker: t('workbench.editors.rule.fields.header.kicker'),
                    title: t('workbench.editors.rule.fields.header.requestTab'),
                    summary: t('workbench.editors.rule.fields.header.requestTabSummary'),
                  }}
                  docId="header-actions"
                />
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
                split={split}
              />
            ),
          },
          {
            key: 'response',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t('workbench.editors.rule.fields.header.responseTab')}
                <SectionInfo
                  content={{
                    kicker: t('workbench.editors.rule.fields.header.kicker'),
                    title: t('workbench.editors.rule.fields.header.responseTab'),
                    summary: t('workbench.editors.rule.fields.header.responseTabSummary'),
                    description: t('workbench.editors.rule.fields.header.responseTabDescription'),
                  }}
                  docId="header-actions"
                />
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
                split={split}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default HeaderRuleFields;
