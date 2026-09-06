/**
 * GraphqlExplorer — the Query tab's explorer over the resolved schema,
 * two rungs in one pane. The DOCS rung: the root operation types and
 * their fields, navigation into any type (fields with arguments and
 * return types, enum values, input fields, interfaces and possible
 * types, a scalar's specification URL), a field page with its
 * arguments and deprecation, a search across type and field names, and
 * a one-way "Insert at cursor". The BUILDER rung, on the root page: a
 * checkbox per field by PATH under the picked operation's root —
 * checked when the document selects it directly — with an expander
 * into the return type's fields, the field's arguments (a checkbox
 * writes `arg: $arg` and declares the variable; the cell takes a
 * literal or a `$variable` as the user types, selecting the field first
 * when the document does not yet), a union's members and an
 * interface's implementers as `... on T` rows (checked when the inline
 * fragment exists, the member's fields beneath), and the set's other
 * fragments read-only.
 * The document stays the source of truth: every gesture is span edits
 * through the editor's edit stack (`@openheaders/core/graphql`'s
 * builder), and the projection re-reads from the Query tab's one parse.
 *
 * Every list reads the model directly; the search index is built once
 * per schema and capped so a public schema's thousands of fields never
 * render at once.
 */

import {
  AlignLeftOutlined,
  ArrowLeftOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  argumentAt,
  type BuilderContext,
  type BuilderEdit,
  type BuilderPath,
  type BuilderStep,
  deselectFieldEdits,
  fieldAt,
  fieldsOf,
  fragmentsAt,
  type GraphqlField,
  type GraphqlInputValue,
  type GraphqlNamedType,
  type GraphqlSchema,
  isBuiltInScalar,
  isCompositeType,
  isIntrospectionName,
  namedTypeOf,
  nodeAt,
  type OperationDefinitionNode,
  type OperationType,
  possibleTypesOf,
  printTypeRef,
  removeArgumentEdits,
  rootTypeName,
  selectFieldEdits,
  setArgumentEdits,
} from '@openheaders/core/graphql';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createStoredPreference } from '@openheaders/ui/shared/hooks/useStoredPreference';
import { Button, Checkbox, Input, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { argumentInputText, argumentLiteral, argumentQuotes } from './graphql-argument-input';
import type { BuilderUndo } from './graphql-editor-services';
import './graphql-explorer.css';

const { Text } = Typography;

type ExplorerLocation =
  | { readonly kind: 'root' }
  | { readonly kind: 'type'; readonly name: string }
  | { readonly kind: 'field'; readonly typeName: string; readonly fieldName: string };

/** The builder's binding to the Query editor — the projection's inputs and the one way to write. */
export interface GraphqlBuilder {
  /** The picked operation of the Query tab's one parse; null on a blank or a document without one. */
  readonly operation: OperationDefinitionNode | null;
  /** The document is non-empty and does not parse — nothing to project or edit. */
  readonly broken: boolean;
  /** Runs one gesture: `plan` reads the editor's current text and answers the edits, applied through its edit stack — one undo step unless a typing session says otherwise. */
  readonly run: (plan: (context: BuilderContext) => readonly BuilderEdit[], undo?: BuilderUndo) => void;
  /** Closes a typing session's undo group. */
  readonly seal: () => void;
}

interface GraphqlExplorerProps {
  schema: GraphqlSchema;
  onInsert: (text: string) => void;
  builder: GraphqlBuilder;
  /** Collapses the pane to its strip. */
  onHide: () => void;
  /** Re-runs the introspection — present while that is the active source; a spec source has nothing to refresh. */
  refresh: { readonly refreshing: boolean; readonly onRefresh: () => void } | null;
}

/** A row's place in the picked operation — the path from the root, the row's own step last. */
interface BuilderPosition {
  readonly operationType: OperationType;
  readonly path: BuilderPath;
}

/** One row of the builder's tree — a field, or a member's `... on T`. */
interface TreeRow {
  readonly position: BuilderPosition;
  readonly label: React.ReactNode;
  readonly description: string | null;
  readonly deprecationReason: string | null;
  readonly args: readonly GraphqlInputValue[];
  /** The type the row's children come from — its fields, then its members; undefined on a leaf. */
  readonly type: GraphqlNamedType | undefined;
  readonly testId: string;
}

const SEARCH_LIMIT = 100;

const ROOT_OPERATIONS = ['query', 'mutation', 'subscription'] as const;

const DESCRIPTION_MODES = ['shown', 'hidden'] as const;
type DescriptionMode = (typeof DESCRIPTION_MODES)[number];

/** One preference for every explorer — the descriptions toggle, kept across reloads. */
const useDescriptionsPreference = createStoredPreference<DescriptionMode>(
  'oh.graphql.explorer.descriptions',
  DESCRIPTION_MODES,
  'shown',
);

/** The field as the document would select it: required arguments as
 *  same-named variables, an empty selection set on a composite type. */
export function fieldInsertionText(field: GraphqlField, schema: GraphqlSchema): string {
  const required = field.args.filter((arg) => arg.type.kind === 'NON_NULL' && arg.defaultValue === null);
  const args = required.length === 0 ? '' : `(${required.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})`;
  const named = schema.types.get(namedTypeOf(field.type));
  const selection = named !== undefined && isCompositeType(named) ? ' { }' : '';
  return `${field.name}${args}${selection}`;
}

function argumentSignature(args: readonly GraphqlInputValue[]): string {
  if (args.length === 0) return '';
  return `(${args.map((arg) => `${arg.name}: ${printTypeRef(arg.type)}`).join(', ')})`;
}

/** The user-facing types — the schema's own, not the introspection machinery nor the built-in scalars. */
function isExplorable(type: GraphqlNamedType): boolean {
  return !isIntrospectionName(type.name) && !isBuiltInScalar(type.name);
}

function stepKey(step: BuilderStep): string {
  return typeof step === 'string' ? step : `on:${step.on}`;
}

function positionKey(position: BuilderPosition): string {
  return `${position.operationType}.${position.path.map(stepKey).join('.')}`;
}

interface SearchIndex {
  readonly types: readonly GraphqlNamedType[];
  readonly fields: ReadonlyArray<{ readonly typeName: string; readonly field: GraphqlField }>;
}

function buildIndex(schema: GraphqlSchema): SearchIndex {
  const types: GraphqlNamedType[] = [];
  const fields: Array<{ typeName: string; field: GraphqlField }> = [];
  for (const type of schema.types.values()) {
    if (!isExplorable(type)) continue;
    types.push(type);
    if (type.kind === 'OBJECT' || type.kind === 'INTERFACE') {
      for (const field of type.fields) fields.push({ typeName: type.name, field });
    }
  }
  return { types, fields };
}

interface ArgumentValueInputProps {
  /** The text the document's value projects to; '' when the argument is not set. */
  value: string;
  placeholder: string;
  invalidHint: string;
  /** Lands the text as the argument's value — live, every keystroke; false when it is not one value yet (the cell shows the error until the next change). */
  onInput: (text: string, undo: BuilderUndo) => boolean;
  /** The typing session ended (blur / Enter) — its undo group closes. */
  onSessionEnd: () => void;
  testId: string;
}

/** The argument's value cell — writes the document as the user types,
 *  one undo group per typing session; the projection re-syncs the cell
 *  only while it is not focused. */
const ArgumentValueInput: React.FC<ArgumentValueInputProps> = ({
  value,
  placeholder,
  invalidHint,
  onInput,
  onSessionEnd,
  testId,
}) => {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  const session = useRef(false);
  useEffect(() => {
    if (focused.current) return;
    setText(value);
    setInvalid(false);
  }, [value]);
  const endSession = () => {
    if (!session.current) return;
    session.current = false;
    onSessionEnd();
  };
  return (
    <Tooltip title={invalid ? invalidHint : undefined} open={invalid ? undefined : false}>
      <Input
        size="small"
        value={text}
        placeholder={placeholder}
        status={invalid ? 'error' : undefined}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const landed = onInput(next, session.current ? 'continue' : 'open');
          if (landed) session.current = true;
          setInvalid(!landed);
        }}
        onPressEnter={endSession}
        onBlur={() => {
          focused.current = false;
          endSession();
          if (!invalid) setText(value);
        }}
        style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, height: 20, minWidth: 0, flex: 1 }}
        data-testid={testId}
      />
    </Tooltip>
  );
};

const GraphqlExplorer: React.FC<GraphqlExplorerProps> = ({ schema, onInsert, builder, onHide, refresh }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [stack, setStack] = useState<readonly ExplorerLocation[]>([{ kind: 'root' }]);
  const [term, setTerm] = useState('');
  // The builder's expanded paths — the only state the explorer keeps of its own.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // The root sections fold — open by default, per mount like the paths.
  const [collapsedRoots, setCollapsedRoots] = useState<ReadonlySet<OperationType>>(() => new Set());
  const [descriptions, setDescriptions] = useDescriptionsPreference();
  // A new schema (a refresh, another source) restarts at the roots.
  useEffect(() => {
    setStack([{ kind: 'root' }]);
  }, [schema]);
  const index = useMemo(() => buildIndex(schema), [schema]);

  const location = stack[stack.length - 1];
  // Navigating from a search result leaves the search — the page it
  // opens is what the user asked for.
  const push = (next: ExplorerLocation) => {
    setTerm('');
    setStack((current) => [...current, next]);
  };
  const back = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const toggleExpanded = (key: string, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleRoot = (operationType: OperationType) =>
    setCollapsedRoots((current) => {
      const next = new Set(current);
      if (next.has(operationType)) next.delete(operationType);
      else next.add(operationType);
      return next;
    });

  const monoStyle: React.CSSProperties = { fontFamily: "'SF Mono', monospace", fontSize: 11 };
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, padding: '1px 0' };
  const linkStyle: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 12 };
  const gutterStyle: React.CSSProperties = { width: 16, minWidth: 16, height: 16, padding: 0 };

  const typeLink = (name: string): React.ReactNode => {
    const type = schema.types.get(name);
    if (type === undefined || !isExplorable(type)) return <span style={monoStyle}>{name}</span>;
    return (
      <Button
        type="link"
        size="small"
        style={{ ...linkStyle, ...monoStyle }}
        onClick={() => push({ kind: 'type', name })}
        data-testid={`graphql-explorer-type-${name}`}
      >
        {name}
      </Button>
    );
  };

  // The docs pages link a name to its page and print the signature; the
  // builder's tree does neither — its rows are neutral `name Type`, the
  // arguments their own rows, the row's own controls the only
  // affordances (the reference's tree), the docs a line beneath.
  const fieldLabel = (typeName: string, field: GraphqlField, link = true): React.ReactNode => (
    <>
      {link ? (
        <Button
          type="link"
          size="small"
          style={{
            ...linkStyle,
            ...(field.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
          }}
          onClick={() => push({ kind: 'field', typeName, fieldName: field.name })}
        >
          {field.name}
        </Button>
      ) : (
        <span
          style={{
            ...monoStyle,
            fontSize: 12,
            ...(field.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
          }}
        >
          {field.name}
        </span>
      )}
      <span style={{ ...monoStyle, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {link ? `${argumentSignature(field.args)}: ${printTypeRef(field.type)}` : printTypeRef(field.type)}
      </span>
    </>
  );

  /** The description under a row when the toggle shows them — indented to the row's label column. */
  const descriptionLine = (text: string | null, indent: number, testId: string): React.ReactNode =>
    descriptions === 'shown' && text !== null ? (
      <Text
        type="secondary"
        style={{ fontSize: 11, display: 'block', paddingLeft: indent, whiteSpace: 'pre-wrap' }}
        data-testid={testId}
      >
        {text}
      </Text>
    ) : null;

  const fieldRow = (typeName: string, field: GraphqlField, described = false): React.ReactNode => (
    <div key={field.name}>
      <div style={rowStyle} data-testid={`graphql-explorer-field-${typeName}.${field.name}`}>
        {fieldLabel(typeName, field)}
      </div>
      {described && descriptionLine(field.description, 0, `graphql-explorer-description-${typeName}.${field.name}`)}
    </div>
  );

  // ── The builder rung ────────────────────────────────────────────

  const { operation } = builder;
  const buildableFor = (operationType: OperationType): boolean =>
    !builder.broken && (operation === null || operation.operation === operationType);
  const disabledHint = (operationType: OperationType): string | undefined => {
    if (builder.broken) return t('workbench.editors.graphql.builder.broken');
    if (operation !== null && operation.operation !== operationType) {
      return t('workbench.editors.graphql.builder.otherOperation', { operation: operation.operation });
    }
    return undefined;
  };
  const fieldNodeAt = (position: BuilderPosition) =>
    operation === null || operation.operation !== position.operationType ? null : fieldAt(operation, position.path);
  const selectedAt = (position: BuilderPosition): boolean =>
    operation !== null && operation.operation === position.operationType && nodeAt(operation, position.path) !== null;
  // A union's members and an interface's implementers — the `... on T` rows a composite row lists after its fields.
  const membersOf = (type: GraphqlNamedType | undefined): readonly string[] =>
    type !== undefined && (type.kind === 'UNION' || type.kind === 'INTERFACE') ? possibleTypesOf(schema, type) : [];

  // A click on the row block itself — not on a control inside it.
  const isRowClick = (event: React.MouseEvent<HTMLDivElement>): boolean =>
    !(event.target instanceof Element && event.target.closest('label, button, input') !== null);

  const argumentRow = (position: BuilderPosition, arg: GraphqlInputValue): React.ReactNode => {
    const node = fieldNodeAt(position);
    const argument = node === null ? null : argumentAt(node, arg.name);
    const key = `${positionKey(position)}.${arg.name}`;
    const { path } = position;
    const quotes = argumentQuotes(arg, schema);
    // Checking an argument of a field the document does not select yet
    // selects the field first — the two edits one undo step. Unchecking a
    // REQUIRED one takes the field with it: without the argument the
    // selection would not be valid.
    const required = arg.type.kind === 'NON_NULL' && arg.defaultValue === null;
    const checkArgument = () => {
      if (argument !== null) {
        builder.run((context) =>
          required ? deselectFieldEdits(context, path) : removeArgumentEdits(context, path, arg.name),
        );
        return;
      }
      const set = (context: BuilderContext) => setArgumentEdits(context, path, arg.name, `$${arg.name}`);
      if (node !== null) {
        builder.run(set);
        return;
      }
      builder.run((context) => selectFieldEdits(context, position.operationType, path), 'open');
      builder.run(set, 'continue');
      builder.seal();
    };
    const buildable = buildableFor(position.operationType);
    return (
      <div
        key={arg.name}
        className="graphql-explorer-row"
        style={{ ...rowStyle, alignItems: 'center' }}
        onClick={(event) => {
          if (buildable && isRowClick(event)) checkArgument();
        }}
        data-testid={`graphql-builder-arg-${key}`}
      >
        <span style={gutterStyle} />
        <Checkbox
          checked={argument !== null}
          disabled={!buildable}
          onChange={checkArgument}
          data-testid={`graphql-builder-arg-check-${key}`}
        />
        <span
          style={{
            ...monoStyle,
            fontSize: 12,
            ...(arg.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
          }}
        >
          {arg.name}
        </span>
        {argument !== null && (
          <ArgumentValueInput
            value={argumentInputText(argument.value, quotes)}
            placeholder={t('workbench.editors.graphql.builder.argumentPlaceholder')}
            invalidHint={t('workbench.editors.graphql.builder.invalidValue')}
            onInput={(text, undo) => {
              const literal = argumentLiteral(text, quotes);
              if (literal.kind === 'invalid') return false;
              builder.run((context) => setArgumentEdits(context, path, arg.name, literal.text), undo);
              return true;
            }}
            onSessionEnd={builder.seal}
            testId={`graphql-builder-arg-value-${key}`}
          />
        )}
        <span style={{ ...monoStyle, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
          {printTypeRef(arg.type)}
        </span>
        <Tag style={{ margin: 0, fontSize: 9, lineHeight: '14px' }} data-testid={`graphql-builder-arg-tag-${key}`}>
          ARG
        </Tag>
      </div>
    );
  };

  const treeRow = (row: TreeRow): React.ReactNode => {
    const { position, type } = row;
    const key = positionKey(position);
    const buildable = buildableFor(position.operationType);
    const checked = selectedAt(position);
    const children = fieldsOf(type);
    const members = membersOf(type);
    const expandable = children.length > 0 || members.length > 0 || row.args.length > 0;
    const isExpanded = expandable && expanded.has(key);
    const hint = disabledHint(position.operationType);
    const toggleChecked = () => {
      if (!buildable) return;
      if (checked) {
        builder.run((context) => deselectFieldEdits(context, position.path));
        return;
      }
      builder.run((context) => selectFieldEdits(context, position.operationType, position.path));
      if (expandable) toggleExpanded(key, true);
    };
    const checkbox = (
      <Checkbox
        checked={checked}
        disabled={!buildable}
        onChange={toggleChecked}
        data-testid={`graphql-builder-check-${key}`}
      />
    );
    return (
      <div key={key}>
        <div
          className="graphql-explorer-row"
          onClick={(event) => {
            if (!isRowClick(event)) return;
            if (expandable) toggleExpanded(key);
            else toggleChecked();
          }}
          data-testid={`graphql-builder-row-${key}`}
        >
          <div style={{ ...rowStyle, alignItems: 'center' }} data-testid={row.testId}>
            {expandable ? (
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                onClick={() => toggleExpanded(key)}
                aria-label={t(
                  isExpanded ? 'workbench.editors.graphql.builder.collapse' : 'workbench.editors.graphql.builder.expand',
                )}
                aria-expanded={isExpanded}
                style={{ ...gutterStyle, fontSize: 10 }}
                data-testid={`graphql-builder-expand-${key}`}
              />
            ) : (
              <span style={gutterStyle} />
            )}
            {hint === undefined ? checkbox : <Tooltip title={hint}>{checkbox}</Tooltip>}
            {row.label}
          </div>
          {descriptionLine(row.description, 44, `graphql-builder-description-${key}`)}
          {descriptions === 'shown' && deprecation(row.deprecationReason, `graphql-builder-deprecated-${key}`, 44)}
        </div>
        {isExpanded && (
          <div style={{ paddingLeft: 22 }}>
            {row.args.map((arg) => argumentRow(position, arg))}
            {checked &&
              operation !== null &&
              fragmentsAt(operation, position.path, members).map((fragment) => (
                <Tooltip key={`${fragment.start}`} title={t('workbench.editors.graphql.builder.fragmentReadOnly')}>
                  <div style={{ ...rowStyle, alignItems: 'center' }} data-testid={`graphql-builder-fragment-${key}`}>
                    <span style={gutterStyle} />
                    <span style={gutterStyle} />
                    <Text type="secondary" style={{ ...monoStyle, fontStyle: 'italic' }}>
                      {fragment.label}
                    </Text>
                  </div>
                </Tooltip>
              ))}
            {type !== undefined &&
              children.map((child) =>
                builderRow(type.name, child, {
                  operationType: position.operationType,
                  path: [...position.path, child.name],
                }),
              )}
            {type !== undefined &&
              members.map((name) =>
                memberRow(type.name, name, {
                  operationType: position.operationType,
                  path: [...position.path, { on: name }],
                }),
              )}
          </div>
        )}
      </div>
    );
  };

  const builderRow = (typeName: string, field: GraphqlField, position: BuilderPosition): React.ReactNode =>
    treeRow({
      position,
      label: fieldLabel(typeName, field, false),
      description: field.description,
      deprecationReason: field.deprecationReason,
      args: field.args,
      type: schema.types.get(namedTypeOf(field.type)),
      testId: `graphql-explorer-field-${typeName}.${field.name}`,
    });

  // One `... on T` row per possible type of a union or interface — checked
  // when the inline fragment exists, the member's own fields beneath it.
  const memberRow = (parentTypeName: string, name: string, position: BuilderPosition): React.ReactNode => {
    const type = schema.types.get(name);
    if (type === undefined) return null;
    return treeRow({
      position,
      label: <span style={{ ...monoStyle, fontSize: 12 }}>{`... on ${type.name}`}</span>,
      description: type.description,
      deprecationReason: null,
      args: [],
      type,
      testId: `graphql-explorer-member-${parentTypeName}.${type.name}`,
    });
  };

  const description = (text: string | null): React.ReactNode =>
    text === null ? null : (
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap', display: 'block' }}>
        {text}
      </Text>
    );

  const sectionTitle = (label: string): React.ReactNode => (
    <Text
      type="secondary"
      style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginTop: 8 }}
    >
      {label}
    </Text>
  );

  const deprecation = (reason: string | null, testid: string, indent = 0): React.ReactNode =>
    reason === null ? null : (
      <Text type="warning" style={{ fontSize: 11, display: 'block', paddingLeft: indent }} data-testid={testid}>
        {t('workbench.editors.graphql.explorer.deprecated', { reason })}
      </Text>
    );

  let body: React.ReactNode;
  const query = term.trim().toLowerCase();
  if (query !== '') {
    const types = index.types.filter((type) => type.name.toLowerCase().includes(query)).slice(0, SEARCH_LIMIT);
    const fields = index.fields
      .filter((entry) => entry.field.name.toLowerCase().includes(query))
      .slice(0, SEARCH_LIMIT - types.length);
    body =
      types.length === 0 && fields.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="graphql-explorer-no-results">
          {t('workbench.editors.graphql.explorer.noResults', { term: term.trim() })}
        </Text>
      ) : (
        <>
          {types.map((type) => (
            <div key={type.name} style={rowStyle}>
              <Tag style={{ margin: 0, fontSize: 9, lineHeight: '14px' }}>{type.kind}</Tag>
              {typeLink(type.name)}
            </div>
          ))}
          {fields.map((entry) => (
            <div key={`${entry.typeName}.${entry.field.name}`} style={rowStyle}>
              <span style={{ ...monoStyle, color: token.colorTextTertiary }}>{entry.typeName}.</span>
              {fieldRow(entry.typeName, entry.field)}
            </div>
          ))}
        </>
      );
  } else if (location.kind === 'root') {
    body = (
      <>
        {builder.broken && (
          <Text type="warning" style={{ fontSize: 11, display: 'block' }} data-testid="graphql-builder-broken">
            {t('workbench.editors.graphql.builder.broken')}
          </Text>
        )}
        {ROOT_OPERATIONS.map((operationType) => {
          const name = rootTypeName(schema, operationType);
          const type = name === null ? undefined : schema.types.get(name);
          if (name === null || type === undefined || (type.kind !== 'OBJECT' && type.kind !== 'INTERFACE')) {
            return null;
          }
          const open = !collapsedRoots.has(operationType);
          return (
            <div key={operationType} data-testid={`graphql-explorer-root-${operationType}`}>
              <div
                className="graphql-explorer-row"
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}
                onClick={(event) => {
                  if (isRowClick(event)) toggleRoot(operationType);
                }}
                data-testid={`graphql-explorer-root-row-${operationType}`}
              >
                <Button
                  size="small"
                  type="text"
                  icon={open ? <CaretDownOutlined /> : <CaretRightOutlined />}
                  onClick={() => toggleRoot(operationType)}
                  aria-expanded={open}
                  aria-label={t(
                    open ? 'workbench.editors.graphql.builder.collapse' : 'workbench.editors.graphql.builder.expand',
                  )}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    color: token.colorTextSecondary,
                    padding: '0 4px',
                    height: 20,
                  }}
                  data-testid={`graphql-explorer-root-toggle-${operationType}`}
                >
                  {operationType}
                </Button>
              </div>
              {open && type.fields.map((field) => builderRow(name, field, { operationType, path: [field.name] }))}
            </div>
          );
        })}
      </>
    );
  } else if (location.kind === 'type') {
    const type = schema.types.get(location.name);
    body =
      type === undefined ? null : (
        <div data-testid={`graphql-explorer-type-page-${type.name}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag style={{ margin: 0, fontSize: 9, lineHeight: '14px' }}>{type.kind}</Tag>
            <Text strong style={{ ...monoStyle, fontSize: 12 }}>
              {type.name}
            </Text>
          </div>
          {description(type.description)}
          {(type.kind === 'OBJECT' || type.kind === 'INTERFACE') && type.interfaces.length > 0 && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.implements'))}
              <div style={rowStyle}>{type.interfaces.map((name) => typeLink(name))}</div>
            </>
          )}
          {(type.kind === 'INTERFACE' || type.kind === 'UNION') && type.possibleTypes.length > 0 && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.possibleTypes'))}
              <div style={{ ...rowStyle, flexWrap: 'wrap' }}>{type.possibleTypes.map((name) => typeLink(name))}</div>
            </>
          )}
          {(type.kind === 'OBJECT' || type.kind === 'INTERFACE') && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.fields'))}
              {type.fields.map((field) => fieldRow(type.name, field, true))}
            </>
          )}
          {type.kind === 'ENUM' && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.values'))}
              {type.values.map((value) => (
                <div key={value.name} style={{ marginBottom: 2 }}>
                  <span
                    style={{
                      ...monoStyle,
                      fontSize: 12,
                      ...(value.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
                    }}
                  >
                    {value.name}
                  </span>
                  {description(value.description)}
                  {deprecation(value.deprecationReason, `graphql-explorer-deprecated-${value.name}`)}
                </div>
              ))}
            </>
          )}
          {type.kind === 'INPUT_OBJECT' && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.inputFields'))}
              {type.inputFields.map((field) => (
                <div key={field.name} style={{ marginBottom: 2 }}>
                  <div style={rowStyle}>
                    <span style={{ ...monoStyle, fontSize: 12 }}>{field.name}</span>
                    <span style={{ ...monoStyle, color: token.colorTextTertiary }}>: </span>
                    {typeLink(namedTypeOf(field.type))}
                    <span style={{ ...monoStyle, color: token.colorTextTertiary }}>
                      {printTypeRef(field.type)}
                      {field.defaultValue !== null ? ` = ${field.defaultValue}` : ''}
                    </span>
                  </div>
                  {description(field.description)}
                </div>
              ))}
            </>
          )}
          {type.kind === 'SCALAR' && type.specifiedByUrl !== null && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.specifiedBy'))}
              <Text style={{ fontSize: 12 }}>{type.specifiedByUrl}</Text>
            </>
          )}
        </div>
      );
  } else {
    const parent = schema.types.get(location.typeName);
    const field =
      parent !== undefined && (parent.kind === 'OBJECT' || parent.kind === 'INTERFACE')
        ? parent.fields.find((entry) => entry.name === location.fieldName)
        : undefined;
    body =
      field === undefined ? null : (
        <div data-testid={`graphql-explorer-field-page-${location.typeName}.${field.name}`}>
          <Text strong style={{ ...monoStyle, fontSize: 12, display: 'block' }}>
            {location.typeName}.{field.name}
          </Text>
          {deprecation(field.deprecationReason, 'graphql-explorer-deprecated')}
          {description(field.description)}
          {field.args.length > 0 && (
            <>
              {sectionTitle(t('workbench.editors.graphql.explorer.arguments'))}
              {field.args.map((arg) => (
                <div key={arg.name} style={{ marginBottom: 2 }}>
                  <div style={rowStyle}>
                    <span
                      style={{
                        ...monoStyle,
                        fontSize: 12,
                        ...(arg.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
                      }}
                    >
                      {arg.name}
                    </span>
                    <span style={{ ...monoStyle, color: token.colorTextTertiary }}>: </span>
                    {typeLink(namedTypeOf(arg.type))}
                    <span style={{ ...monoStyle, color: token.colorTextTertiary }}>
                      {printTypeRef(arg.type)}
                      {arg.defaultValue !== null ? ` = ${arg.defaultValue}` : ''}
                    </span>
                  </div>
                  {description(arg.description)}
                  {deprecation(arg.deprecationReason, `graphql-explorer-deprecated-${arg.name}`)}
                </div>
              ))}
            </>
          )}
          {sectionTitle(t('workbench.editors.graphql.explorer.returns'))}
          <div style={rowStyle}>
            {typeLink(namedTypeOf(field.type))}
            <span style={{ ...monoStyle, color: token.colorTextTertiary }}>{printTypeRef(field.type)}</span>
          </div>
          <Tooltip title={t('workbench.editors.graphql.explorer.insertHint')} placement="right">
            <Button
              size="small"
              style={{ marginTop: 10, fontSize: 11 }}
              onClick={() => onInsert(fieldInsertionText(field, schema))}
              data-testid="graphql-explorer-insert"
            >
              {t('workbench.editors.graphql.explorer.insert')}
            </Button>
          </Tooltip>
        </div>
      );
  }

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      data-testid="graphql-explorer"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 6px 0' }}>
        {location.kind !== 'root' && query === '' && (
          <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={back}
            aria-label={t('workbench.editors.graphql.explorer.back')}
            data-testid="graphql-explorer-back"
          />
        )}
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.graphql.explorer.search')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ fontSize: 12 }}
          data-testid="graphql-explorer-search"
        />
        <Tooltip
          title={t(
            descriptions === 'shown'
              ? 'workbench.editors.graphql.explorer.hideDescriptions'
              : 'workbench.editors.graphql.explorer.showDescriptions',
          )}
        >
          <Button
            size="small"
            type={descriptions === 'shown' ? 'default' : 'text'}
            icon={<AlignLeftOutlined />}
            onClick={() => setDescriptions(descriptions === 'shown' ? 'hidden' : 'shown')}
            aria-pressed={descriptions === 'shown'}
            aria-label={t(
              descriptions === 'shown'
                ? 'workbench.editors.graphql.explorer.hideDescriptions'
                : 'workbench.editors.graphql.explorer.showDescriptions',
            )}
            style={{ fontSize: 11 }}
            data-testid="graphql-explorer-descriptions"
          />
        </Tooltip>
        {refresh !== null && (
          <Tooltip title={t('workbench.editors.graphql.schema.refresh')}>
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              loading={refresh.refreshing}
              onClick={refresh.onRefresh}
              aria-label={t('workbench.editors.graphql.schema.refresh')}
              style={{ fontSize: 11 }}
              data-testid="graphql-explorer-refresh"
            />
          </Tooltip>
        )}
        <Tooltip title={t('workbench.editors.graphql.explorer.hide')}>
          <Button
            size="small"
            type="text"
            icon={<LeftOutlined style={{ fontSize: 10 }} />}
            onClick={onHide}
            aria-label={t('workbench.editors.graphql.explorer.hide')}
            data-testid="graphql-explorer-hide"
          />
        </Tooltip>
      </div>
      <div
        className="rules-thin-scrollbar"
        style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', paddingRight: 8, minHeight: 0 }}
      >
        {body}
      </div>
    </div>
  );
};

/** The explorer's collapsed state — a narrow vertical strip flush at the
 *  pane's edge, the whole strip one button that brings the pane back
 *  (the WS rail's strip, mirrored to the left). */
export const GraphqlExplorerStrip: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [hovered, setHovered] = useState(false);
  return (
    <Tooltip placement="right" title={t('workbench.editors.graphql.explorer.show')}>
      <button
        type="button"
        aria-label={t('workbench.editors.graphql.explorer.show')}
        onClick={onExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="graphql-explorer-strip"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: 26,
          padding: '8px 0',
          border: 'none',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          background: hovered ? token.colorFillTertiary : 'transparent',
          cursor: 'pointer',
          color: token.colorTextSecondary,
        }}
      >
        <RightOutlined style={{ fontSize: 10, flexShrink: 0 }} />
        <span style={{ writingMode: 'vertical-lr', fontSize: 12, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.graphql.explorer.title')}
        </span>
      </button>
    </Tooltip>
  );
};

export default GraphqlExplorer;
