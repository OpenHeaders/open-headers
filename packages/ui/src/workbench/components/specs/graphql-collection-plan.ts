/**
 * GraphQL spec → collection generation plan (the GraphQL-client plan
 * Phase E) — the pure derivation behind the graphql spec editor's
 * Generate Collection action, the `proto-collection-plan` sibling.
 *
 * The plan reads the spec's SAVED root file through the shared schema
 * source reader (SDL or an introspection result — never the editor
 * buffer): one GraphqlRequest per root field of the Query and Mutation
 * types, named after the field, its document synthesized by the core
 * grammar (every argument a variable, a shallow selection) and its
 * variables pre-filled by the example synthesis so every generated
 * request is runnable at once; the field's description lands as the
 * request's docs; specLink bound ids-only. Requests group per root
 * type; the landing loop folders them only when both roots hold
 * fields (a query-only schema lands flat — no pointless wrapper).
 * Subscription fields are recorded, never generated — subscriptions
 * are outside the epic. Schema problems surface on the plan, never
 * thrown — what resolved still generates.
 */

import { type GraphqlSchema, rootTypeName, synthesizeOperation } from '@openheaders/core/graphql';
import type { GraphqlRequest, Spec } from '@openheaders/core/types';
import { readGraphqlSchemaSource } from './graphql-schema-source';

export interface GraphqlRequestPlan {
  /** Request name — the root field's own name (`createNote`). */
  name: string;
  seed: Partial<GraphqlRequest>;
}

export interface GraphqlRootPlan {
  operation: 'query' | 'mutation';
  /** The root type's name (`Query`) — the folder name when the plan folders at all. */
  typeName: string;
  requests: GraphqlRequestPlan[];
}

export interface GraphqlCollectionPlan {
  roots: GraphqlRootPlan[];
  requestCount: number;
  /** Subscription root fields left out, by name. */
  subscriptions: string[];
  /** Schema build problems, verbatim. */
  problems: string[];
}

export interface GraphqlCollectionPlanOptions {
  /** The endpoint every generated request targets; '' leaves the requests as drafts. */
  url?: string;
}

const GENERATED_ROOTS = ['query', 'mutation'] as const;

function rootPlan(
  schema: GraphqlSchema,
  operation: (typeof GENERATED_ROOTS)[number],
  spec: Spec,
  url: string,
): GraphqlRootPlan | null {
  const typeName = rootTypeName(schema, operation);
  const type = typeName === null ? undefined : schema.types.get(typeName);
  if (typeName === null || type === undefined || type.kind !== 'OBJECT' || type.fields.length === 0) return null;
  const requests = type.fields.map((field): GraphqlRequestPlan => {
    const synthesized = synthesizeOperation(schema, operation, field);
    return {
      name: field.name,
      seed: {
        url,
        query: synthesized.document,
        specLink: { specUid: spec.uid },
        ...(synthesized.variables !== null ? { variables: JSON.stringify(synthesized.variables, null, 2) } : {}),
        ...(field.description !== null ? { description: field.description } : {}),
      },
    };
  });
  return { operation, typeName, requests };
}

/** Derive the generation plan from a GraphQL spec's saved root file. */
export function buildGraphqlCollectionPlan(
  spec: Spec,
  options: GraphqlCollectionPlanOptions = {},
): GraphqlCollectionPlan {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  if (root === undefined) return { roots: [], requestCount: 0, subscriptions: [], problems: [] };
  const { result } = readGraphqlSchemaSource(root.content);
  const problems = result.errors.map((error) => error.message);
  if (result.schema === null) return { roots: [], requestCount: 0, subscriptions: [], problems };
  const schema = result.schema;
  const url = options.url?.trim() ?? '';
  const roots = GENERATED_ROOTS.flatMap((operation) => {
    const plan = rootPlan(schema, operation, spec, url);
    return plan === null ? [] : [plan];
  });
  const subscriptionType = rootTypeName(schema, 'subscription');
  const subscription = subscriptionType === null ? undefined : schema.types.get(subscriptionType);
  const subscriptions =
    subscription !== undefined && subscription.kind === 'OBJECT' ? subscription.fields.map((field) => field.name) : [];
  return {
    roots,
    requestCount: roots.reduce((n, plan) => n + plan.requests.length, 0),
    subscriptions,
    problems,
  };
}
