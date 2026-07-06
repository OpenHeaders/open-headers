/**
 * Programmatic rule import for the playground's fire-evidence probe.
 *
 * Exposes `globalThis.__OH_PARITY_IMPORT_RULES__` in the service-worker
 * scope so a Playwright probe (playground/scripts/probe-fire-evidence.mjs)
 * can seed the rules a test page declares via `window.__OH_PAGE_SPEC__`
 * without driving the popup UI. Same dev-seam posture as the panel's
 * parity bridge (`host/install-parity-bridge.ts`): inert unless the
 * probe has set `chrome.storage.local.__oh_parity_hook__`, and the SW
 * global scope is unreachable from web content — only a debugger-level
 * driver can call it.
 *
 * Import path is the production one: specs are completed into full V5
 * rules (entity + nested uids minted here, exactly what the e2e contract
 * in `playground/README.md` says the harness generates), validated
 * against `RuleSchema`, then written through the sync oracle via
 * `rule-store.addRule` — which derives the DNR recompile side-effects
 * the same way a popup save does. `published` is forced true (the probe
 * imports live rules, not drafts) while `enabled` is respected so
 * disabled-rule negatives can be seeded.
 */

import { RuleSchema } from '@openheaders/core/schemas';
import type { Rule } from '@openheaders/core/types';
import { generateUid, isRuleComplete } from '@openheaders/core/utils';
import { addRule, deleteRule, ensureDefaultCollection } from '@openheaders/oracle/entity/rule-store';
import { logger } from '@utils/logger';
import * as v from 'valibot';

const SCOPE = 'ParityRuleImport';

export type ParityImportResult =
  /** `complete` mirrors `isRuleComplete` — a schema-valid spec can still
   *  be a draft the engine never compiles (e.g. an append on a header
   *  outside the allowlist). The probe fails fast on dead cells instead
   *  of chasing a fire that can never exist. */
  { ok: true; rules: Array<{ uid: string; name: string; complete: boolean }> } | { ok: false; error: string };

export type ParityDeleteResult = { ok: true; deleted: number } | { ok: false; error: string };

declare global {
  var __OH_PARITY_IMPORT_RULES__: ((specs: unknown[]) => Promise<ParityImportResult>) | undefined;
  var __OH_PARITY_DELETE_RULES__: ((uids: unknown[]) => Promise<ParityDeleteResult>) | undefined;
}

async function isParityHookEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get('__oh_parity_hook__');
  return result.__oh_parity_hook__ === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mint a uid onto each entry of an array field that the V5 schema
 *  models as uid-carrying rows (conditions, header mods, query params). */
function withMintedUids(entries: unknown): unknown {
  if (!Array.isArray(entries)) return entries;
  return entries.map((entry) =>
    isRecord(entry) && entry.uid === undefined ? { uid: generateUid(), ...entry } : entry,
  );
}

/**
 * Complete a playground `RuleSpec` into a full V5 rule candidate: nested
 * uids minted, `published` forced true. Entity-level uid/path/schemaVersion
 * are stamped afterwards (uid + path by `addRule` itself; placeholders here
 * exist only so `RuleSchema` can validate the complete shape up front).
 */
function completeSpec(spec: Record<string, unknown>): Record<string, unknown> {
  const completed: Record<string, unknown> = {
    ...spec,
    enabled: spec.enabled !== false,
    published: true,
    conditions: withMintedUids(spec.conditions),
  };
  const action = spec.action;
  if (isRecord(action)) {
    if (spec.type === 'header') {
      completed.action = {
        ...action,
        requestHeaders: withMintedUids(action.requestHeaders),
        responseHeaders: withMintedUids(action.responseHeaders),
      };
    } else if (spec.type === 'query-param') {
      completed.action = { ...action, params: withMintedUids(action.params) };
    }
  }
  return completed;
}

async function importParityRules(specs: unknown[]): Promise<ParityImportResult> {
  if (!(await isParityHookEnabled())) {
    return { ok: false, error: 'parity hook flag not set — refusing import' };
  }
  if (!Array.isArray(specs)) {
    return { ok: false, error: 'specs must be an array of V5-shaped rule specs' };
  }

  const candidates: Array<Omit<Rule, 'uid' | 'path' | 'schemaVersion'>> = [];
  for (const [i, raw] of specs.entries()) {
    if (!isRecord(raw)) return { ok: false, error: `spec[${i}] is not an object` };
    const completed = completeSpec(raw);
    const parsed = v.safeParse(RuleSchema, {
      ...completed,
      schemaVersion: 5,
      uid: generateUid(),
      path: 'rules/parity-import-validate',
    });
    if (!parsed.success) {
      const issue = parsed.issues[0];
      return { ok: false, error: `spec[${i}] (${String(raw.name)}) failed validation: ${issue.message}` };
    }
    const { uid: _uid, path: _path, schemaVersion: _schemaVersion, ...rule } = parsed.output;
    candidates.push(rule);
  }

  const collection = ensureDefaultCollection();
  const imported: Array<{ uid: string; name: string; complete: boolean }> = [];
  for (const candidate of candidates) {
    const created = await addRule(candidate, collection.path);
    imported.push({ uid: created.uid, name: created.name, complete: isRuleComplete(created) });
  }
  logger.info(SCOPE, `imported ${imported.length} rule(s) for the fire-evidence probe`);
  return { ok: true, rules: imported };
}

/**
 * Delete previously imported rules by uid — the cleanup half of the seam,
 * so the playground e2e runner can seed one page's rules, run its tests,
 * and remove them before the next page (rules on shared endpoints like
 * /echo* would otherwise cross-contaminate). Deletion goes through the
 * production `deleteRule`, which derives the same DNR recompile
 * side-effects as a popup delete.
 */
async function deleteParityRules(uids: unknown[]): Promise<ParityDeleteResult> {
  if (!(await isParityHookEnabled())) {
    return { ok: false, error: 'parity hook flag not set — refusing delete' };
  }
  if (!Array.isArray(uids) || uids.some((u) => typeof u !== 'string')) {
    return { ok: false, error: 'uids must be an array of strings' };
  }
  let deleted = 0;
  for (const uid of uids as string[]) {
    if (await deleteRule(uid)) deleted++;
  }
  logger.info(SCOPE, `deleted ${deleted} rule(s) via the parity seam`);
  return { ok: true, deleted };
}

/** Install the SW-global import + delete hooks. Call once during background boot. */
export function installParityRuleImport(): void {
  globalThis.__OH_PARITY_IMPORT_RULES__ = importParityRules;
  globalThis.__OH_PARITY_DELETE_RULES__ = deleteParityRules;
}
