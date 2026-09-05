/**
 * GraphQL parser — one recursive descent over the spec's grammar
 * summary, producing the AST in `types.ts`. Executable definitions
 * (operations, fragments) and type-system definitions (schema, the six
 * type kinds, directives, every extension form) parse from the same
 * entry point: a Document holds either or both, and the validator
 * decides what the surface accepts.
 *
 * The public boundary never throws — `parseDocument` reports the first
 * syntax error with its span and a null document (the proto parser's
 * position-in-message contract, widened to editor markers).
 */

import { Lexer, type Token } from './lexer';
import type {
  ArgumentNode,
  ConstValueNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  FragmentDefinitionNode,
  GraphqlError,
  InputValueDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  NameNode,
  ObjectFieldNode,
  OperationDefinitionNode,
  OperationType,
  OperationTypeDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  StringValueNode,
  TypeNode,
  ValueNode,
  VariableDefinitionNode,
  VariableNode,
} from './types';
import { GraphqlSyntaxError } from './types';

export interface ParseResult {
  readonly document: DocumentNode | null;
  readonly errors: readonly GraphqlError[];
}

const OPERATION_TYPES: ReadonlySet<string> = new Set(['query', 'mutation', 'subscription']);

function isOperationType(value: string): value is OperationType {
  return OPERATION_TYPES.has(value);
}

class Parser {
  private readonly lexer: Lexer;
  private last: Token;

  constructor(source: string) {
    this.lexer = new Lexer(source);
    this.last = { kind: 'eof', value: '', start: 0, end: 0 };
  }

  private peek(): Token {
    return this.lexer.peek();
  }

  private next(): Token {
    this.last = this.lexer.next();
    return this.last;
  }

  private fail(message: string, token: Token): never {
    throw new GraphqlSyntaxError(message, token.start, token.kind === 'eof' ? token.start : token.end);
  }

  private describe(token: Token): string {
    if (token.kind === 'eof') return 'end of input';
    if (token.kind === 'string' || token.kind === 'blockString') return 'a string';
    return `\`${token.value}\``;
  }

  private isPunct(value: string): boolean {
    const token = this.peek();
    return token.kind === 'punct' && token.value === value;
  }

  private isKeyword(value: string): boolean {
    const token = this.peek();
    return token.kind === 'name' && token.value === value;
  }

  private eatPunct(value: string): boolean {
    if (!this.isPunct(value)) return false;
    this.next();
    return true;
  }

  private expectPunct(value: string): Token {
    const token = this.peek();
    if (token.kind !== 'punct' || token.value !== value) {
      this.fail(`Expected \`${value}\` but found ${this.describe(token)}.`, token);
    }
    return this.next();
  }

  private expectKeyword(value: string): Token {
    const token = this.peek();
    if (token.kind !== 'name' || token.value !== value) {
      this.fail(`Expected \`${value}\` but found ${this.describe(token)}.`, token);
    }
    return this.next();
  }

  private name(): NameNode {
    const token = this.peek();
    if (token.kind !== 'name') this.fail(`Expected a name but found ${this.describe(token)}.`, token);
    this.next();
    return { kind: 'Name', value: token.value, start: token.start, end: token.end };
  }

  /** `( … )` / `{ … }` / `[ … ]` bodies — at least one item. */
  private many<T>(open: string, item: () => T, close: string): T[] {
    this.expectPunct(open);
    const items: T[] = [item()];
    while (!this.eatPunct(close)) items.push(item());
    return items;
  }

  /** Like `many`, but the delimited list may be absent entirely. */
  private optionalMany<T>(open: string, item: () => T, close: string): T[] {
    return this.isPunct(open) ? this.many(open, item, close) : [];
  }

  /** `{ … }` bodies that may be empty (SDL field lists). */
  private optionalBlock<T>(item: () => T): T[] {
    if (!this.eatPunct('{')) return [];
    const items: T[] = [];
    while (!this.eatPunct('}')) items.push(item());
    return items;
  }

  // ── Document ──────────────────────────────────────────────────

  document(): DocumentNode {
    const definitions: DefinitionNode[] = [];
    const first = this.peek();
    while (this.peek().kind !== 'eof') definitions.push(this.definition());
    if (definitions.length === 0) this.fail('Expected a definition but found end of input.', first);
    return { kind: 'Document', definitions, start: first.start, end: this.last.end };
  }

  private definition(): DefinitionNode {
    const token = this.peek();
    if (token.kind === 'punct' && token.value === '{') return this.operationDefinition();
    const description = this.description();
    const keyword = this.peek();
    if (keyword.kind !== 'name') this.fail(`Expected a definition but found ${this.describe(keyword)}.`, keyword);
    switch (keyword.value) {
      case 'query':
      case 'mutation':
      case 'subscription':
        if (description !== null) this.fail('An operation cannot carry a description.', token);
        return this.operationDefinition();
      case 'fragment':
        if (description !== null) this.fail('A fragment cannot carry a description.', token);
        return this.fragmentDefinition();
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'directive':
        return this.typeSystemDefinition(token, description);
      case 'extend':
        if (description !== null) this.fail('An extension cannot carry a description.', token);
        return this.typeSystemExtension();
      default:
        this.fail(`Unexpected ${this.describe(keyword)}.`, keyword);
    }
  }

  // ── Executable definitions ────────────────────────────────────

  private operationDefinition(): OperationDefinitionNode {
    const start = this.peek();
    if (start.kind === 'punct' && start.value === '{') {
      const selectionSet = this.selectionSet();
      return {
        kind: 'OperationDefinition',
        operation: 'query',
        name: null,
        variableDefinitions: [],
        directives: [],
        selectionSet,
        start: start.start,
        end: selectionSet.end,
      };
    }
    const keyword = this.next();
    if (keyword.kind !== 'name' || !isOperationType(keyword.value)) {
      this.fail(`Expected an operation type but found ${this.describe(keyword)}.`, keyword);
    }
    const name = this.peek().kind === 'name' ? this.name() : null;
    const variableDefinitions = this.optionalMany('(', () => this.variableDefinition(), ')');
    const directives = this.directives(false);
    const selectionSet = this.selectionSet();
    return {
      kind: 'OperationDefinition',
      operation: keyword.value,
      name,
      variableDefinitions,
      directives,
      selectionSet,
      start: keyword.start,
      end: selectionSet.end,
    };
  }

  private variableDefinition(): VariableDefinitionNode {
    const start = this.peek();
    const variable = this.variable();
    this.expectPunct(':');
    const type = this.type();
    const defaultValue = this.eatPunct('=') ? this.constValue() : null;
    const directives = this.directives(true);
    return {
      kind: 'VariableDefinition',
      variable,
      type,
      defaultValue,
      directives,
      start: start.start,
      end: this.last.end,
    };
  }

  private variable(): VariableNode {
    const dollar = this.expectPunct('$');
    const name = this.name();
    return { kind: 'Variable', name, start: dollar.start, end: name.end };
  }

  private selectionSet(): SelectionSetNode {
    const open = this.expectPunct('{');
    const selections: SelectionNode[] = [this.selection()];
    while (!this.isPunct('}')) {
      if (this.peek().kind === 'eof') this.fail('Expected `}` but found end of input.', this.peek());
      selections.push(this.selection());
    }
    const close = this.next();
    return { kind: 'SelectionSet', selections, start: open.start, end: close.end };
  }

  private selection(): SelectionNode {
    if (this.isPunct('...')) return this.fragment();
    const start = this.peek();
    let name = this.name();
    let alias: NameNode | null = null;
    if (this.eatPunct(':')) {
      alias = name;
      name = this.name();
    }
    const args = this.arguments_(false);
    const directives = this.directives(false);
    const selectionSet = this.isPunct('{') ? this.selectionSet() : null;
    return {
      kind: 'Field',
      alias,
      name,
      arguments: args,
      directives,
      selectionSet,
      start: start.start,
      end: this.last.end,
    };
  }

  private fragment(): SelectionNode {
    const spread = this.expectPunct('...');
    const hasTypeCondition = this.isKeyword('on');
    if (!hasTypeCondition && this.peek().kind === 'name') {
      const name = this.name();
      const directives = this.directives(false);
      return { kind: 'FragmentSpread', name, directives, start: spread.start, end: this.last.end };
    }
    let typeCondition: NamedTypeNode | null = null;
    if (hasTypeCondition) {
      this.next();
      typeCondition = this.namedType();
    }
    const directives = this.directives(false);
    const selectionSet = this.selectionSet();
    return {
      kind: 'InlineFragment',
      typeCondition,
      directives,
      selectionSet,
      start: spread.start,
      end: selectionSet.end,
    };
  }

  private fragmentDefinition(): FragmentDefinitionNode {
    const keyword = this.expectKeyword('fragment');
    const nameToken = this.peek();
    if (nameToken.kind === 'name' && nameToken.value === 'on') {
      this.fail('A fragment cannot be named `on`.', nameToken);
    }
    const name = this.name();
    this.expectKeyword('on');
    const typeCondition = this.namedType();
    const directives = this.directives(false);
    const selectionSet = this.selectionSet();
    return {
      kind: 'FragmentDefinition',
      name,
      typeCondition,
      directives,
      selectionSet,
      start: keyword.start,
      end: selectionSet.end,
    };
  }

  // ── Values ────────────────────────────────────────────────────

  private value(isConst: boolean): ValueNode {
    const token = this.peek();
    switch (token.kind) {
      case 'punct': {
        if (token.value === '[') {
          this.next();
          const values: ValueNode[] = [];
          while (!this.isPunct(']')) {
            if (this.peek().kind === 'eof') this.fail('Expected `]` but found end of input.', this.peek());
            values.push(this.value(isConst));
          }
          const close = this.next();
          return { kind: 'ListValue', values, start: token.start, end: close.end };
        }
        if (token.value === '{') {
          this.next();
          const entries: ObjectFieldNode[] = [];
          while (!this.isPunct('}')) {
            if (this.peek().kind === 'eof') this.fail('Expected `}` but found end of input.', this.peek());
            const name = this.name();
            this.expectPunct(':');
            const fieldValue = this.value(isConst);
            entries.push({ kind: 'ObjectField', name, value: fieldValue, start: name.start, end: fieldValue.end });
          }
          const close = this.next();
          return { kind: 'ObjectValue', fields: entries, start: token.start, end: close.end };
        }
        if (token.value === '$') {
          if (isConst) this.fail('Unexpected variable in a constant value.', token);
          return this.variable();
        }
        return this.fail(`Expected a value but found ${this.describe(token)}.`, token);
      }
      case 'int':
        this.next();
        return { kind: 'IntValue', value: token.value, start: token.start, end: token.end };
      case 'float':
        this.next();
        return { kind: 'FloatValue', value: token.value, start: token.start, end: token.end };
      case 'string':
      case 'blockString':
        this.next();
        return {
          kind: 'StringValue',
          value: token.value,
          block: token.kind === 'blockString',
          start: token.start,
          end: token.end,
        };
      case 'name':
        this.next();
        if (token.value === 'true' || token.value === 'false') {
          return { kind: 'BooleanValue', value: token.value === 'true', start: token.start, end: token.end };
        }
        if (token.value === 'null') return { kind: 'NullValue', start: token.start, end: token.end };
        return { kind: 'EnumValue', value: token.value, start: token.start, end: token.end };
      case 'eof':
        this.fail('Expected a value but found end of input.', token);
    }
  }

  private constValue(): ConstValueNode {
    const value = this.value(true);
    if (value.kind === 'Variable') this.fail('Unexpected variable in a constant value.', this.last);
    return value;
  }

  private arguments_(isConst: boolean): ArgumentNode[] {
    return this.optionalMany(
      '(',
      (): ArgumentNode => {
        const name = this.name();
        this.expectPunct(':');
        const value = this.value(isConst);
        return { kind: 'Argument', name, value, start: name.start, end: value.end };
      },
      ')',
    );
  }

  private directives(isConst: boolean): DirectiveNode[] {
    const out: DirectiveNode[] = [];
    while (this.isPunct('@')) {
      const at = this.next();
      const name = this.name();
      const args = this.arguments_(isConst);
      out.push({ kind: 'Directive', name, arguments: args, start: at.start, end: this.last.end });
    }
    return out;
  }

  // ── Types ─────────────────────────────────────────────────────

  private namedType(): NamedTypeNode {
    const name = this.name();
    return { kind: 'NamedType', name, start: name.start, end: name.end };
  }

  private type(): TypeNode {
    const start = this.peek();
    let inner: NamedTypeNode | ListTypeNode;
    if (this.eatPunct('[')) {
      const element = this.type();
      const close = this.expectPunct(']');
      inner = { kind: 'ListType', type: element, start: start.start, end: close.end };
    } else {
      inner = this.namedType();
    }
    if (this.isPunct('!')) {
      const bang = this.next();
      return { kind: 'NonNullType', type: inner, start: inner.start, end: bang.end };
    }
    return inner;
  }

  // ── Type-system definitions ───────────────────────────────────

  private description(): StringValueNode | null {
    const token = this.peek();
    if (token.kind !== 'string' && token.kind !== 'blockString') return null;
    this.next();
    return {
      kind: 'StringValue',
      value: token.value,
      block: token.kind === 'blockString',
      start: token.start,
      end: token.end,
    };
  }

  private typeSystemDefinition(start: Token, description: StringValueNode | null): DefinitionNode {
    const keyword = this.peek();
    if (keyword.kind !== 'name') this.fail(`Expected a definition but found ${this.describe(keyword)}.`, keyword);
    switch (keyword.value) {
      case 'schema': {
        this.next();
        const directives = this.directives(true);
        const operationTypes = this.many('{', () => this.operationTypeDefinition(), '}');
        return {
          kind: 'SchemaDefinition',
          description,
          directives,
          operationTypes,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'scalar': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        return { kind: 'ScalarTypeDefinition', description, name, directives, start: start.start, end: this.last.end };
      }
      case 'type': {
        this.next();
        const name = this.name();
        const interfaces = this.implementsInterfaces();
        const directives = this.directives(true);
        const fields = this.optionalBlock(() => this.fieldDefinition());
        return {
          kind: 'ObjectTypeDefinition',
          description,
          name,
          interfaces,
          directives,
          fields,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'interface': {
        this.next();
        const name = this.name();
        const interfaces = this.implementsInterfaces();
        const directives = this.directives(true);
        const fields = this.optionalBlock(() => this.fieldDefinition());
        return {
          kind: 'InterfaceTypeDefinition',
          description,
          name,
          interfaces,
          directives,
          fields,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'union': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const types = this.unionMembers();
        return {
          kind: 'UnionTypeDefinition',
          description,
          name,
          directives,
          types,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'enum': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const values = this.optionalBlock(() => this.enumValueDefinition());
        return {
          kind: 'EnumTypeDefinition',
          description,
          name,
          directives,
          values,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'input': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const fields = this.optionalBlock(() => this.inputValueDefinition());
        return {
          kind: 'InputObjectTypeDefinition',
          description,
          name,
          directives,
          fields,
          start: start.start,
          end: this.last.end,
        };
      }
      case 'directive':
        return this.directiveDefinition(start, description);
      default:
        this.fail(`Unexpected ${this.describe(keyword)}.`, keyword);
    }
  }

  private operationTypeDefinition(): OperationTypeDefinitionNode {
    const token = this.peek();
    if (token.kind !== 'name' || !isOperationType(token.value)) {
      this.fail(`Expected an operation type but found ${this.describe(token)}.`, token);
    }
    this.next();
    this.expectPunct(':');
    const type = this.namedType();
    return { kind: 'OperationTypeDefinition', operation: token.value, type, start: token.start, end: type.end };
  }

  private implementsInterfaces(): NamedTypeNode[] {
    if (!this.isKeyword('implements')) return [];
    this.next();
    this.eatPunct('&');
    const out: NamedTypeNode[] = [this.namedType()];
    while (this.eatPunct('&')) out.push(this.namedType());
    return out;
  }

  private unionMembers(): NamedTypeNode[] {
    if (!this.eatPunct('=')) return [];
    this.eatPunct('|');
    const out: NamedTypeNode[] = [this.namedType()];
    while (this.eatPunct('|')) out.push(this.namedType());
    return out;
  }

  private fieldDefinition(): FieldDefinitionNode {
    const start = this.peek();
    const description = this.description();
    const name = this.name();
    const args = this.optionalMany('(', () => this.inputValueDefinition(), ')');
    this.expectPunct(':');
    const type = this.type();
    const directives = this.directives(true);
    return {
      kind: 'FieldDefinition',
      description,
      name,
      arguments: args,
      type,
      directives,
      start: start.start,
      end: this.last.end,
    };
  }

  private inputValueDefinition(): InputValueDefinitionNode {
    const start = this.peek();
    const description = this.description();
    const name = this.name();
    this.expectPunct(':');
    const type = this.type();
    const defaultValue = this.eatPunct('=') ? this.constValue() : null;
    const directives = this.directives(true);
    return {
      kind: 'InputValueDefinition',
      description,
      name,
      type,
      defaultValue,
      directives,
      start: start.start,
      end: this.last.end,
    };
  }

  private enumValueDefinition(): EnumValueDefinitionNode {
    const start = this.peek();
    const description = this.description();
    const nameToken = this.peek();
    if (
      nameToken.kind === 'name' &&
      (nameToken.value === 'true' || nameToken.value === 'false' || nameToken.value === 'null')
    ) {
      this.fail(`\`${nameToken.value}\` is not a valid enum value name.`, nameToken);
    }
    const name = this.name();
    const directives = this.directives(true);
    return { kind: 'EnumValueDefinition', description, name, directives, start: start.start, end: this.last.end };
  }

  private directiveDefinition(start: Token, description: StringValueNode | null): DirectiveDefinitionNode {
    this.expectKeyword('directive');
    this.expectPunct('@');
    const name = this.name();
    const args = this.optionalMany('(', () => this.inputValueDefinition(), ')');
    const repeatable = this.isKeyword('repeatable');
    if (repeatable) this.next();
    this.expectKeyword('on');
    this.eatPunct('|');
    const locations: NameNode[] = [this.name()];
    while (this.eatPunct('|')) locations.push(this.name());
    return {
      kind: 'DirectiveDefinition',
      description,
      name,
      arguments: args,
      repeatable,
      locations,
      start: start.start,
      end: this.last.end,
    };
  }

  // ── Type-system extensions ────────────────────────────────────

  private typeSystemExtension(): DefinitionNode {
    const start = this.expectKeyword('extend');
    const keyword = this.peek();
    if (keyword.kind !== 'name') this.fail(`Expected a type keyword but found ${this.describe(keyword)}.`, keyword);
    switch (keyword.value) {
      case 'schema': {
        this.next();
        const directives = this.directives(true);
        const operationTypes = this.optionalMany('{', () => this.operationTypeDefinition(), '}');
        if (directives.length === 0 && operationTypes.length === 0)
          this.fail('An extension must add something.', keyword);
        return { kind: 'SchemaExtension', directives, operationTypes, start: start.start, end: this.last.end };
      }
      case 'scalar': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        if (directives.length === 0) this.fail('An extension must add something.', keyword);
        return { kind: 'ScalarTypeExtension', name, directives, start: start.start, end: this.last.end };
      }
      case 'type':
      case 'interface': {
        this.next();
        const name = this.name();
        const interfaces = this.implementsInterfaces();
        const directives = this.directives(true);
        const fields = this.optionalBlock(() => this.fieldDefinition());
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
          this.fail('An extension must add something.', keyword);
        }
        const kind = keyword.value === 'type' ? 'ObjectTypeExtension' : 'InterfaceTypeExtension';
        return { kind, name, interfaces, directives, fields, start: start.start, end: this.last.end };
      }
      case 'union': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const types = this.unionMembers();
        if (directives.length === 0 && types.length === 0) this.fail('An extension must add something.', keyword);
        return { kind: 'UnionTypeExtension', name, directives, types, start: start.start, end: this.last.end };
      }
      case 'enum': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const values = this.optionalBlock(() => this.enumValueDefinition());
        if (directives.length === 0 && values.length === 0) this.fail('An extension must add something.', keyword);
        return { kind: 'EnumTypeExtension', name, directives, values, start: start.start, end: this.last.end };
      }
      case 'input': {
        this.next();
        const name = this.name();
        const directives = this.directives(true);
        const fields = this.optionalBlock(() => this.inputValueDefinition());
        if (directives.length === 0 && fields.length === 0) this.fail('An extension must add something.', keyword);
        return { kind: 'InputObjectTypeExtension', name, directives, fields, start: start.start, end: this.last.end };
      }
      default:
        this.fail(`Unexpected ${this.describe(keyword)} after \`extend\`.`, keyword);
    }
  }
}

function boundary<T>(run: () => T): { value: T | null; errors: readonly GraphqlError[] } {
  try {
    return { value: run(), errors: [] };
  } catch (error) {
    if (error instanceof GraphqlSyntaxError) {
      return { value: null, errors: [{ message: error.message, start: error.start, end: error.end }] };
    }
    throw error;
  }
}

/** Parse a document (executable, type-system, or both). Never throws. */
export function parseDocument(source: string): ParseResult {
  const result = boundary(() => new Parser(source).document());
  return { document: result.value, errors: result.errors };
}
