/**
 * Completion model — what can be typed at a cursor offset, as data:
 * fields of the enclosing selection's type (with `__typename` and the
 * query root's `__schema` / `__type`), a field's or directive's
 * remaining arguments, an input object's remaining fields, enum
 * values and `true` / `false`, the operation's variables, fragment
 * names after `...`, composite type names after `on`, directive
 * names after `@`, input type names in variable definitions, and the
 * SDL positions (field / argument types, `implements`, union members,
 * directive locations). Monaco binds it later; the spec editor and the
 * builder read the same model.
 *
 * The context is inferred by a tolerant token walk with a frame stack
 * — a document under edit rarely parses, so no AST is required. The
 * schema is optional: without one, fragments, variables and keywords
 * still complete.
 */

import { type Token, tokenize } from './lexer';
import {
  fieldsOf,
  type GraphqlDirective,
  type GraphqlField,
  type GraphqlInputValue,
  type GraphqlNamedType,
  type GraphqlSchema,
  type GraphqlTypeRef,
  isCompositeType,
  isInputType,
  isIntrospectionName,
  namedTypeOf,
  printTypeRef,
  rootTypeName,
} from './schema';
import { DIRECTIVE_LOCATIONS, type OperationType, type Span } from './types';

export type CompletionKind =
  | 'field'
  | 'argument'
  | 'input-field'
  | 'enum-value'
  | 'boolean'
  | 'variable'
  | 'fragment'
  | 'type'
  | 'directive'
  | 'keyword'
  | 'directive-location';

export interface CompletionItem {
  readonly kind: CompletionKind;
  readonly label: string;
  /** A type signature or the like, shown beside the label. */
  readonly detail: string | null;
  readonly description: string | null;
  readonly deprecationReason: string | null;
  /** What to insert when it differs from the label (`$name`, `...name`). */
  readonly insertText: string | null;
}

export interface CompletionResult {
  readonly items: readonly CompletionItem[];
  /** The word under the cursor (what a bound editor replaces). */
  readonly replace: Span;
  readonly prefix: string;
}

const NO_COMPLETIONS: CompletionResult = { items: [], replace: { start: 0, end: 0 }, prefix: '' };

type Frame =
  | { readonly kind: 'document' }
  | { kind: 'operation'; readonly operation: OperationType; sawName: boolean }
  | { kind: 'variableDefinitions'; expect: 'dollar' | 'name' | 'colon' | 'type' | 'afterType' | 'default' }
  | {
      kind: 'selectionSet';
      readonly parent: GraphqlNamedType | null;
      readonly isQueryRoot: boolean;
      lastField: GraphqlField | null;
      afterAlias: boolean;
    }
  | {
      kind: 'arguments';
      readonly args: readonly GraphqlInputValue[] | null;
      readonly given: Set<string>;
      lastArg: GraphqlInputValue | null;
      expectValue: boolean;
    }
  | { kind: 'listValue'; readonly element: GraphqlTypeRef | null }
  | {
      kind: 'objectValue';
      readonly type: GraphqlNamedType | null;
      readonly given: Set<string>;
      lastField: GraphqlInputValue | null;
      expectValue: boolean;
    }
  | { kind: 'spread'; sawOn: boolean; readonly parent: GraphqlNamedType | null }
  | { kind: 'fragmentDefinition'; expect: 'name' | 'on' | 'type' | 'body' }
  | { kind: 'directive'; readonly definition: GraphqlDirective | null; sawName: boolean }
  | { kind: 'typeRef'; readonly role: 'input' | 'output' | 'interface' | 'object' }
  | {
      kind: 'sdlDefinition';
      readonly keyword: string;
      sawName: boolean;
      expect: 'name' | 'afterName' | 'implements' | 'members' | 'locations';
    }
  | {
      kind: 'sdlBody';
      readonly keyword: string;
      expect: 'fieldName' | 'afterFieldName' | 'colon' | 'type' | 'afterType' | 'default';
    }
  | { kind: 'sdlArguments'; expect: 'name' | 'colon' | 'type' | 'afterType' | 'default' };

interface WalkState {
  readonly stack: Frame[];
  /** Variables declared by the operation the cursor sits in. */
  readonly variables: Map<string, string>;
  readonly fragments: Map<string, string>;
}

function top(state: WalkState): Frame {
  return state.stack[state.stack.length - 1];
}

function unwrapNamed(schema: GraphqlSchema | null, type: GraphqlTypeRef | null): GraphqlNamedType | null {
  if (type === null || schema === null) return null;
  return schema.types.get(namedTypeOf(type)) ?? null;
}

/** After `[`, the element type the list expects. */
function listElement(type: GraphqlTypeRef | null): GraphqlTypeRef | null {
  if (type === null) return null;
  const inner = type.kind === 'NON_NULL' ? type.ofType : type;
  return inner.kind === 'LIST' ? inner.ofType : inner;
}

/** The input type a value at the top frame is expected to have. */
function expectedValueType(state: WalkState): GraphqlTypeRef | null {
  const frame = top(state);
  switch (frame.kind) {
    case 'arguments':
      return frame.lastArg?.type ?? null;
    case 'objectValue':
      return frame.lastField?.type ?? null;
    case 'listValue':
      return frame.element;
    default:
      return null;
  }
}

class ContextWalker {
  readonly state: WalkState;
  private pendingVariable: string | null = null;
  private typeStart = 0;

  constructor(
    private readonly schema: GraphqlSchema | null,
    private readonly source: string,
    tokens: readonly Token[],
  ) {
    const fragments = new Map<string, string>();
    for (let i = 0; i + 3 < tokens.length; i++) {
      const t = tokens[i];
      if (
        t.kind === 'name' &&
        t.value === 'fragment' &&
        tokens[i + 1].kind === 'name' &&
        tokens[i + 2].value === 'on'
      ) {
        fragments.set(tokens[i + 1].value, tokens[i + 3].value);
      }
    }
    this.state = { stack: [{ kind: 'document' }], variables: new Map(), fragments };
  }

  private push(frame: Frame): void {
    this.state.stack.push(frame);
  }

  private pop(): void {
    if (this.state.stack.length > 1) this.state.stack.pop();
  }

  private popValueFrames(): void {
    while (top(this.state).kind === 'listValue' || top(this.state).kind === 'objectValue') this.pop();
  }

  private rootType(operation: OperationType): GraphqlNamedType | null {
    if (this.schema === null) return null;
    const name = rootTypeName(this.schema, operation);
    return name === null ? null : (this.schema.types.get(name) ?? null);
  }

  private closeValue(): void {
    const frame = top(this.state);
    if (frame.kind === 'arguments') {
      frame.expectValue = false;
      frame.lastArg = null;
    } else if (frame.kind === 'objectValue') {
      frame.expectValue = false;
      frame.lastField = null;
    }
  }

  private closeDirectiveIfOpen(): void {
    const frame = top(this.state);
    if (frame.kind === 'directive') this.pop();
  }

  feed(token: Token): void {
    const frame = top(this.state);
    const text = token.value;
    switch (frame.kind) {
      case 'document':
        this.feedDocument(token);
        return;
      case 'operation':
        if (token.kind === 'name' && !frame.sawName) {
          frame.sawName = true;
        } else if (text === '(') {
          this.push({ kind: 'variableDefinitions', expect: 'dollar' });
        } else if (text === '@') {
          this.push({ kind: 'directive', definition: null, sawName: false });
        } else if (text === '{') {
          this.pop();
          this.push({
            kind: 'selectionSet',
            parent: this.rootType(frame.operation),
            isQueryRoot: frame.operation === 'query',
            lastField: null,
            afterAlias: false,
          });
        } else if (text === '}') {
          this.pop();
        }
        return;
      case 'variableDefinitions':
        this.feedVariableDefinitions(frame, token);
        return;
      case 'selectionSet':
        this.feedSelectionSet(frame, token);
        return;
      case 'arguments':
        this.feedArguments(frame, token);
        return;
      case 'listValue':
      case 'objectValue':
        this.feedValue(token);
        return;
      case 'spread':
        if (token.kind === 'name' && text === 'on' && !frame.sawOn) {
          frame.sawOn = true;
        } else if (token.kind === 'name') {
          if (frame.sawOn) {
            const type = this.schema?.types.get(text) ?? null;
            this.pop();
            this.push({ kind: 'spread', sawOn: true, parent: type ?? frame.parent });
          } else {
            this.pop();
          }
        } else if (text === '@') {
          this.push({ kind: 'directive', definition: null, sawName: false });
        } else if (text === '{') {
          this.pop();
          this.push({
            kind: 'selectionSet',
            parent: frame.parent,
            isQueryRoot: false,
            lastField: null,
            afterAlias: false,
          });
        } else {
          this.pop();
          this.feed(token);
        }
        return;
      case 'fragmentDefinition':
        if (frame.expect === 'name' && token.kind === 'name') frame.expect = 'on';
        else if (frame.expect === 'on' && text === 'on') frame.expect = 'type';
        else if (frame.expect === 'type' && token.kind === 'name') {
          frame.expect = 'body';
          const type = this.schema?.types.get(text) ?? null;
          this.pop();
          this.push({ kind: 'spread', sawOn: true, parent: type });
        } else if (text === '{') {
          this.pop();
          this.push({ kind: 'selectionSet', parent: null, isQueryRoot: false, lastField: null, afterAlias: false });
        }
        return;
      case 'directive':
        if (token.kind === 'name' && !frame.sawName) {
          frame.sawName = true;
          const definition = this.schema?.directives.find((entry) => entry.name === text) ?? null;
          this.pop();
          this.push({ kind: 'directive', definition, sawName: true });
        } else if (text === '(' && frame.sawName) {
          this.push({
            kind: 'arguments',
            args: frame.definition?.args ?? null,
            given: new Set(),
            lastArg: null,
            expectValue: false,
          });
        } else {
          this.pop();
          this.feed(token);
        }
        return;
      case 'typeRef':
        if (text === '[') {
          this.push({ kind: 'typeRef', role: frame.role });
        } else if (text === ']') {
          this.pop();
          if (top(this.state).kind !== 'typeRef') this.feedAfterType();
        } else if (token.kind === 'name') {
          this.pop();
          if (top(this.state).kind !== 'typeRef') this.feedAfterType();
        } else if (text === '!') {
          // stays on the same type
        } else {
          this.pop();
          this.feed(token);
        }
        return;
      case 'sdlDefinition':
        this.feedSdlDefinition(frame, token);
        return;
      case 'sdlBody':
        this.feedSdlBody(frame, token);
        return;
      case 'sdlArguments':
        this.feedSdlArguments(frame, token);
        return;
    }
  }

  /** A type reference just closed — advance the frame that asked for it. */
  private feedAfterType(): void {
    const frame = top(this.state);
    if (frame.kind === 'variableDefinitions') frame.expect = 'afterType';
    else if (frame.kind === 'sdlBody') frame.expect = 'afterType';
    else if (frame.kind === 'sdlArguments') frame.expect = 'afterType';
  }

  private feedDocument(token: Token): void {
    const text = token.value;
    if (text === '{') {
      this.push({
        kind: 'selectionSet',
        parent: this.rootType('query'),
        isQueryRoot: true,
        lastField: null,
        afterAlias: false,
      });
      return;
    }
    if (token.kind !== 'name') return;
    switch (text) {
      case 'query':
      case 'mutation':
      case 'subscription':
        this.state.variables.clear();
        this.push({ kind: 'operation', operation: text, sawName: false });
        return;
      case 'fragment':
        this.state.variables.clear();
        this.push({ kind: 'fragmentDefinition', expect: 'name' });
        return;
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'directive':
        this.push({
          kind: 'sdlDefinition',
          keyword: text,
          sawName: false,
          expect: text === 'schema' ? 'afterName' : 'name',
        });
        return;
      case 'extend':
        return;
      default:
        return;
    }
  }

  private feedVariableDefinitions(frame: Extract<Frame, { kind: 'variableDefinitions' }>, token: Token): void {
    const text = token.value;
    if (text === ')') {
      this.pop();
      return;
    }
    switch (frame.expect) {
      case 'dollar':
        if (text === '$') frame.expect = 'name';
        return;
      case 'name':
        if (token.kind === 'name') {
          frame.expect = 'colon';
          this.state.variables.set(text, '');
          this.pendingVariable = text;
        }
        return;
      case 'colon':
        if (text === ':') {
          frame.expect = 'type';
          this.typeStart = token.end;
        }
        return;
      case 'type':
        this.push({ kind: 'typeRef', role: 'input' });
        this.feed(token);
        return;
      case 'afterType':
        if (this.pendingVariable !== null) {
          this.state.variables.set(
            this.pendingVariable,
            this.source
              .slice(this.typeStart, token.start)
              .replace(/[\s,]+$/, '')
              .trim(),
          );
          this.pendingVariable = null;
        }
        if (text === '=') frame.expect = 'default';
        else if (text === '$') frame.expect = 'name';
        else if (text === '@') this.push({ kind: 'directive', definition: null, sawName: false });
        return;
      case 'default':
        if (text === '[' || text === '{') {
          this.push(
            text === '['
              ? { kind: 'listValue', element: null }
              : { kind: 'objectValue', type: null, given: new Set(), lastField: null, expectValue: false },
          );
        } else if (text === '$') {
          frame.expect = 'name';
        } else if (text === '@') {
          this.push({ kind: 'directive', definition: null, sawName: false });
          frame.expect = 'afterType';
        } else {
          frame.expect = 'afterType';
        }
        return;
    }
  }

  private feedSelectionSet(frame: Extract<Frame, { kind: 'selectionSet' }>, token: Token): void {
    const text = token.value;
    if (text === '}') {
      this.pop();
      return;
    }
    if (text === '...') {
      frame.lastField = null;
      this.push({ kind: 'spread', sawOn: false, parent: frame.parent });
      return;
    }
    if (text === '(' && frame.lastField !== null) {
      this.push({ kind: 'arguments', args: frame.lastField.args, given: new Set(), lastArg: null, expectValue: false });
      return;
    }
    if (text === '(') {
      this.push({ kind: 'arguments', args: null, given: new Set(), lastArg: null, expectValue: false });
      return;
    }
    if (text === '@') {
      this.push({ kind: 'directive', definition: null, sawName: false });
      return;
    }
    if (text === '{') {
      const child = frame.lastField === null ? null : unwrapNamed(this.schema, frame.lastField.type);
      frame.lastField = null;
      this.push({ kind: 'selectionSet', parent: child, isQueryRoot: false, lastField: null, afterAlias: false });
      return;
    }
    if (text === ':') {
      frame.afterAlias = true;
      frame.lastField = null;
      return;
    }
    if (token.kind === 'name') {
      frame.afterAlias = false;
      frame.lastField = this.fieldNamed(frame, text);
    }
  }

  private fieldNamed(frame: Extract<Frame, { kind: 'selectionSet' }>, name: string): GraphqlField | null {
    if (name === '__typename') return null;
    if (frame.isQueryRoot && this.schema !== null) {
      if (name === '__schema') return this.introspectionField('__schema', '__Schema', []);
      if (name === '__type') {
        return this.introspectionField('__type', '__Type', [
          {
            name: 'name',
            description: null,
            type: { kind: 'NON_NULL', ofType: { kind: 'NAMED', name: 'String' } },
            defaultValue: null,
            deprecationReason: null,
          },
        ]);
      }
    }
    return fieldsOf(frame.parent ?? undefined).find((entry) => entry.name === name) ?? null;
  }

  private introspectionField(name: string, typeName: string, args: GraphqlInputValue[]): GraphqlField {
    return { name, description: null, args, type: { kind: 'NAMED', name: typeName }, deprecationReason: null };
  }

  private feedArguments(frame: Extract<Frame, { kind: 'arguments' }>, token: Token): void {
    const text = token.value;
    if (text === ')') {
      this.pop();
      this.closeDirectiveIfOpen();
      return;
    }
    if (frame.expectValue) {
      this.feedValue(token);
      return;
    }
    if (token.kind === 'name') {
      frame.lastArg = frame.args?.find((entry) => entry.name === text) ?? null;
      frame.given.add(text);
      return;
    }
    if (text === ':') frame.expectValue = true;
  }

  /** A value token in an arguments / object-value / list frame. */
  private feedValue(token: Token): void {
    const frame = top(this.state);
    const text = token.value;
    if (frame.kind === 'objectValue' && !frame.expectValue) {
      if (text === '}') {
        this.pop();
        this.closeValue();
      } else if (token.kind === 'name') {
        const fields = frame.type !== null && frame.type.kind === 'INPUT_OBJECT' ? frame.type.inputFields : null;
        frame.lastField = fields?.find((entry) => entry.name === text) ?? null;
        frame.given.add(text);
      } else if (text === ':') {
        frame.expectValue = true;
      }
      return;
    }
    if (text === '[') {
      this.push({ kind: 'listValue', element: listElement(expectedValueType(this.state)) });
      return;
    }
    if (text === '{') {
      const type = unwrapNamed(this.schema, expectedValueType(this.state));
      this.push({ kind: 'objectValue', type, given: new Set(), lastField: null, expectValue: false });
      return;
    }
    if (text === ']') {
      if (frame.kind === 'listValue') this.pop();
      this.closeValue();
      return;
    }
    if (text === '}') {
      if (frame.kind === 'objectValue') this.pop();
      this.closeValue();
      return;
    }
    if (text === ')') {
      this.popValueFrames();
      this.feed(token);
      return;
    }
    if (text === '$') return;
    // A scalar / enum / variable-name token completes the value.
    if (frame.kind !== 'listValue') this.closeValue();
  }

  private feedSdlDefinition(frame: Extract<Frame, { kind: 'sdlDefinition' }>, token: Token): void {
    const text = token.value;
    switch (frame.expect) {
      case 'name':
        if (text === '@' && frame.keyword === 'directive') return;
        if (token.kind === 'name') {
          frame.sawName = true;
          frame.expect = 'afterName';
        }
        return;
      case 'afterName':
        if (text === 'implements') frame.expect = 'implements';
        else if (text === '=' && frame.keyword === 'union') frame.expect = 'members';
        else if (text === 'on' && frame.keyword === 'directive') frame.expect = 'locations';
        else if (text === '(' && frame.keyword === 'directive') this.push({ kind: 'sdlArguments', expect: 'name' });
        else if (text === '@') this.push({ kind: 'directive', definition: null, sawName: false });
        else if (text === '{') {
          this.pop();
          this.push({ kind: 'sdlBody', keyword: frame.keyword, expect: 'fieldName' });
        } else if (token.kind === 'name') {
          // A new definition keyword ends a body-less definition.
          this.pop();
          this.feedDocument(token);
        }
        return;
      case 'implements':
        if (text === '&' || token.kind === 'name') return;
        frame.expect = 'afterName';
        this.feed(token);
        return;
      case 'members':
        if (text === '|' || token.kind === 'name') return;
        this.pop();
        this.feed(token);
        return;
      case 'locations':
        if (text === '|' || token.kind === 'name') return;
        this.pop();
        this.feed(token);
        return;
    }
  }

  private feedSdlBody(frame: Extract<Frame, { kind: 'sdlBody' }>, token: Token): void {
    const text = token.value;
    if (text === '}') {
      this.pop();
      return;
    }
    if (token.kind === 'string' || token.kind === 'blockString') return;
    switch (frame.expect) {
      case 'fieldName':
        if (token.kind === 'name') frame.expect = frame.keyword === 'enum' ? 'fieldName' : 'afterFieldName';
        return;
      case 'afterFieldName':
        if (text === '(') this.push({ kind: 'sdlArguments', expect: 'name' });
        else if (text === ':') frame.expect = 'type';
        else if (text === '@') this.push({ kind: 'directive', definition: null, sawName: false });
        else if (token.kind === 'name') frame.expect = 'afterFieldName';
        return;
      case 'colon':
        if (text === ':') frame.expect = 'type';
        return;
      case 'type':
        this.push({ kind: 'typeRef', role: frame.keyword === 'input' ? 'input' : 'output' });
        this.feed(token);
        return;
      case 'afterType':
        if (text === '=') frame.expect = 'default';
        else if (text === '@') this.push({ kind: 'directive', definition: null, sawName: false });
        else if (token.kind === 'name') frame.expect = 'afterFieldName';
        return;
      case 'default':
        if (text === '[' || text === '{') {
          this.push(
            text === '['
              ? { kind: 'listValue', element: null }
              : { kind: 'objectValue', type: null, given: new Set(), lastField: null, expectValue: false },
          );
        }
        frame.expect = 'afterType';
        return;
    }
  }

  private feedSdlArguments(frame: Extract<Frame, { kind: 'sdlArguments' }>, token: Token): void {
    const text = token.value;
    if (text === ')') {
      this.pop();
      const parent = top(this.state);
      if (parent.kind === 'sdlBody') parent.expect = 'colon';
      return;
    }
    if (token.kind === 'string' || token.kind === 'blockString') return;
    switch (frame.expect) {
      case 'name':
        if (token.kind === 'name') frame.expect = 'colon';
        return;
      case 'colon':
        if (text === ':') frame.expect = 'type';
        return;
      case 'type':
        this.push({ kind: 'typeRef', role: 'input' });
        this.feed(token);
        return;
      case 'afterType':
        if (text === '=') frame.expect = 'default';
        else if (text === '@') this.push({ kind: 'directive', definition: null, sawName: false });
        else if (token.kind === 'name') frame.expect = 'colon';
        return;
      case 'default':
        if (text === '[' || text === '{') {
          this.push(
            text === '['
              ? { kind: 'listValue', element: null }
              : { kind: 'objectValue', type: null, given: new Set(), lastField: null, expectValue: false },
          );
        }
        frame.expect = 'afterType';
        return;
    }
  }
}

// ── Items ──────────────────────────────────────────────────────────

function item(
  kind: CompletionKind,
  label: string,
  detail: string | null = null,
  description: string | null = null,
  deprecationReason: string | null = null,
  insertText: string | null = null,
): CompletionItem {
  return { kind, label, detail, description, deprecationReason, insertText };
}

function fieldItems(fields: readonly GraphqlField[]): CompletionItem[] {
  return fields.map((field) => {
    const args =
      field.args.length === 0
        ? ''
        : `(${field.args.map((arg) => `${arg.name}: ${printTypeRef(arg.type)}`).join(', ')})`;
    return item(
      'field',
      field.name,
      `${args}: ${printTypeRef(field.type)}`,
      field.description,
      field.deprecationReason,
    );
  });
}

function inputValueItems(
  kind: 'argument' | 'input-field',
  values: readonly GraphqlInputValue[],
  given: ReadonlySet<string>,
): CompletionItem[] {
  return values
    .filter((value) => !given.has(value.name))
    .map((value) => {
      const defaultValue = value.defaultValue === null ? '' : ` = ${value.defaultValue}`;
      return item(
        kind,
        value.name,
        `${printTypeRef(value.type)}${defaultValue}`,
        value.description,
        value.deprecationReason,
      );
    });
}

function typeItems(schema: GraphqlSchema | null, accept: (type: GraphqlNamedType) => boolean): CompletionItem[] {
  if (schema === null) return [];
  const out: CompletionItem[] = [];
  for (const type of schema.types.values()) {
    if (isIntrospectionName(type.name) || !accept(type)) continue;
    out.push(item('type', type.name, type.kind.toLowerCase().replace('_', ' '), type.description));
  }
  return out;
}

function valueItems(
  schema: GraphqlSchema | null,
  expected: GraphqlTypeRef | null,
  variables: ReadonlyMap<string, string>,
): CompletionItem[] {
  const out: CompletionItem[] = [];
  const type = unwrapNamed(schema, expected);
  if (type !== null && type.kind === 'ENUM') {
    for (const value of type.values)
      out.push(item('enum-value', value.name, type.name, value.description, value.deprecationReason));
  } else if (type !== null && type.kind === 'SCALAR' && type.name === 'Boolean') {
    out.push(item('boolean', 'true', 'Boolean'), item('boolean', 'false', 'Boolean'));
  }
  for (const [name, typeText] of variables) out.push(item('variable', `$${name}`, typeText === '' ? null : typeText));
  return out;
}

function directiveItems(schema: GraphqlSchema | null, location: string | null): CompletionItem[] {
  if (schema === null) return [];
  return schema.directives
    .filter((directive) => location === null || directive.locations.includes(location))
    .map((directive) => {
      const args =
        directive.args.length === 0
          ? ''
          : `(${directive.args.map((arg) => `${arg.name}: ${printTypeRef(arg.type)}`).join(', ')})`;
      return item('directive', directive.name, args === '' ? null : args, directive.description);
    });
}

function directiveLocationFor(state: WalkState): string | null {
  const below = state.stack[state.stack.length - 2];
  if (below === undefined) return null;
  switch (below.kind) {
    case 'selectionSet':
      return 'FIELD';
    case 'operation':
      return below.operation.toUpperCase();
    case 'spread':
      return below.sawOn ? 'INLINE_FRAGMENT' : 'FRAGMENT_SPREAD';
    case 'fragmentDefinition':
      return 'FRAGMENT_DEFINITION';
    case 'variableDefinitions':
      return 'VARIABLE_DEFINITION';
    case 'sdlDefinition':
      return below.keyword === 'type'
        ? 'OBJECT'
        : below.keyword === 'input'
          ? 'INPUT_OBJECT'
          : below.keyword.toUpperCase();
    case 'sdlBody':
      return below.keyword === 'enum'
        ? 'ENUM_VALUE'
        : below.keyword === 'input'
          ? 'INPUT_FIELD_DEFINITION'
          : 'FIELD_DEFINITION';
    case 'sdlArguments':
      return 'ARGUMENT_DEFINITION';
    default:
      return null;
  }
}

function itemsFor(state: WalkState, schema: GraphqlSchema | null, lastToken: Token | null): CompletionItem[] {
  const frame = top(state);
  switch (frame.kind) {
    case 'document':
      return [
        item('keyword', 'query'),
        item('keyword', 'mutation'),
        item('keyword', 'subscription'),
        item('keyword', 'fragment'),
        item('keyword', '{', null, 'Anonymous query'),
      ];
    case 'operation':
      return [];
    case 'selectionSet': {
      if (frame.afterAlias) return fieldItems(fieldsOf(frame.parent ?? undefined));
      const out = fieldItems(fieldsOf(frame.parent ?? undefined));
      if (frame.parent !== null) {
        out.push(item('field', '__typename', ': String!', 'The name of the object type this resolved to.'));
      }
      if (frame.isQueryRoot && schema !== null) {
        out.push(
          item('field', '__schema', ': __Schema!', 'Introspection — the schema.'),
          item('field', '__type', '(name: String!): __Type', 'Introspection — one type by name.'),
        );
      }
      return out;
    }
    case 'arguments':
      return frame.expectValue
        ? valueItems(schema, frame.lastArg?.type ?? null, state.variables)
        : inputValueItems('argument', frame.args ?? [], frame.given);
    case 'objectValue': {
      if (frame.expectValue) return valueItems(schema, frame.lastField?.type ?? null, state.variables);
      const fields = frame.type !== null && frame.type.kind === 'INPUT_OBJECT' ? frame.type.inputFields : [];
      return inputValueItems('input-field', fields, frame.given);
    }
    case 'listValue':
      return valueItems(schema, frame.element, state.variables);
    case 'spread': {
      if (frame.sawOn) {
        if (lastToken !== null && lastToken.value !== 'on' && lastToken.kind === 'name') return [];
        return typeItems(schema, isCompositeType);
      }
      const out: CompletionItem[] = [item('keyword', 'on', null, 'Inline fragment on a type')];
      for (const [name, typeCondition] of state.fragments) out.push(item('fragment', name, `on ${typeCondition}`));
      return out;
    }
    case 'fragmentDefinition':
      return frame.expect === 'type' ? typeItems(schema, isCompositeType) : [];
    case 'directive':
      return frame.sawName ? [] : directiveItems(schema, directiveLocationFor(state));
    case 'variableDefinitions':
      return frame.expect === 'type'
        ? typeItems(schema, isInputType)
        : frame.expect === 'default'
          ? valueItems(schema, null, new Map())
          : [];
    case 'typeRef':
      switch (frame.role) {
        case 'input':
          return typeItems(schema, isInputType);
        case 'output':
          return typeItems(schema, (type) => type.kind !== 'INPUT_OBJECT');
        case 'interface':
          return typeItems(schema, (type) => type.kind === 'INTERFACE');
        case 'object':
          return typeItems(schema, (type) => type.kind === 'OBJECT');
      }
      return [];
    case 'sdlDefinition':
      if (frame.expect === 'implements') return typeItems(schema, (type) => type.kind === 'INTERFACE');
      if (frame.expect === 'members') return typeItems(schema, (type) => type.kind === 'OBJECT');
      if (frame.expect === 'locations')
        return DIRECTIVE_LOCATIONS.map((location) => item('directive-location', location));
      if (frame.expect === 'afterName') return [item('keyword', 'implements')];
      return [];
    case 'sdlBody':
      return frame.expect === 'type'
        ? typeItems(schema, frame.keyword === 'input' ? isInputType : (type) => type.kind !== 'INPUT_OBJECT')
        : [];
    case 'sdlArguments':
      return frame.expect === 'type' ? typeItems(schema, isInputType) : [];
  }
}

/**
 * Completions at a character offset of a source. The word under the
 * cursor is NOT used to filter — `replace` and `prefix` let the bound
 * editor do that with its own matching.
 */
export function completionsAt(source: string, offset: number, schema: GraphqlSchema | null): CompletionResult {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const { tokens } = tokenize(source);
  // Inside a string or comment nothing completes.
  for (const token of tokens) {
    if ((token.kind === 'string' || token.kind === 'blockString') && token.start < clamped && clamped < token.end) {
      return NO_COMPLETIONS;
    }
  }
  const lineStart = source.lastIndexOf('\n', clamped - 1) + 1;
  const hash = source.indexOf('#', lineStart);
  if (hash !== -1 && hash < clamped && !insideString(tokens, hash)) return NO_COMPLETIONS;

  let replace: Span = { start: clamped, end: clamped };
  let prefix = '';
  const before: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'eof') break;
    if (token.end <= clamped) {
      if (token.kind === 'name' && token.end === clamped) {
        replace = { start: token.start, end: token.end };
        prefix = token.value;
        continue;
      }
      before.push(token);
      continue;
    }
    if (token.start < clamped) {
      if (token.kind === 'name' || token.kind === 'int' || token.kind === 'float') {
        replace = { start: token.start, end: token.end };
        prefix = source.slice(token.start, clamped);
      }
    }
    break;
  }
  // A `$` directly before the word completes variables — keep it out of
  // the replacement so `$na` → `$name` inserts cleanly.
  const dollar = before[before.length - 1];
  if (dollar !== undefined && dollar.kind === 'punct' && dollar.value === '$' && dollar.end === replace.start) {
    before.pop();
    replace = { start: dollar.start, end: replace.end };
    prefix = `$${prefix}`;
  }
  const walker = new ContextWalker(schema, source, tokens);
  for (const token of before) walker.feed(token);
  const lastToken = before.length > 0 ? before[before.length - 1] : null;
  return { items: itemsFor(walker.state, schema, lastToken), replace, prefix };
}

function insideString(tokens: readonly Token[], offset: number): boolean {
  return tokens.some(
    (token) => (token.kind === 'string' || token.kind === 'blockString') && token.start < offset && offset < token.end,
  );
}
