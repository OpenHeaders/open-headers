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
 * into the return type's fields, the checked field's arguments (a
 * checkbox writes `arg: $arg` and declares the variable; the input
 * takes a literal or a `$variable`), and the set's fragments read-only.
 * The document stays the source of truth: every gesture is span edits
 * through the editor's edit stack (`@openheaders/core/graphql`'s
 * builder), and the projection re-reads from the Query tab's one parse.
 *
 * Every list reads the model directly; the search index is built once
 * per schema and capped so a public schema's thousands of fields never
 * render at once.
 */

import { ArrowLeftOutlined, CaretDownOutlined, CaretRightOutlined, SearchOutlined } from '@ant-design/icons';
import {
  argumentAt,
  type BuilderContext,
  type BuilderEdit,
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
  type OperationDefinitionNode,
  type OperationType,
  parseValue,
  printNode,
  printTypeRef,
  removeArgumentEdits,
  rootTypeName,
  selectFieldEdits,
  setArgumentEdits,
} from '@openheaders/core/graphql';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Checkbox, Input, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

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
  /** Runs one gesture: `plan` reads the editor's current text and answers the edits, applied through its edit stack. */
  readonly run: (plan: (context: BuilderContext) => readonly BuilderEdit[]) => void;
}

interface GraphqlExplorerProps {
  schema: GraphqlSchema;
  onInsert: (text: string) => void;
  builder: GraphqlBuilder;
}

/** A field's place in the picked operation — the path from the root, the field last. */
interface BuilderPosition {
  readonly operationType: OperationType;
  readonly path: readonly string[];
}

const SEARCH_LIMIT = 100;

const ROOT_OPERATIONS = ['query', 'mutation', 'subscription'] as const;

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

function positionKey(position: BuilderPosition): string {
  return `${position.operationType}.${position.path.join('.')}`;
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
  /** The value the document holds, printed; '' when the argument is not set. */
  value: string;
  placeholder: string;
  invalidHint: string;
  /** Commits the text; false when it is not one GraphQL value (the input shows the error until the next change). */
  onCommit: (text: string) => boolean;
  testId: string;
}

/** The argument's value cell — a draft until Enter / blur commits it. */
const ArgumentValueInput: React.FC<ArgumentValueInputProps> = ({
  value,
  placeholder,
  invalidHint,
  onCommit,
  testId,
}) => {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  const commit = () => {
    if (text.trim() === value.trim()) return;
    setInvalid(!onCommit(text));
  };
  return (
    <Tooltip title={invalid ? invalidHint : undefined} open={invalid ? undefined : false}>
      <Input
        size="small"
        value={text}
        placeholder={placeholder}
        status={invalid ? 'error' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onPressEnter={commit}
        onBlur={commit}
        style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, height: 20, minWidth: 0, flex: 1 }}
        data-testid={testId}
      />
    </Tooltip>
  );
};

const GraphqlExplorer: React.FC<GraphqlExplorerProps> = ({ schema, onInsert, builder }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [stack, setStack] = useState<readonly ExplorerLocation[]>([{ kind: 'root' }]);
  const [term, setTerm] = useState('');
  // The builder's expanded paths — the only state the explorer keeps of its own.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
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

  const fieldLabel = (typeName: string, field: GraphqlField): React.ReactNode => (
    <>
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
      <span style={{ ...monoStyle, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {argumentSignature(field.args)}: {printTypeRef(field.type)}
      </span>
    </>
  );

  const fieldRow = (typeName: string, field: GraphqlField): React.ReactNode => (
    <div key={field.name} style={rowStyle} data-testid={`graphql-explorer-field-${typeName}.${field.name}`}>
      {fieldLabel(typeName, field)}
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

  const argumentRow = (position: BuilderPosition, arg: GraphqlInputValue): React.ReactNode => {
    const node = fieldNodeAt(position);
    const argument = node === null ? null : argumentAt(node, arg.name);
    const key = `${positionKey(position)}.${arg.name}`;
    const { path } = position;
    return (
      <div key={arg.name} style={{ ...rowStyle, alignItems: 'center' }} data-testid={`graphql-builder-arg-${key}`}>
        <span style={gutterStyle} />
        <Checkbox
          checked={argument !== null}
          onChange={() =>
            builder.run((context) =>
              argument === null
                ? setArgumentEdits(context, path, arg.name, `$${arg.name}`)
                : removeArgumentEdits(context, path, arg.name),
            )
          }
          data-testid={`graphql-builder-arg-check-${key}`}
        />
        <span
          style={{
            ...monoStyle,
            ...(arg.deprecationReason !== null ? { textDecoration: 'line-through', opacity: 0.7 } : {}),
          }}
        >
          {arg.name}:
        </span>
        <ArgumentValueInput
          value={argument === null ? '' : printNode(argument.value)}
          placeholder={t('workbench.editors.graphql.builder.argumentPlaceholder')}
          invalidHint={t('workbench.editors.graphql.builder.invalidValue')}
          onCommit={(text) => {
            if (text.trim() === '') {
              builder.run((context) => removeArgumentEdits(context, path, arg.name));
              return true;
            }
            if (parseValue(text.trim()).value === null) return false;
            builder.run((context) => setArgumentEdits(context, path, arg.name, text));
            return true;
          }}
          testId={`graphql-builder-arg-value-${key}`}
        />
        <span style={{ ...monoStyle, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
          {printTypeRef(arg.type)}
        </span>
      </div>
    );
  };

  const builderRow = (typeName: string, field: GraphqlField, position: BuilderPosition): React.ReactNode => {
    const key = positionKey(position);
    const buildable = buildableFor(position.operationType);
    const checked = fieldNodeAt(position) !== null;
    const returnType = schema.types.get(namedTypeOf(field.type));
    const children = fieldsOf(returnType);
    const expandable = children.length > 0 || field.args.length > 0;
    const isExpanded = expandable && expanded.has(key);
    const hint = disabledHint(position.operationType);
    const checkbox = (
      <Checkbox
        checked={checked}
        disabled={!buildable}
        onChange={() => {
          if (checked) {
            builder.run((context) => deselectFieldEdits(context, position.path));
            return;
          }
          builder.run((context) => selectFieldEdits(context, position.operationType, position.path));
          if (expandable) toggleExpanded(key, true);
        }}
        data-testid={`graphql-builder-check-${key}`}
      />
    );
    return (
      <div key={field.name}>
        <div
          style={{ ...rowStyle, alignItems: 'center' }}
          data-testid={`graphql-explorer-field-${typeName}.${field.name}`}
        >
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
          {fieldLabel(typeName, field)}
        </div>
        {isExpanded && (
          <div style={{ paddingLeft: 22 }}>
            {checked && field.args.map((arg) => argumentRow(position, arg))}
            {checked &&
              operation !== null &&
              fragmentsAt(operation, position.path).map((row) => (
                <Tooltip key={`${row.start}`} title={t('workbench.editors.graphql.builder.fragmentReadOnly')}>
                  <div style={{ ...rowStyle, alignItems: 'center' }} data-testid={`graphql-builder-fragment-${key}`}>
                    <span style={gutterStyle} />
                    <span style={gutterStyle} />
                    <Text type="secondary" style={{ ...monoStyle, fontStyle: 'italic' }}>
                      {row.label}
                    </Text>
                  </div>
                </Tooltip>
              ))}
            {returnType !== undefined &&
              children.map((child) =>
                builderRow(returnType.name, child, {
                  operationType: position.operationType,
                  path: [...position.path, child.name],
                }),
              )}
          </div>
        )}
      </div>
    );
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

  const deprecation = (reason: string | null, testid: string): React.ReactNode =>
    reason === null ? null : (
      <Text type="warning" style={{ fontSize: 11, display: 'block' }} data-testid={testid}>
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
          return (
            <div key={operationType} data-testid={`graphql-explorer-root-${operationType}`}>
              {sectionTitle(operationType)}
              <div style={{ marginBottom: 2 }}>{typeLink(name)}</div>
              {type.fields.map((field) => builderRow(name, field, { operationType, path: [field.name] }))}
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
              {type.fields.map((field) => fieldRow(type.name, field))}
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

export default GraphqlExplorer;
