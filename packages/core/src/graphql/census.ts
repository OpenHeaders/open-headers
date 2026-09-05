/**
 * Operation census — what a document holds, for the operation select,
 * the wire's `operationName` pick, and the variables pane: every
 * operation with its kind, name, span and variable definitions; every
 * fragment; the anonymous count. Pure read of the AST.
 */

import { printNode } from './print';
import type { DocumentNode, FragmentDefinitionNode, OperationDefinitionNode, OperationType, Span } from './types';

export interface CensusVariable {
  readonly name: string;
  /** `[String!]!` — the declared type as written. */
  readonly type: string;
  readonly required: boolean;
  readonly hasDefault: boolean;
}

export interface CensusOperation extends Span {
  readonly operation: OperationType;
  /** Null for an anonymous operation. */
  readonly name: string | null;
  readonly variables: readonly CensusVariable[];
  readonly node: OperationDefinitionNode;
}

export interface CensusFragment extends Span {
  readonly name: string;
  readonly typeCondition: string;
  readonly node: FragmentDefinitionNode;
}

export interface DocumentCensus {
  readonly operations: readonly CensusOperation[];
  readonly fragments: readonly CensusFragment[];
  readonly anonymousCount: number;
}

export function censusDocument(document: DocumentNode): DocumentCensus {
  const operations: CensusOperation[] = [];
  const fragments: CensusFragment[] = [];
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      operations.push({
        operation: definition.operation,
        name: definition.name === null ? null : definition.name.value,
        variables: definition.variableDefinitions.map((entry) => ({
          name: entry.variable.name.value,
          type: printNode(entry.type),
          required: entry.type.kind === 'NonNullType' && entry.defaultValue === null,
          hasDefault: entry.defaultValue !== null,
        })),
        node: definition,
        start: definition.start,
        end: definition.end,
      });
    } else if (definition.kind === 'FragmentDefinition') {
      fragments.push({
        name: definition.name.value,
        typeCondition: definition.typeCondition.name.value,
        node: definition,
        start: definition.start,
        end: definition.end,
      });
    }
  }
  return { operations, fragments, anonymousCount: operations.filter((entry) => entry.name === null).length };
}

/**
 * The `operationName` the wire envelope carries. One operation (or
 * none) → nothing on the wire; several → required, the requested name
 * when the document holds it, else the first named operation.
 */
export function wireOperationName(census: DocumentCensus, requested: string | undefined): string | undefined {
  if (census.operations.length <= 1) return undefined;
  if (requested !== undefined && census.operations.some((entry) => entry.name === requested)) return requested;
  return census.operations.find((entry) => entry.name !== null)?.name ?? undefined;
}

/** The operation the wire will run for a given (possibly absent) name. */
export function selectedOperation(census: DocumentCensus, operationName: string | undefined): CensusOperation | null {
  if (census.operations.length === 0) return null;
  if (census.operations.length === 1) return census.operations[0];
  const name = wireOperationName(census, operationName);
  return census.operations.find((entry) => entry.name === name) ?? null;
}
