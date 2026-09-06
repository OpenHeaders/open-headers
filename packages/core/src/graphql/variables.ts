/**
 * Variables validation — the Variables pane's JSON checked against the
 * selected operation's variable definitions: valid JSON, an object at
 * the root, every required variable present, no undeclared ones, and
 * each value shaped by its declared input type (built-in scalars by
 * JSON kind, enums by their values, lists by item, input objects by
 * field — a custom scalar accepts anything). The spec's input
 * coercion rules where they matter: a single value coerces to a
 * one-item list; a nullable variable may be null or absent.
 * Schema-free, the declared built-in scalars still check; custom types
 * pass.
 */

import { type GraphqlInputValue, type GraphqlSchema, type GraphqlTypeRef, printTypeRef, typeRefOf } from './schema';
import type { OperationDefinitionNode } from './types';

export interface VariablesDiagnostic {
  readonly message: string;
  /** The variable the problem sits on (`$input`), null for a document-level problem. */
  readonly variable: string | null;
  readonly severity: 'error' | 'warning';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonKind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  switch (typeof value) {
    case 'string':
      return 'a string';
    case 'number':
      return 'a number';
    case 'boolean':
      return 'a boolean';
    default:
      return 'an object';
  }
}

function builtInScalarAccepts(name: string, value: unknown): boolean | null {
  switch (name) {
    case 'Int':
      return typeof value === 'number' && Number.isInteger(value);
    case 'Float':
      return typeof value === 'number';
    case 'String':
      return typeof value === 'string';
    case 'Boolean':
      return typeof value === 'boolean';
    case 'ID':
      return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value));
    default:
      return null;
  }
}

function checkValue(
  value: unknown,
  type: GraphqlTypeRef,
  schema: GraphqlSchema | null,
  label: string,
  out: VariablesDiagnostic[],
  variable: string,
): void {
  if (type.kind === 'NON_NULL') {
    if (value === null || value === undefined) {
      out.push({ message: `${label} must not be null (${printTypeRef(type)}).`, variable, severity: 'error' });
      return;
    }
    checkValue(value, type.ofType, schema, label, out, variable);
    return;
  }
  if (value === null || value === undefined) return;
  if (type.kind === 'LIST') {
    // Input coercion: a single value stands for a one-item list.
    const items = Array.isArray(value) ? value : [value];
    for (const [index, item] of items.entries()) {
      checkValue(item, type.ofType, schema, `${label}[${index}]`, out, variable);
    }
    return;
  }
  const named = schema?.types.get(type.name);
  if (named === undefined) {
    const accepts = builtInScalarAccepts(type.name, value);
    if (accepts === false) {
      out.push({ message: `${label} expects ${type.name} but holds ${jsonKind(value)}.`, variable, severity: 'error' });
    }
    return;
  }
  switch (named.kind) {
    case 'SCALAR': {
      const accepts = builtInScalarAccepts(named.name, value);
      if (accepts === false) {
        out.push({
          message: `${label} expects ${named.name} but holds ${jsonKind(value)}.`,
          variable,
          severity: 'error',
        });
      }
      return;
    }
    case 'ENUM': {
      if (typeof value !== 'string' || !named.values.some((entry) => entry.name === value)) {
        const values = named.values.map((entry) => entry.name).join(', ');
        out.push({ message: `${label} expects one of ${values} (${named.name}).`, variable, severity: 'error' });
      }
      return;
    }
    case 'INPUT_OBJECT': {
      if (!isRecord(value)) {
        out.push({
          message: `${label} expects an object (${named.name}) but holds ${jsonKind(value)}.`,
          variable,
          severity: 'error',
        });
        return;
      }
      checkInputObject(value, named.inputFields, named.oneOf, named.name, schema, label, out, variable);
      return;
    }
    default:
      out.push({ message: `${label} names ${named.name}, which is not an input type.`, variable, severity: 'error' });
  }
}

function checkInputObject(
  value: Record<string, unknown>,
  fields: readonly GraphqlInputValue[],
  oneOf: boolean,
  typeName: string,
  schema: GraphqlSchema | null,
  label: string,
  out: VariablesDiagnostic[],
  variable: string,
): void {
  const known = new Set(fields.map((field) => field.name));
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      out.push({ message: `${label}.${key} is not a field of ${typeName}.`, variable, severity: 'error' });
    }
  }
  if (oneOf) {
    const present = Object.keys(value).filter((key) => known.has(key) && value[key] !== null);
    if (present.length !== 1) {
      out.push({ message: `${label} must set exactly one field of ${typeName}.`, variable, severity: 'error' });
    }
    return;
  }
  for (const field of fields) {
    const entry = value[field.name];
    if (entry === undefined) {
      if (field.type.kind === 'NON_NULL' && field.defaultValue === null) {
        out.push({
          message: `${label}.${field.name} is required (${printTypeRef(field.type)}).`,
          variable,
          severity: 'error',
        });
      }
      continue;
    }
    checkValue(entry, field.type, schema, `${label}.${field.name}`, out, variable);
  }
}

/**
 * The problems in `json` for `operation`'s variables. An empty text is
 * "no variables" — only the required ones are reported.
 */
export function validateVariables(
  operation: OperationDefinitionNode,
  schema: GraphqlSchema | null,
  json: string,
): readonly VariablesDiagnostic[] {
  const out: VariablesDiagnostic[] = [];
  let values: Record<string, unknown> = {};
  if (json.trim() !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [{ message: `Variables are not valid JSON: ${message}`, variable: null, severity: 'error' }];
    }
    if (!isRecord(parsed)) {
      return [{ message: 'Variables must be a JSON object.', variable: null, severity: 'error' }];
    }
    values = parsed;
  }
  const declared = new Set<string>();
  for (const definition of operation.variableDefinitions) {
    const name = definition.variable.name.value;
    declared.add(name);
    const label = `$${name}`;
    const type = typeRefOf(definition.type);
    const value = values[name];
    if (value === undefined) {
      if (type.kind === 'NON_NULL' && definition.defaultValue === null) {
        out.push({ message: `${label} is required (${printTypeRef(type)}).`, variable: name, severity: 'error' });
      }
      continue;
    }
    checkValue(value, type, schema, label, out, name);
  }
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) {
      out.push({ message: `$${key} is not declared by the operation.`, variable: key, severity: 'warning' });
    }
  }
  return out;
}
