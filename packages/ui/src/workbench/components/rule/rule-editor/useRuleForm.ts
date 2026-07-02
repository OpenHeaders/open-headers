import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type {
  AuthRule,
  DelayRule,
  ExtensionRuleType,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RedirectRule,
  RequestBodyRule,
  ResponseRule,
  Rule,
  RuleDraft,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import { buildEmptyRule, type DraftUrlStrategy, type RuleSeed } from '@openheaders/core/utils';
import { useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { Form, type FormInstance } from 'antd';
import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  applyQueryParamDraftOverlay,
  applyRequestBodyDraftOverlay,
  applyResponseDraftOverlay,
  buildDraftConditions,
  buildDraftHeaders,
} from '../../../draft-conditions';
import { buildRule } from '../../rule-fields/build-rule';

interface UseRuleFormArgs {
  liveRule: Rule | null | undefined;
  ruleUid: string | undefined;
  isCreateMode: boolean;
  ruleName: string;
  isEnabled: boolean;
  form: FormInstance;
  seedRuleType: ExtensionRuleType | undefined;
  seedRuleContent: Omit<Rule, 'uid' | 'path'> | undefined;
  initialTemplateKey: string | undefined;
  initialDraft: RuleDraft | undefined;
  draftUrlStrategy: DraftUrlStrategy;
  applyTemplate: (key: string) => void;
  /** Shared baseline-coordination refs owned by the component. `onPrimed`
   *  writes both after every populate / auto-rebase: `setBaselineRef.current`
   *  advances the conflict tracker baseline (the tracker wires its setter
   *  into this ref), `baselineRuleRef` snapshots the last-seeded rule for the
   *  save-time per-field merge. Kept in the component so this hook, the
   *  conflict tracker, and the save flow all share one layer. */
  setBaselineRef: RefObject<(r: Rule) => void>;
  baselineRuleRef: RefObject<Rule | null>;
  setDefaultHeaderTab: (reqLen: number, resLen: number) => void;
  setHeaderReqCount: Dispatch<SetStateAction<number>>;
  setHeaderResCount: Dispatch<SetStateAction<number>>;
}

export interface RuleForm {
  /** Live form snapshot (`Form.useWatch`) — feeds the conflict tracker. */
  formValues: Record<string, unknown> | undefined;
  isDirty: boolean;
  /** Seeds the form from a persisted rule (or a `buildEmptyRule` seed).
   *  Exposed so the conflict tracker's merge-editor commit path can replay
   *  a resolved rule through it. */
  populateFormFromRule: (rule: RuleSeed) => void;
}

/**
 * Form-population + dirty-derivation subsystem for the rule editor.
 *
 * Owns the reactive form snapshot (`Form.useWatch`), the canonical-shape
 * fingerprint + `signature` projection feeding `useReprime`, the per-type
 * `populateFormFromRule` seeder, the reprime hook itself (dirty derivation,
 * populate gating, auto-rebase) with its `onPrimed` overlay/template pass,
 * the create-mode `isDirty` override, and the create-mode bootstrap effect
 * that seeds a scratch draft from `seedRuleType` / `seedRuleContent` /
 * `initialTemplateKey` / `initialDraft`.
 *
 * `isDirty` derives from `formFingerprint` vs the primed baseline inside
 * `useReprime` — never imperative. The first-mount overlay / template-apply
 * is gated by an internal `overlayAppliedRef` so it runs once across the
 * populate + auto-rebase lifecycle.
 *
 * The two baseline coordination refs stay in the component (see
 * `setBaselineRef` / `baselineRuleRef` above) and thread in as inputs;
 * `applyTemplate` comes from `useRuleTemplates`, called just above this hook
 * so the reference is a plain value (no forward declaration).
 */
export function useRuleForm({
  liveRule,
  ruleUid,
  isCreateMode,
  ruleName,
  isEnabled,
  form,
  seedRuleType,
  seedRuleContent,
  initialTemplateKey,
  initialDraft,
  draftUrlStrategy,
  applyTemplate,
  setBaselineRef,
  baselineRuleRef,
  setDefaultHeaderTab,
  setHeaderReqCount,
  setHeaderResCount,
}: UseRuleFormArgs): RuleForm {
  // Gates the first-mount `initialDraft` overlay / `initialTemplateKey`
  // template so it runs once across the populate + auto-rebase lifecycle
  // (edit mode) and once on the seed effect (create mode).
  const overlayAppliedRef = useRef(false);

  // ── Form fingerprint inputs to `useReprime` ──────────────────────
  // Dirty + auto-rebase + comparison shape are owned by the shell
  // hook; the editor only supplies the form's canonical-shape
  // projection plus a matching `signature` over the live entity.
  const formValues = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const formFingerprint = useMemo(
    () => (formValues ? stableStringify(buildRule(formValues, ruleName, isEnabled)) : ''),
    [formValues, ruleName, isEnabled],
  );
  const canonicalProjection = useCallback(
    (rule: Rule) =>
      stableStringify({
        name: rule.name,
        enabled: rule.enabled,
        conditions: rule.conditions,
        type: rule.type,
        action: (rule as { action?: unknown }).action ?? null,
      }),
    [],
  );

  // Populate the form from a persisted rule. `useReprime` calls this
  // on initial seed and broadcast catch-up; conflict-tracker baseline
  // advancement happens in `onPrimed`, not here.
  const populateFormFromRule = useCallback(
    (rule: RuleSeed) => {
      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };
      switch (rule.type) {
        case 'header': {
          const hr = rule as HeaderRule;
          const reqH = hr.action.requestHeaders ?? [];
          const resH = hr.action.responseHeaders ?? [];
          form.setFieldsValue({ ...baseValues, requestHeaders: reqH, responseHeaders: resH });
          setHeaderReqCount(reqH.length);
          setHeaderResCount(resH.length);
          setDefaultHeaderTab(reqH.length, resH.length);
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as RedirectRule;
          form.setFieldsValue({ ...baseValues, redirectTo: rr.action.redirectTo });
          break;
        }
        case 'query-param': {
          const qr = rule as QueryParamRule;
          form.setFieldsValue({
            ...baseValues,
            queryParams: qr.action.params.map((p) => ({
              uid: p.uid,
              param: p.param,
              value: p.value ?? '',
              operation: p.operation,
            })),
          });
          break;
        }
        case 'inject': {
          const ir = rule as InjectRule;
          form.setFieldsValue({
            ...baseValues,
            injectType: ir.action.injectType,
            injectSource: ir.action.source || 'code',
            injectCode: ir.action.code,
            injectSourceUrl: ir.action.sourceUrl || '',
            injectPosition: ir.action.position,
            injectBypassCSP: ir.action.bypassCSP ?? false,
          });
          break;
        }
        case 'delay': {
          const dr = rule as DelayRule;
          form.setFieldsValue({ ...baseValues, delayMs: dr.action.delayMs });
          break;
        }
        case 'request-body': {
          const br = rule as RequestBodyRule;
          form.setFieldsValue({
            ...baseValues,
            requestBodyType: br.action.bodyType || 'static',
            requestStaticBody: br.action.bodyType === 'dynamic' ? '' : br.action.requestBody,
            requestDynamicBody: br.action.bodyType === 'dynamic' ? br.action.requestBody : '',
            requestResourceType: br.action.resourceType || 'rest',
            requestGraphqlKey: br.action.graphqlFilter?.key || '',
            requestGraphqlOperator: br.action.graphqlFilter?.operator || 'Equals',
            requestGraphqlValue: br.action.graphqlFilter?.value || '',
          });
          break;
        }
        case 'response': {
          const rr2 = rule as ResponseRule;
          form.setFieldsValue({
            ...baseValues,
            responseSource: rr2.action.responseSource || 'mock',
            responseStatusCode: rr2.action.statusCode || undefined,
            responseContentType: rr2.action.contentType,
            responseStaticBody: rr2.action.bodyType === 'dynamic' ? '' : rr2.action.responseBody,
            responseDynamicBody: rr2.action.bodyType === 'dynamic' ? rr2.action.responseBody : '',
            responseBodyType: rr2.action.bodyType || 'static',
            responseResourceType: rr2.action.resourceType || 'rest',
            responseGraphqlKey: rr2.action.graphqlFilter?.key || '',
            responseGraphqlOperator: rr2.action.graphqlFilter?.operator || 'Equals',
            responseGraphqlValue: rr2.action.graphqlFilter?.value || '',
            responseHeaderRows: Object.entries(rr2.action.responseHeaders ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
          });
          break;
        }
        case 'ws': {
          const wr = rule as WsRule;
          form.setFieldsValue({
            ...baseValues,
            wsOperation: wr.action.operation,
            wsDirection: wr.action.direction,
            wsFilterType: wr.action.messageFilter?.matchType ?? 'none',
            wsFilterValue: wr.action.messageFilter?.value ?? '',
            wsPayload: wr.action.payload ?? '',
            wsInjectTrigger: wr.action.injectTrigger ?? 'open',
          });
          break;
        }
        case 'sse': {
          const sr = rule as SseRule;
          form.setFieldsValue({
            ...baseValues,
            sseOperation: sr.action.operation,
            sseEventName: sr.action.eventName ?? '',
            sseFilterType: sr.action.messageFilter?.matchType ?? 'none',
            sseFilterValue: sr.action.messageFilter?.value ?? '',
            ssePayload: sr.action.payload ?? '',
            sseInjectTrigger: sr.action.injectTrigger ?? 'open',
          });
          break;
        }
        case 'auth': {
          const ar = rule as AuthRule;
          form.setFieldsValue({
            ...baseValues,
            authUsername: ar.action.username,
            authPassword: ar.action.password,
          });
          break;
        }
      }
    },
    [form, setDefaultHeaderTab],
  );

  // Reprime owns dirty derivation, comparison shape (BC1), populate
  // gating, and auto-rebase. `onPrimed` runs after every populate /
  // auto-rebase: advances the conflict tracker baseline (via ref so
  // the tracker in the component can wire its setter without a forward
  // reference), and on the first invocation applies the inspector-CTA
  // `initialDraft` overlay or `initialTemplateKey` template.
  const reprime = useReprime<Rule>({
    liveEntity: liveRule,
    scope: { entityType: RULE_ENTITY_TYPE, entityId: ruleUid ?? '' },
    enabled: !isCreateMode && liveRule != null,
    formFingerprint,
    signature: canonicalProjection,
    populate: populateFormFromRule,
    onPrimed: (rule) => {
      setBaselineRef.current(rule);
      baselineRuleRef.current = rule;
      if (overlayAppliedRef.current) return;
      overlayAppliedRef.current = true;

      if (initialTemplateKey) {
        applyTemplate(initialTemplateKey);
        return;
      }

      if (rule.published === true || !initialDraft || initialDraft.type !== rule.type) return;

      const overlay: Record<string, unknown> = {};
      const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
      if (conditions.length > 0) overlay.conditions = conditions;

      if (initialDraft.type === 'header') {
        // Preserve the draft's direction intent: if the draft targets
        // only response headers, leave requestHeaders empty so the
        // editor's "jump to response tab" heuristic fires.
        const targetsResponse = !!initialDraft.responseHeaders?.length;
        const targetsRequest = !!initialDraft.requestHeaders?.length;
        if (initialDraft.requestHeaders) overlay.requestHeaders = buildDraftHeaders(initialDraft.requestHeaders);
        else if (targetsResponse) overlay.requestHeaders = [];
        if (initialDraft.responseHeaders) overlay.responseHeaders = buildDraftHeaders(initialDraft.responseHeaders);
        else if (targetsRequest) overlay.responseHeaders = [];
      } else if (initialDraft.type === 'redirect') {
        if (initialDraft.redirectTo) overlay.redirectTo = initialDraft.redirectTo;
      } else if (initialDraft.type === 'response') {
        applyResponseDraftOverlay(overlay, initialDraft);
      } else if (initialDraft.type === 'request-body') {
        applyRequestBodyDraftOverlay(overlay, initialDraft);
      } else if (initialDraft.type === 'query-param') {
        applyQueryParamDraftOverlay(overlay, initialDraft);
      }

      if (Object.keys(overlay).length > 0) {
        form.setFieldsValue(overlay);
        if (rule.type === 'header') {
          const reqLen = Array.isArray(overlay.requestHeaders)
            ? (overlay.requestHeaders as unknown[]).length
            : ((rule as HeaderRule).action.requestHeaders?.length ?? 0);
          const resLen = Array.isArray(overlay.responseHeaders)
            ? (overlay.responseHeaders as unknown[]).length
            : ((rule as HeaderRule).action.responseHeaders?.length ?? 0);
          setHeaderReqCount(reqLen);
          setHeaderResCount(resLen);
          setDefaultHeaderTab(reqLen, resLen);
        }
      }
    },
  });
  // Create mode: the editor is dirty from the moment it opens — there's
  // no canonical entity to compare against. Edit mode: derive dirty from
  // form-vs-canonical equality (BC1 by construction in `useReprime`).
  const isDirty = isCreateMode ? true : reprime.isDirty;

  // Create-mode bootstrap. `useReprime` stays disabled (no liveRule),
  // so its `onPrimed` overlay path never fires — instead we seed the
  // form here from `seedRuleType` and run the same template / draft
  // overlay logic that edit mode runs in `onPrimed`. Gated by
  // `overlayAppliedRef` so subsequent renders don't re-stomp the form.
  useEffect(() => {
    if (!isCreateMode || overlayAppliedRef.current) return;
    overlayAppliedRef.current = true;
    const type = (seedRuleType ?? 'header') as ExtensionRuleType;
    form.setFieldsValue({ ruleType: type, conditions: [] });

    // "Duplicate Tab" seed wins over template / inspector-draft overlays
    // — it carries the full source rule, so we replay its whole shape
    // through the same populate path edit mode uses.
    if (seedRuleContent) {
      populateFormFromRule(seedRuleContent);
      return;
    }

    // Seed the per-type action defaults so choice fields (response
    // source, resource type, body type, …) open with a selection
    // instead of blank radios. Templates / draft overlays layer on top.
    populateFormFromRule(buildEmptyRule(type, ruleName));

    if (initialTemplateKey) {
      applyTemplate(initialTemplateKey);
      return;
    }

    if (!initialDraft || initialDraft.type !== type) return;

    const overlay: Record<string, unknown> = {};
    const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
    if (conditions.length > 0) overlay.conditions = conditions;

    if (initialDraft.type === 'header') {
      const targetsResponse = !!initialDraft.responseHeaders?.length;
      const targetsRequest = !!initialDraft.requestHeaders?.length;
      if (initialDraft.requestHeaders) overlay.requestHeaders = buildDraftHeaders(initialDraft.requestHeaders);
      else if (targetsResponse) overlay.requestHeaders = [];
      if (initialDraft.responseHeaders) overlay.responseHeaders = buildDraftHeaders(initialDraft.responseHeaders);
      else if (targetsRequest) overlay.responseHeaders = [];
    } else if (initialDraft.type === 'redirect') {
      if (initialDraft.redirectTo) overlay.redirectTo = initialDraft.redirectTo;
    } else if (initialDraft.type === 'response') {
      applyResponseDraftOverlay(overlay, initialDraft);
    } else if (initialDraft.type === 'request-body') {
      applyRequestBodyDraftOverlay(overlay, initialDraft);
    } else if (initialDraft.type === 'query-param') {
      applyQueryParamDraftOverlay(overlay, initialDraft);
    }

    if (Object.keys(overlay).length > 0) {
      form.setFieldsValue(overlay);
      if (type === 'header') {
        const reqLen = Array.isArray(overlay.requestHeaders) ? (overlay.requestHeaders as unknown[]).length : 0;
        const resLen = Array.isArray(overlay.responseHeaders) ? (overlay.responseHeaders as unknown[]).length : 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setDefaultHeaderTab(reqLen, resLen);
      }
    }
  }, [
    isCreateMode,
    seedRuleType,
    seedRuleContent,
    initialTemplateKey,
    initialDraft,
    draftUrlStrategy,
    ruleName,
    form,
    applyTemplate,
    populateFormFromRule,
    setDefaultHeaderTab,
  ]);

  return { formValues, isDirty, populateFormFromRule };
}
