/**
 * GraphQL outline derivation — the structure pane's groups for a
 * `graphql` spec: Query / Mutation / Subscription (each root type's
 * fields), Types, Interfaces, Unions, Enums (their values), Inputs
 * (their fields), Scalars, Directives — computed from the root text
 * on the same parse-on-idle tick as validation. An SDL root navigates:
 * every row carries the declaration's source span (extensions fold
 * their fields into the type they extend). An introspection root has
 * no positions — the rows list, they do not jump. Field rows carry
 * their declared type and their deprecation for the pane's chips.
 */

import {
  type DefinitionNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type GraphqlNamedType,
  type GraphqlSchema,
  type InputValueDefinitionNode,
  isBuiltInDirective,
  isBuiltInScalar,
  isIntrospectionName,
  parseDocument,
  printNode,
  printTypeRef,
  rootTypeName,
} from '@openheaders/core/graphql';
import { readGraphqlSchemaSource } from './graphql-schema-source';
import type { SpecOutlineKind, SpecOutlineNode } from './spec-outline';

/** The named-type kinds the SDL walk keys its entries by. */
type TypeKind = GraphqlNamedType['kind'];

const KIND_ROW: Record<TypeKind, SpecOutlineKind> = {
  OBJECT: 'type',
  INTERFACE: 'interface',
  UNION: 'union',
  ENUM: 'enum',
  INPUT_OBJECT: 'input',
  SCALAR: 'scalar',
};

interface TypeEntry {
  readonly kind: TypeKind;
  readonly node: SpecOutlineNode;
}

function group(key: string, children: SpecOutlineNode[]): SpecOutlineNode {
  return { key, label: key, kind: 'group', offset: children[0]?.offset ?? null, children };
}

function hasDeprecation(directives: readonly { name: { value: string } }[]): boolean {
  return directives.some((directive) => directive.name.value === 'deprecated');
}

function fieldRow(typeName: string, field: FieldDefinitionNode): SpecOutlineNode {
  return {
    key: `field:${typeName}.${field.name.value}`,
    label: field.name.value,
    kind: 'field',
    offset: field.start,
    end: field.end,
    typeText: printNode(field.type),
    ...(hasDeprecation(field.directives) ? { deprecated: true } : {}),
    children: [],
  };
}

function inputFieldRow(typeName: string, field: InputValueDefinitionNode): SpecOutlineNode {
  return {
    key: `inputField:${typeName}.${field.name.value}`,
    label: field.name.value,
    kind: 'inputField',
    offset: field.start,
    end: field.end,
    typeText: printNode(field.type),
    ...(hasDeprecation(field.directives) ? { deprecated: true } : {}),
    children: [],
  };
}

function enumValueRow(typeName: string, value: EnumValueDefinitionNode): SpecOutlineNode {
  return {
    key: `enumValue:${typeName}.${value.name.value}`,
    label: value.name.value,
    kind: 'enumValue',
    offset: value.start,
    end: value.end,
    ...(hasDeprecation(value.directives) ? { deprecated: true } : {}),
    children: [],
  };
}

/** The type rows of an SDL document, by name, in declaration order —
 *  an extension appends its rows to the type it extends (or stands in
 *  for a definition the document lacks). */
function sdlTypeEntries(definitions: readonly DefinitionNode[]): {
  entries: Map<string, TypeEntry>;
  directives: SpecOutlineNode[];
  roots: Partial<Record<'query' | 'mutation' | 'subscription', string>>;
} {
  const entries = new Map<string, TypeEntry>();
  const directives: SpecOutlineNode[] = [];
  const roots: Partial<Record<'query' | 'mutation' | 'subscription', string>> = {};
  const place = (name: string, kind: TypeKind, span: { start: number; end: number }, children: SpecOutlineNode[]) => {
    const existing = entries.get(name);
    if (existing !== undefined) {
      existing.node.children.push(...children);
      return;
    }
    entries.set(name, {
      kind,
      node: { key: `type:${name}`, label: name, kind: KIND_ROW[kind], offset: span.start, end: span.end, children },
    });
  };
  for (const definition of definitions) {
    switch (definition.kind) {
      case 'SchemaDefinition':
      case 'SchemaExtension':
        for (const entry of definition.operationTypes) roots[entry.operation] = entry.type.name.value;
        break;
      case 'ObjectTypeDefinition':
      case 'ObjectTypeExtension':
        place(
          definition.name.value,
          'OBJECT',
          definition,
          definition.fields.map((field) => fieldRow(definition.name.value, field)),
        );
        break;
      case 'InterfaceTypeDefinition':
      case 'InterfaceTypeExtension':
        place(
          definition.name.value,
          'INTERFACE',
          definition,
          definition.fields.map((field) => fieldRow(definition.name.value, field)),
        );
        break;
      case 'UnionTypeDefinition':
      case 'UnionTypeExtension':
        place(definition.name.value, 'UNION', definition, []);
        break;
      case 'EnumTypeDefinition':
      case 'EnumTypeExtension':
        place(
          definition.name.value,
          'ENUM',
          definition,
          definition.values.map((value) => enumValueRow(definition.name.value, value)),
        );
        break;
      case 'InputObjectTypeDefinition':
      case 'InputObjectTypeExtension':
        place(
          definition.name.value,
          'INPUT_OBJECT',
          definition,
          definition.fields.map((field) => inputFieldRow(definition.name.value, field)),
        );
        break;
      case 'ScalarTypeDefinition':
      case 'ScalarTypeExtension':
        place(definition.name.value, 'SCALAR', definition, []);
        break;
      case 'DirectiveDefinition':
        directives.push({
          key: `directive:${definition.name.value}`,
          label: `@${definition.name.value}`,
          kind: 'directive',
          offset: definition.start,
          end: definition.end,
          children: [],
        });
        break;
      default:
        break;
    }
  }
  return { entries, directives, roots };
}

/** The type rows of an introspection result — the model's order, no positions. */
function modelTypeEntries(schema: GraphqlSchema): { entries: Map<string, TypeEntry>; directives: SpecOutlineNode[] } {
  const entries = new Map<string, TypeEntry>();
  for (const type of schema.types.values()) {
    if (isIntrospectionName(type.name) || isBuiltInScalar(type.name)) continue;
    const children: SpecOutlineNode[] = [];
    if (type.kind === 'OBJECT' || type.kind === 'INTERFACE') {
      for (const field of type.fields) {
        children.push({
          key: `field:${type.name}.${field.name}`,
          label: field.name,
          kind: 'field',
          offset: null,
          typeText: printTypeRef(field.type),
          ...(field.deprecationReason !== null ? { deprecated: true } : {}),
          children: [],
        });
      }
    } else if (type.kind === 'ENUM') {
      for (const value of type.values) {
        children.push({
          key: `enumValue:${type.name}.${value.name}`,
          label: value.name,
          kind: 'enumValue',
          offset: null,
          ...(value.deprecationReason !== null ? { deprecated: true } : {}),
          children: [],
        });
      }
    } else if (type.kind === 'INPUT_OBJECT') {
      for (const field of type.inputFields) {
        children.push({
          key: `inputField:${type.name}.${field.name}`,
          label: field.name,
          kind: 'inputField',
          offset: null,
          typeText: printTypeRef(field.type),
          ...(field.deprecationReason !== null ? { deprecated: true } : {}),
          children: [],
        });
      }
    }
    entries.set(type.name, {
      kind: type.kind,
      node: { key: `type:${type.name}`, label: type.name, kind: KIND_ROW[type.kind], offset: null, children },
    });
  }
  const directives = schema.directives
    .filter((directive) => !isBuiltInDirective(directive.name))
    .map(
      (directive): SpecOutlineNode => ({
        key: `directive:${directive.name}`,
        label: `@${directive.name}`,
        kind: 'directive',
        offset: null,
        children: [],
      }),
    );
  return { entries, directives };
}

const ROOT_GROUPS = ['query', 'mutation', 'subscription'] as const;

function assemble(
  entries: Map<string, TypeEntry>,
  directives: SpecOutlineNode[],
  rootOf: (operation: (typeof ROOT_GROUPS)[number]) => string | null,
): SpecOutlineNode[] {
  const rootNames = new Set<string>();
  const rootGroups = ROOT_GROUPS.map((operation) => {
    const name = rootOf(operation);
    const entry = name === null ? undefined : entries.get(name);
    if (name !== null && entry !== undefined && entry.kind === 'OBJECT') rootNames.add(name);
    return {
      key: operation,
      label: operation,
      kind: 'group' as const,
      offset: entry?.node.offset ?? null,
      ...(entry?.node.end !== undefined ? { end: entry.node.end } : {}),
      children: entry === undefined || entry.kind !== 'OBJECT' ? [] : entry.node.children,
    };
  });
  const byKind = (kind: TypeKind): SpecOutlineNode[] =>
    [...entries.values()].filter((entry) => entry.kind === kind && !rootNames.has(entry.node.label)).map((e) => e.node);
  return [
    ...rootGroups,
    group('types', byKind('OBJECT')),
    group('interfaces', byKind('INTERFACE')),
    group('unions', byKind('UNION')),
    group('enums', byKind('ENUM')),
    group('inputs', byKind('INPUT_OBJECT')),
    group('scalars', byKind('SCALAR')),
    group('directives', directives),
  ];
}

/**
 * Derive the outline groups from a `graphql` spec's root text. Null when
 * the text does not parse — the caller keeps the last good tree.
 */
export function buildGraphqlOutline(content: string): SpecOutlineNode[] | null {
  const source = readGraphqlSchemaSource(content);
  if (source.kind === 'sdl') {
    const parsed = parseDocument(content);
    if (parsed.document === null) return null;
    const { entries, directives, roots } = sdlTypeEntries(parsed.document.definitions);
    const conventional: Record<(typeof ROOT_GROUPS)[number], string> = {
      query: 'Query',
      mutation: 'Mutation',
      subscription: 'Subscription',
    };
    return assemble(entries, directives, (operation) => {
      const declared = roots[operation];
      if (declared !== undefined) return declared;
      return entries.get(conventional[operation])?.kind === 'OBJECT' ? conventional[operation] : null;
    });
  }
  const schema = source.result.schema;
  if (schema === null) return null;
  const { entries, directives } = modelTypeEntries(schema);
  return assemble(entries, directives, (operation) => rootTypeName(schema, operation));
}
