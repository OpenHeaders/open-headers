/**
 * Validation — the ratified SUBSET of the spec's rules, the ones an
 * editor needs to catch a query before it goes to the wire: unknown
 * type / field / argument / directive, a required argument missing, a
 * variable undefined or unused, an unknown fragment spread, a leaf
 * with a selection or a composite without one, a variable whose
 * declared type does not fit the argument it feeds, plus the
 * document-level rules that need no schema (a lone anonymous
 * operation, duplicate operation / fragment names, non-executable
 * definitions in an executable document). Without a schema only the
 * schema-free rules run.
 *
 * Reports diagnostics with spans; never throws. Unknown parents stop
 * cascading — a field on an unknown type reports once.
 */

import { censusDocument } from './census';
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
  isLeafType,
  namedTypeOf,
  printTypeRef,
  rootTypeName,
  typeRefOf,
} from './schema';
import type {
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  GraphqlError,
  OperationDefinitionNode,
  SelectionSetNode,
  Span,
  ValueNode,
  VariableDefinitionNode,
} from './types';

export type ValidationRule =
  | 'unknown-type'
  | 'unknown-field'
  | 'unknown-argument'
  | 'unknown-directive'
  | 'required-argument'
  | 'undefined-variable'
  | 'unused-variable'
  | 'unknown-fragment'
  | 'leaf-selection'
  | 'composite-selection'
  | 'variable-type'
  | 'lone-anonymous-operation'
  | 'duplicate-name'
  | 'not-executable';

export interface GraphqlDiagnostic extends GraphqlError {
  readonly rule: ValidationRule;
}

interface VariableUsage extends Span {
  readonly name: string;
  readonly expected: GraphqlTypeRef | null;
  readonly locationHasDefault: boolean;
}

/** A → B when a value typed A is accepted where B is expected (input types). */
function isSubtype(sub: GraphqlTypeRef, sup: GraphqlTypeRef): boolean {
  if (sup.kind === 'NON_NULL') return sub.kind === 'NON_NULL' && isSubtype(sub.ofType, sup.ofType);
  if (sub.kind === 'NON_NULL') return isSubtype(sub.ofType, sup);
  if (sup.kind === 'LIST') return sub.kind === 'LIST' && isSubtype(sub.ofType, sup.ofType);
  if (sub.kind === 'LIST') return false;
  return sub.name === sup.name;
}

class Validator {
  readonly diagnostics: GraphqlDiagnostic[] = [];
  private readonly fragments = new Map<string, FragmentDefinitionNode>();
  /** Fragment name → the variable usages inside it (own, not transitive). */
  private readonly fragmentUsages = new Map<string, VariableUsage[]>();
  private readonly fragmentSpreads = new Map<string, Set<string>>();
  private currentUsages: VariableUsage[] = [];
  private currentSpreads = new Set<string>();

  constructor(
    private readonly document: DocumentNode,
    private readonly schema: GraphqlSchema | null,
  ) {}

  private report(rule: ValidationRule, message: string, span: Span): void {
    this.diagnostics.push({ rule, message, start: span.start, end: span.end });
  }

  private typeNamed(name: string): GraphqlNamedType | undefined {
    return this.schema?.types.get(name);
  }

  run(): void {
    const census = censusDocument(this.document);
    const operationNames = new Map<string, number>();
    const fragmentNames = new Map<string, number>();
    for (const definition of this.document.definitions) {
      if (definition.kind === 'FragmentDefinition') {
        const name = definition.name.value;
        fragmentNames.set(name, (fragmentNames.get(name) ?? 0) + 1);
        if (!this.fragments.has(name)) this.fragments.set(name, definition);
      } else if (definition.kind === 'OperationDefinition') {
        if (definition.name !== null) {
          operationNames.set(definition.name.value, (operationNames.get(definition.name.value) ?? 0) + 1);
        }
      } else {
        this.report('not-executable', 'Type-system definitions are not executable — move them to a schema.', {
          start: definition.start,
          end: Math.min(definition.end, definition.start + 40),
        });
      }
    }
    // Fragments first, whatever the document order — an operation's
    // variable usages include those of every fragment it spreads.
    for (const definition of this.document.definitions) {
      if (definition.kind !== 'FragmentDefinition') continue;
      if ((fragmentNames.get(definition.name.value) ?? 0) > 1) {
        this.report(
          'duplicate-name',
          `Fragment \`${definition.name.value}\` is defined more than once.`,
          definition.name,
        );
      }
      this.fragmentDefinition(definition);
    }
    for (const definition of this.document.definitions) {
      if (definition.kind === 'OperationDefinition') {
        if (definition.name !== null && (operationNames.get(definition.name.value) ?? 0) > 1) {
          this.report(
            'duplicate-name',
            `Operation \`${definition.name.value}\` is defined more than once.`,
            definition.name,
          );
        }
        if (definition.name === null && census.operations.length > 1) {
          this.report(
            'lone-anonymous-operation',
            'An anonymous operation must be the only operation in the document — name it.',
            { start: definition.start, end: definition.selectionSet.start },
          );
        }
        this.operation(definition);
      }
    }
  }

  private fragmentDefinition(node: FragmentDefinitionNode): void {
    this.currentUsages = [];
    this.currentSpreads = new Set();
    const typeName = node.typeCondition.name.value;
    const type = this.typeNamed(typeName);
    if (this.schema !== null && type === undefined) {
      this.report('unknown-type', `Unknown type \`${typeName}\`.`, node.typeCondition);
    }
    this.directives(node.directives, 'FRAGMENT_DEFINITION');
    this.selectionSet(node.selectionSet, type !== undefined && isCompositeType(type) ? type : null, false);
    this.fragmentUsages.set(node.name.value, this.currentUsages);
    this.fragmentSpreads.set(node.name.value, this.currentSpreads);
  }

  private operation(node: OperationDefinitionNode): void {
    this.currentUsages = [];
    this.currentSpreads = new Set();
    const rootName = this.schema === null ? null : rootTypeName(this.schema, node.operation);
    if (this.schema !== null && rootName === null) {
      this.report('unknown-type', `The schema defines no ${node.operation} root type.`, {
        start: node.start,
        end: node.selectionSet.start,
      });
    }
    const root = rootName === null ? undefined : this.typeNamed(rootName);
    const defined = new Map<string, VariableDefinitionNode>();
    for (const definition of node.variableDefinitions) {
      const name = definition.variable.name.value;
      if (defined.has(name)) {
        this.report('duplicate-name', `Variable \`$${name}\` is defined more than once.`, definition.variable);
      }
      defined.set(name, definition);
      this.variableDefinition(definition);
    }
    this.directives(node.directives, node.operation.toUpperCase());
    this.selectionSet(
      node.selectionSet,
      root !== undefined && isCompositeType(root) ? root : null,
      node.operation === 'query',
    );
    // Variable usages — own plus every fragment reachable through spreads.
    const usages = [...this.currentUsages];
    const seen = new Set<string>();
    const queue = [...this.currentSpreads];
    while (queue.length > 0) {
      const name = queue.pop();
      if (name === undefined || seen.has(name)) continue;
      seen.add(name);
      for (const usage of this.fragmentUsages.get(name) ?? []) usages.push(usage);
      for (const spread of this.fragmentSpreads.get(name) ?? []) queue.push(spread);
    }
    const used = new Set<string>();
    for (const usage of usages) {
      used.add(usage.name);
      const definition = defined.get(usage.name);
      if (definition === undefined) {
        this.report('undefined-variable', `Variable \`$${usage.name}\` is not defined.`, usage);
        continue;
      }
      if (usage.expected !== null) this.variableInPosition(definition, usage);
    }
    for (const [name, definition] of defined) {
      if (!used.has(name))
        this.report('unused-variable', `Variable \`$${name}\` is defined but never used.`, definition);
    }
  }

  private variableDefinition(node: VariableDefinitionNode): void {
    if (this.schema === null) return;
    const name = namedTypeOf(typeRefOf(node.type));
    const type = this.typeNamed(name);
    if (type === undefined) {
      this.report('unknown-type', `Unknown type \`${name}\`.`, node.type);
      return;
    }
    if (!isInputType(type)) {
      this.report(
        'variable-type',
        `Variable \`$${node.variable.name.value}\` cannot be of type \`${printTypeRef(typeRefOf(node.type))}\` — only scalars, enums and input objects are input types.`,
        node.type,
      );
    }
    this.directives(node.directives, 'VARIABLE_DEFINITION');
  }

  private variableInPosition(definition: VariableDefinitionNode, usage: VariableUsage): void {
    const expected = usage.expected;
    if (expected === null) return;
    const declared = typeRefOf(definition.type);
    const declaredName = namedTypeOf(declared);
    if (this.typeNamed(declaredName) === undefined) return;
    let allowed: boolean;
    if (expected.kind === 'NON_NULL' && declared.kind !== 'NON_NULL') {
      const hasNonNullDefault = definition.defaultValue !== null && definition.defaultValue.kind !== 'NullValue';
      allowed = (hasNonNullDefault || usage.locationHasDefault) && isSubtype(declared, expected.ofType);
    } else {
      allowed = isSubtype(declared, expected);
    }
    if (!allowed) {
      this.report(
        'variable-type',
        `Variable \`$${usage.name}\` of type \`${printTypeRef(declared)}\` cannot be used where \`${printTypeRef(expected)}\` is expected.`,
        usage,
      );
    }
  }

  private selectionSet(node: SelectionSetNode, parent: GraphqlNamedType | null, isQueryRoot: boolean): void {
    for (const selection of node.selections) {
      switch (selection.kind) {
        case 'Field': {
          const name = selection.name.value;
          let field: GraphqlField | null = null;
          if (parent !== null) {
            field = this.metaField(name, isQueryRoot) ?? fieldsOf(parent).find((entry) => entry.name === name) ?? null;
            if (field === null) {
              if (parent.kind === 'UNION' && name !== '__typename') {
                this.report(
                  'unknown-field',
                  `Union \`${parent.name}\` has no fields — select via \`... on <Type>\`.`,
                  selection.name,
                );
              } else {
                this.report(
                  'unknown-field',
                  `Field \`${name}\` does not exist on type \`${parent.name}\`.`,
                  selection.name,
                );
              }
            }
          }
          this.arguments(selection.arguments, field?.args ?? null, selection.name, `Field \`${name}\``);
          this.directives(selection.directives, 'FIELD');
          const returnType = field === null ? undefined : this.typeNamed(namedTypeOf(field.type));
          if (field !== null && returnType !== undefined) {
            if (isLeafType(returnType) && selection.selectionSet !== null) {
              this.report(
                'leaf-selection',
                `Field \`${name}\` of type \`${printTypeRef(field.type)}\` must not have a selection — it is a ${returnType.kind === 'ENUM' ? 'enum' : 'scalar'}.`,
                selection.selectionSet,
              );
            } else if (isCompositeType(returnType) && selection.selectionSet === null) {
              this.report(
                'composite-selection',
                `Field \`${name}\` of type \`${printTypeRef(field.type)}\` must have a selection of subfields — try \`${name} { … }\`.`,
                selection.name,
              );
            }
          }
          if (selection.selectionSet !== null) {
            const child = returnType !== undefined && isCompositeType(returnType) ? returnType : null;
            this.selectionSet(selection.selectionSet, child, false);
          }
          break;
        }
        case 'FragmentSpread': {
          const name = selection.name.value;
          if (!this.fragments.has(name)) {
            this.report('unknown-fragment', `Unknown fragment \`${name}\`.`, selection.name);
          }
          this.currentSpreads.add(name);
          this.directives(selection.directives, 'FRAGMENT_SPREAD');
          break;
        }
        case 'InlineFragment': {
          let child = parent;
          if (selection.typeCondition !== null) {
            const typeName = selection.typeCondition.name.value;
            const type = this.typeNamed(typeName);
            if (this.schema !== null && type === undefined) {
              this.report('unknown-type', `Unknown type \`${typeName}\`.`, selection.typeCondition);
            }
            child = type !== undefined && isCompositeType(type) ? type : null;
          }
          this.directives(selection.directives, 'INLINE_FRAGMENT');
          this.selectionSet(selection.selectionSet, child, false);
          break;
        }
      }
    }
  }

  /** `__typename` everywhere composite; `__schema` / `__type` at the query root. */
  private metaField(name: string, isQueryRoot: boolean): GraphqlField | null {
    if (name === '__typename') {
      return {
        name,
        description: null,
        args: [],
        type: { kind: 'NON_NULL', ofType: { kind: 'NAMED', name: 'String' } },
        deprecationReason: null,
      };
    }
    if (!isQueryRoot) return null;
    if (name === '__schema') {
      return {
        name,
        description: null,
        args: [],
        type: { kind: 'NON_NULL', ofType: { kind: 'NAMED', name: '__Schema' } },
        deprecationReason: null,
      };
    }
    if (name === '__type') {
      return {
        name,
        description: null,
        args: [
          {
            name: 'name',
            description: null,
            type: { kind: 'NON_NULL', ofType: { kind: 'NAMED', name: 'String' } },
            defaultValue: null,
            deprecationReason: null,
          },
        ],
        type: { kind: 'NAMED', name: '__Type' },
        deprecationReason: null,
      };
    }
    return null;
  }

  private arguments(
    nodes: readonly ArgumentNode[],
    definitions: readonly GraphqlInputValue[] | null,
    anchor: Span,
    owner: string,
  ): void {
    const seen = new Set<string>();
    for (const node of nodes) {
      const name = node.name.value;
      if (seen.has(name)) this.report('duplicate-name', `Argument \`${name}\` is given more than once.`, node.name);
      seen.add(name);
      const definition = definitions?.find((entry) => entry.name === name);
      if (definitions !== null && definition === undefined) {
        this.report(
          'unknown-argument',
          `Unknown argument \`${name}\` on ${owner.charAt(0).toLowerCase()}${owner.slice(1)}.`,
          node.name,
        );
      }
      this.value(
        node.value,
        definition?.type ?? null,
        definition?.defaultValue !== null && definition?.defaultValue !== undefined,
      );
    }
    if (definitions === null) return;
    for (const definition of definitions) {
      if (definition.type.kind === 'NON_NULL' && definition.defaultValue === null && !seen.has(definition.name)) {
        this.report(
          'required-argument',
          `${owner} is missing the required argument \`${definition.name}\` of type \`${printTypeRef(definition.type)}\`.`,
          anchor,
        );
      }
    }
  }

  private directives(nodes: readonly DirectiveNode[], location: string): void {
    for (const node of nodes) {
      const name = node.name.value;
      let definition: GraphqlDirective | null = null;
      if (this.schema !== null) {
        definition = this.schema.directives.find((entry) => entry.name === name) ?? null;
        if (definition === null) {
          this.report('unknown-directive', `Unknown directive \`@${name}\`.`, node.name);
        } else if (!definition.locations.includes(location)) {
          this.report(
            'unknown-directive',
            `Directive \`@${name}\` cannot be used here (allowed on ${definition.locations.join(', ')}).`,
            node.name,
          );
        }
      }
      this.arguments(node.arguments, definition?.args ?? null, node.name, `Directive \`@${name}\``);
    }
  }

  /** Walk a value recording variable usages against the expected input type. */
  private value(node: ValueNode, expected: GraphqlTypeRef | null, locationHasDefault: boolean): void {
    switch (node.kind) {
      case 'Variable':
        this.currentUsages.push({
          name: node.name.value,
          expected,
          locationHasDefault,
          start: node.start,
          end: node.end,
        });
        return;
      case 'ListValue': {
        const inner = expected === null ? null : expected.kind === 'NON_NULL' ? expected.ofType : expected;
        const element = inner !== null && inner.kind === 'LIST' ? inner.ofType : inner;
        for (const item of node.values) this.value(item, element, false);
        return;
      }
      case 'ObjectValue': {
        const typeName = expected === null ? null : namedTypeOf(expected);
        const type = typeName === null ? undefined : this.typeNamed(typeName);
        const fields = type !== undefined && type.kind === 'INPUT_OBJECT' ? type.inputFields : null;
        for (const field of node.fields) {
          const definition = fields?.find((entry) => entry.name === field.name.value);
          if (fields !== null && definition === undefined) {
            this.report(
              'unknown-field',
              `Field \`${field.name.value}\` does not exist on input type \`${typeName}\`.`,
              field.name,
            );
          }
          this.value(
            field.value,
            definition?.type ?? null,
            definition !== undefined && definition.defaultValue !== null,
          );
        }
        return;
      }
      default:
        return;
    }
  }
}

/** Validate a parsed document against a schema (or without one). */
export function validateDocument(document: DocumentNode, schema: GraphqlSchema | null): readonly GraphqlDiagnostic[] {
  const validator = new Validator(document, schema);
  validator.run();
  return validator.diagnostics;
}
