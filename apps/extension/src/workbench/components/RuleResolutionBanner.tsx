/**
 * RuleResolutionBanner — live unresolved-variable feedback inside the
 * rule editor.
 *
 * Mirrors the `rules` Status subsystem's yellow-pill semantics at the
 * editing surface: when the draft's conditions or action contain a
 * `{{VAR}}` that doesn't resolve against the active env / vault /
 * collection / workspace scope, show an Ant `Alert` above the form
 * with the list of unresolved references + the resolver's per-error
 * `hint` text.
 *
 * Why client-side (not bridge RPC over `getLastResolutionErrors`):
 *   - `getLastResolutionErrors` only tracks *saved* rules — drafts
 *     haven't reached the compile pipeline yet.
 *   - The user wants feedback while typing, not after a save round-
 *     trip. Building a local `VariableResolver` from the existing
 *     hooks costs nothing (arrays of variables, no I/O) and surfaces
 *     errors on every keystroke via `Form.useWatch`.
 *
 * Reserved-namespace references (`{{file.X}}` / `{{dynamic.X}}`) are
 * filtered out — matching the SW-side `getLastAggregatedResolutionErrors`
 * policy, since those are intentionally unresolved until v2 ships the
 * corresponding feature.
 */

import { useEnvironments } from '@hooks/useEnvironments';
import { useAllLiveCaches } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRules } from '@hooks/useRules';
import { isLiveVariableDraft, isLiveVariableEffective } from '@openheaders/core/live';
import type { ResolutionError } from '@openheaders/core/variables';
import { VariableResolver } from '@openheaders/core/variables';
import { Alert, Form, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { collectTemplateStrings } from '../variable-references';

const { Text } = Typography;

const REASON_LABEL: Record<ResolutionError['reason'], string> = {
  unresolved: 'unresolved',
  'unset-in-scope': 'not in scope',
  'unknown-namespace': 'unknown namespace',
  'reserved-namespace': 'reserved',
  'step-out-of-context': 'step ref out of scope',
  empty: 'empty',
  'invalid-resolved-value': 'invalid value',
};

interface RuleResolutionBannerProps {
  /**
   * The `activeCollectionId` of the rule — feeds the resolver so
   * collection-scoped `{{X}}` references resolve correctly. Pass
   * `undefined` for drafts that haven't been slotted into a collection.
   */
  collectionId?: string;
}

/**
 * Must be rendered inside an Ant `<Form>` — reads the parent form's
 * values via `Form.useWatch` and recomputes errors on every change.
 */
const RuleResolutionBanner: React.FC<RuleResolutionBannerProps> = ({ collectionId }) => {
  const values = Form.useWatch<Record<string, unknown>>([], { preserve: true });
  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvironments();
  const { localCollections } = useRules();
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const liveRegistry = useMemo(() => {
    const nowMs = Date.now();
    const registry = new Map<
      string,
      { value: string; expiresAt: number | null; stale: boolean; workflowUid: string }
    >();
    for (const lv of liveVariables) {
      if (!isLiveVariableEffective(lv)) continue;
      if (lv.manualOverride) {
        const activeOverride = lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs;
        if (activeOverride) {
          registry.set(lv.name, {
            value: lv.manualOverride.value,
            expiresAt: lv.manualOverride.until ?? null,
            stale: false,
            workflowUid: lv.workflowUid,
          });
          continue;
        }
      }
      const runs = liveCaches[lv.workflowUid] ?? [];
      // Strict env match — same contract as the SW-side
      // `buildLiveRegistry` in `variables-resolver.ts`. Cross-env
      // fallback would make the banner more lenient than the actual
      // compile path and the user would see "no errors here" while
      // the rule is silently dropped from DNR.
      const run = runs.find((r) => r.environmentId === activeEnvironmentId);
      if (!run) continue;
      const value = run.stepCaptures[lv.stepId]?.[lv.captureName];
      if (typeof value !== 'string') continue;
      registry.set(lv.name, {
        value,
        expiresAt: run.expiresAt,
        stale: run.expiresAt !== null && run.expiresAt < nowMs,
        workflowUid: lv.workflowUid,
      });
    }
    return registry;
  }, [liveVariables, liveCaches, activeEnvironmentId]);

  /**
   * For each `{{live.X}}` reference in the draft, classify WHY it
   * failed to resolve. When the LV exists + is enabled + its workflow
   * has cache rows for OTHER envs but not for the active env, the
   * actionable diagnosis is "no run for env <X>" — the user can fix
   * with one click on the Refresh button. The default `unset-in-scope`
   * hint doesn't tell them which lever to pull.
   */
  const liveDiagnostics = useMemo(() => {
    const out = new Map<
      string,
      { kind: 'no-cache-for-env' | 'unknown-lv' | 'disabled-lv' | 'draft-lv'; envName: string }
    >();
    const envName =
      activeEnvironmentId === null
        ? 'No environment'
        : (environments.find((e) => e.uid === activeEnvironmentId)?.name ?? 'active env');
    for (const lv of liveVariables) {
      const runs = liveCaches[lv.workflowUid] ?? [];
      const hasActiveEnvRun = runs.some((r) => r.environmentId === activeEnvironmentId);
      if (hasActiveEnvRun && isLiveVariableEffective(lv)) continue; // resolves cleanly
      if (isLiveVariableDraft(lv)) {
        out.set(lv.name, { kind: 'draft-lv', envName });
        continue;
      }
      if (!lv.enabled) {
        out.set(lv.name, { kind: 'disabled-lv', envName });
        continue;
      }
      // LV is effective, no row for active env — actionable refresh hint.
      out.set(lv.name, { kind: 'no-cache-for-env', envName });
    }
    return out;
  }, [liveVariables, liveCaches, activeEnvironmentId, environments]);

  const resolver = useMemo(() => {
    const r = new VariableResolver();
    r.setVault(vault);
    r.setEnvironments(environments);
    r.setActiveEnvironmentId(activeEnvironmentId);
    r.setDefaultEnvironmentId(defaultEnvironmentId);
    r.setWorkspaceVariables(workspaceVariables);
    for (const c of localCollections) r.setCollectionVariables(c.uid, c.variables ?? []);
    r.setLiveRegistry(liveRegistry);
    return r;
  }, [
    vault,
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    localCollections,
    liveRegistry,
  ]);

  const errors = useMemo<ResolutionError[]>(() => {
    if (!values) return [];
    const templateStrings: string[] = [];
    collectTemplateStrings(values, templateStrings);
    if (templateStrings.length === 0) return [];

    const ctx = collectionId ? { collectionId } : undefined;
    const seen = new Map<string, ResolutionError>();
    for (const str of templateStrings) {
      const { errors: e } = resolver.resolveTemplate(str, ctx);
      for (const err of e) {
        if (err.reason === 'reserved-namespace') continue;
        if (!seen.has(err.reference)) seen.set(err.reference, err);
      }
    }
    return [...seen.values()];
  }, [values, resolver, collectionId]);

  if (errors.length === 0) return null;

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message={
        <Text strong>
          {errors.length} unresolved {errors.length === 1 ? 'variable' : 'variables'} in this rule
        </Text>
      }
      description={
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {errors.map((err) => {
            // Live-scope refs get an enriched hint: when the LV exists +
            // its workflow has runs for OTHER envs but not the active
            // one, point the user at the actionable fix (refresh under
            // this env) instead of the generic "not in scope" message.
            const liveBareName = err.reference.startsWith('live.')
              ? err.reference.slice('live.'.length)
              : err.namespace === 'live'
                ? err.reference
                : null;
            const liveDx = liveBareName ? liveDiagnostics.get(liveBareName) : undefined;
            const enrichedHint =
              liveDx?.kind === 'no-cache-for-env'
                ? `no cached run for env "${liveDx.envName}" — open the workflow and click Refresh under this env to populate`
                : liveDx?.kind === 'disabled-lv'
                  ? `live variable is disabled — enable it in the Live Variables editor`
                  : liveDx?.kind === 'draft-lv'
                    ? `live variable is a draft — open it and click Save to publish`
                    : err.hint;
            return (
              <div key={err.reference} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Tag color="warning" style={{ fontSize: 10, marginTop: 2, minWidth: 88, textAlign: 'center' }}>
                  {REASON_LABEL[err.reason]}
                </Tag>
                <Text style={{ fontSize: 12 }}>
                  <Text code style={{ fontSize: 12 }}>{`{{${err.reference}}}`}</Text>
                  <span style={{ marginLeft: 6 }}>— {enrichedHint}</span>
                </Text>
              </div>
            );
          })}
        </Space>
      }
    />
  );
};

export default RuleResolutionBanner;
