/**
 * RuleResolutionBanner — live unresolved-variable feedback inside the
 * rule editor.
 *
 * Mirrors the `workbench` Status subsystem's yellow-pill semantics at the
 * editing surface: when the draft's conditions or action contain a
 * `{{VAR}}` that doesn't resolve against the active env / vault /
 * collection / workspace scope, show an Ant `Alert` above the form
 * with the list of unresolved references + the resolver's per-error
 * `hint` text.
 *
 * Why client-side (not bridge RPC over `getLastResolutionErrors`):
 *   - `getLastResolutionErrors` only tracks *saved* workbench — drafts
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
      if (!lv.enabled) continue;
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
      const run =
        runs.find((r) => r.environmentId === activeEnvironmentId) ?? runs.find((r) => r.environmentId === null) ?? null;
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
          {errors.map((err) => (
            <div key={err.reference} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <Tag color="warning" style={{ fontSize: 10, marginTop: 2, minWidth: 88, textAlign: 'center' }}>
                {REASON_LABEL[err.reason]}
              </Tag>
              <Text style={{ fontSize: 12 }}>
                <Text code style={{ fontSize: 12 }}>{`{{${err.reference}}}`}</Text>
                <span style={{ marginLeft: 6 }}>— {err.hint}</span>
              </Text>
            </div>
          ))}
        </Space>
      }
    />
  );
};

export default RuleResolutionBanner;
