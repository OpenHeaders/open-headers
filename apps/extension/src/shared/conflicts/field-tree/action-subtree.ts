/**
 * `ACTION_SUBTREE` — declarative field-tree descriptor for the 8-way
 * Rule action union, factored so Rule + Template share the same shape.
 *
 * Both entities reuse the same per-rule-type field components
 * (`rule-fields/*`) and observe identical conflict structure. The two
 * differ only along the `actionRoot` axis (`'action'` for Rule,
 * `'formValues'` for Template) and the query-param key (`'params'` vs.
 * `'queryParams'`); the bundle's `ActionPathBundle` parameterizes both.
 *
 * Conditions live outside this subtree because they sit at the entity
 * root (alongside `name`) and the path keys diverge from the schema
 * field names (`conditions.<uid>.field` reads `c.type`). The entity
 * adapter wrapper emits conditions manually via the existing factory
 * helpers; the walker handles `name` + `action.*`.
 *
 * `MockAction.responseHeaders` (Record-shape; per-entry `name` and
 * `value` keys are virtual on the form side) is left out of the union
 * branch and handled by the entity adapter wrapper for the same reason.
 *
 * Discriminator: rule's `type` lives at the entity root, not inside the
 * action subtree. The union node uses the `discriminate(parent, value)`
 * accessor (Session 29 walker extension) to read it from the parent.
 */

import type { ActionPathBundle } from '@/shared/awareness';
import { enumLeaf, type FieldNode, leaf, obj, setByUid, union } from './descriptor';

const HEADER_OPERATIONS = ['override', 'append', 'remove'] as const;
const QUERY_PARAM_OPERATIONS = ['override', 'append', 'remove'] as const;

const summarizeHeader = (row: unknown): string => {
  const h = row as { headerName?: string; value?: string };
  return `${h.headerName ?? ''}: ${h.value ?? ''}`;
};

const summarizeQueryParam = (row: unknown): string => {
  const p = row as { param?: string; value?: string };
  return `${p.param ?? ''}=${p.value ?? ''}`;
};

const HEADER_MOD_ROW: FieldNode = obj({
  headerName: leaf('string'),
  value: leaf('string'),
  operation: enumLeaf([...HEADER_OPERATIONS], { baseline: 'skip' }),
  mergeSeparator: leaf('string', { baseline: 'skip' }),
});

const QUERY_PARAM_ROW: FieldNode = obj({
  param: leaf('string'),
  value: leaf('string'),
  operation: enumLeaf([...QUERY_PARAM_OPERATIONS], { baseline: 'skip' }),
});

/**
 * Build the action-union descriptor for one `ActionPathBundle`. The
 * union's discriminator reads the rule type via the parent accessor —
 * the discriminator lives at the entity root (`rule.type` on Rule,
 * `template.ruleType` on Template), NOT inside the action subtree.
 */
function buildActionUnion(paths: ActionPathBundle, discriminatorField: string): FieldNode {
  return union({
    discriminator: discriminatorField,
    kindTransitionUnsafe: true,
    divergenceLabel: 'Rule type',
    emitDivergenceKey: true,
    discriminate: (parent) =>
      (parent as Record<string, unknown> | null | undefined)?.[discriminatorField] as string | undefined,
    branches: {
      header: obj({
        requestHeaders: setByUid({
          summary: summarizeHeader,
          rowLabel: (row) => {
            const h = row as { headerName?: string };
            return h.headerName ? `Request header ${h.headerName}` : 'Request header';
          },
          child: HEADER_MOD_ROW,
        }),
        responseHeaders: setByUid({
          summary: summarizeHeader,
          rowLabel: (row) => {
            const h = row as { headerName?: string };
            return h.headerName ? `Response header ${h.headerName}` : 'Response header';
          },
          child: HEADER_MOD_ROW,
        }),
      }),
      'query-param': obj({
        [paths.queryParamKey]: setByUid({
          summary: summarizeQueryParam,
          rowLabel: (row) => {
            const p = row as { param?: string };
            return p.param ? `Param ${p.param}` : 'Param';
          },
          child: QUERY_PARAM_ROW,
        }),
      }),
      redirect: obj({
        redirectTo: leaf('string'),
      }),
      delay: obj({
        delayMs: leaf('number', { coercion: 'number-strict' }),
      }),
      inject: obj({
        injectType: leaf('string'),
        source: leaf('string'),
        code: leaf('string'),
        sourceUrl: leaf('string'),
        position: leaf('string'),
      }),
      body: obj({
        bodyType: leaf('string'),
        body: leaf('string'),
        resourceType: leaf('string'),
      }),
      mock: obj({
        statusCode: leaf('number', { coercion: 'number-strict' }),
        responseBody: leaf('string'),
        contentType: leaf('string'),
        bodyType: leaf('string'),
        // `responseHeaders: Record<string, string>` is handled in the
        // entity adapter wrapper — its per-entry `{name, value}`
        // virtual-pair shape (path key IS the header name) doesn't
        // round-trip cleanly through the descriptor's `set(identity:'key')`
        // semantics where the child schema describes the value, not the
        // key/value pair.
      }),
      block: obj({}),
    },
  });
}

/**
 * Build the per-entity field-tree schema (entity root). The walker
 * handles `name` + the action subtree; the entity adapter wrapper
 * layers conditions and (mock-only) response-header path emission on
 * top of the walker's projection.
 */
export interface BuildActionEntitySchemaOptions {
  /** Schema field at the entity root that holds the rule-type
   *  discriminator. `'type'` for Rule, `'ruleType'` for Template. */
  discriminatorField: 'type' | 'ruleType';
}

export function buildActionEntitySchema(
  paths: ActionPathBundle,
  opts: BuildActionEntitySchemaOptions,
): FieldNode {
  return obj({
    name: leaf('string'),
    [paths.actionRoot]: buildActionUnion(paths, opts.discriminatorField),
  });
}
