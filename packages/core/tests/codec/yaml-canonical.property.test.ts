/**
 * Canonical-codec property harness — the Phase 1 P0 gate of the git
 * epic (GIT_PLAN.md §8 round-trip law; SYNC_ENGINE_DESIGN.md §13.2,
 * §23.3). The codec ships WITH this harness or not at all.
 *
 * Three properties over 1000+ seeded entities across the catalogue:
 *
 *   1. Byte round-trip fixpoint — serialize(fresh) → parse →
 *      serialize(identity merge) is byte-identical.
 *   2. Unknown-field survival — foreign fields injected at random
 *      object positions survive a known-field mutation and re-emit at
 *      their parent maps, byte-stably.
 *   3. Insertion-order independence — the same state built with
 *      shuffled key insertion order serializes to identical bytes
 *      (the chrome.storage-alphabetizes lesson: compare bytes, never
 *      objects).
 *
 * Seeded mulberry32 generators (`harness/entity-gen.ts`) — a failing
 * seed reproduces exactly; no fast-check dependency.
 */

import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { unknownFieldsOf } from '../../src/codec/yaml';
import {
  asSchemaShape,
  isArrayShape,
  isObjectShape,
  resolveForValue,
  type SchemaShape,
} from '../../src/codec/yaml/schema-shape';
import { mergePatch } from '../../src/schemas/document';
import { makeRng, type Rng } from '../sync/harness/random';
import { ENTITY_CASES, type EntityCase } from './harness/entity-gen';

const SEEDS_PER_CASE = 75;
const CASE_SEED_STRIDE = 10_000;

/** 14 cases × 75 seeds = 1050 generated entities per property. */
const TOTAL_ENTITIES = ENTITY_CASES.length * SEEDS_PER_CASE;

function freshBytes(entityCase: EntityCase, value: Record<string, unknown>): string {
  return entityCase.serialize(entityCase.fresh(value));
}

/**
 * Deep-rebuild a value inserting object keys in shuffled order — the
 * "two clients materialized the same state along different paths"
 * simulation for property 3.
 */
function shuffleKeyOrder(value: unknown, rng: Rng): unknown {
  if (Array.isArray(value)) return value.map((item) => shuffleKeyOrder(item, rng));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of rng.shuffle(Object.keys(source))) out[key] = shuffleKeyOrder(source[key], rng);
    return out;
  }
  return value;
}

/**
 * Collect JSON pointers of every fixed-entry map in the document —
 * legal injection sites for foreign fields. Records are excluded on
 * purpose: their schema admits arbitrary keys, so an inserted key
 * there is data, not an unknown field.
 */
function collectObjectPointers(value: unknown, schema: SchemaShape, pointer: string, out: string[]): void {
  if (value === null || typeof value !== 'object') return;
  const shape = resolveForValue(schema, value);
  if (shape === undefined) return;
  if (isObjectShape(shape) && !Array.isArray(value)) {
    out.push(pointer);
    const entries = shape.entries ?? {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = entries[key];
      if (child !== undefined) {
        collectObjectPointers((value as Record<string, unknown>)[key], child, `${pointer}/${key}`, out);
      }
    }
    return;
  }
  if (isArrayShape(shape) && Array.isArray(value)) {
    const item = shape.item;
    if (item === undefined) return;
    for (let index = 0; index < value.length; index += 1) {
      collectObjectPointers(value[index], item, `${pointer}/${index}`, out);
    }
  }
}

function containerAt(root: Record<string, unknown>, pointer: string): Record<string, unknown> {
  let node: unknown = root;
  for (const segment of pointer.split('/').slice(1)) {
    if (Array.isArray(node)) node = node[Number(segment)];
    else node = (node as Record<string, unknown>)[segment];
  }
  return node as Record<string, unknown>;
}

interface Injection {
  readonly path: string;
  readonly value: string;
}

/** Insert 1–3 foreign string fields at random object positions, in place. */
function injectForeignFields(raw: Record<string, unknown>, entityCase: EntityCase, rng: Rng): Injection[] {
  const pointers: string[] = [];
  collectObjectPointers(raw, asSchemaShape(entityCase.schema), '', pointers);
  const injections: Injection[] = [];
  const count = 1 + rng.int(3);
  for (let i = 0; i < count; i += 1) {
    const parent = rng.pick(pointers);
    const key = `zzforeign${rng.int(1_000_000)}`;
    const value = `from-the-future-${rng.int(1_000_000)}`;
    containerAt(raw, parent)[key] = value;
    injections.push({ path: `${parent}/${key}`, value });
  }
  return injections;
}

describe(`yaml codec — canonical properties (${TOTAL_ENTITIES} entities per property)`, () => {
  for (const entityCase of ENTITY_CASES) {
    const caseIndex = ENTITY_CASES.indexOf(entityCase);

    it(`${entityCase.name}: byte round-trip fixpoint`, () => {
      for (let seed = 0; seed < SEEDS_PER_CASE; seed += 1) {
        const rng = makeRng(caseIndex * CASE_SEED_STRIDE + seed);
        const value = entityCase.generate(rng);
        const bytes = freshBytes(entityCase, value);
        const parsed = entityCase.parse(bytes);
        const reBytes = entityCase.serialize(mergePatch(parsed, () => {}));
        expect(reBytes, `${entityCase.name} seed ${seed}`).toBe(bytes);
      }
    });

    it(`${entityCase.name}: insertion-order independence`, () => {
      for (let seed = 0; seed < SEEDS_PER_CASE; seed += 1) {
        const rng = makeRng(caseIndex * CASE_SEED_STRIDE + seed);
        const value = entityCase.generate(rng);
        const bytes = freshBytes(entityCase, value);
        const shuffled = shuffleKeyOrder(value, rng) as Record<string, unknown>;
        const shuffledBytes = freshBytes(entityCase, shuffled);
        expect(shuffledBytes, `${entityCase.name} seed ${seed}`).toBe(bytes);
      }
    });

    it(`${entityCase.name}: unknown fields survive mutate → serialize → parse`, () => {
      for (let seed = 0; seed < SEEDS_PER_CASE; seed += 1) {
        const rng = makeRng(caseIndex * CASE_SEED_STRIDE + seed);
        const value = entityCase.generate(rng);
        const bytes = freshBytes(entityCase, value);

        // Simulate a newer client adding fields this reader doesn't know.
        const raw = YAML.parse(bytes) as Record<string, unknown>;
        const injections = injectForeignFields(raw, entityCase, rng);
        const foreignBytes = YAML.stringify(raw);

        const parsed = entityCase.parse(foreignBytes);
        for (const injection of injections) {
          expect(unknownFieldsOf(parsed), `${entityCase.name} seed ${seed} capture`).toContainEqual(injection);
        }

        // Mutate a known field; the foreign fields must ride along.
        const edited = entityCase.serialize(
          mergePatch(parsed, (draft) => entityCase.mutate(draft as Record<string, unknown>)),
        );
        const reparsed = entityCase.parse(edited);
        for (const injection of injections) {
          expect(unknownFieldsOf(reparsed), `${entityCase.name} seed ${seed} survival`).toContainEqual(injection);
        }

        // Byte-stability after the foreign fields entered: identity
        // re-serialization is a fixpoint again.
        const settled = entityCase.serialize(mergePatch(reparsed, () => {}));
        expect(settled, `${entityCase.name} seed ${seed} fixpoint`).toBe(edited);
      }
    });
  }
});
