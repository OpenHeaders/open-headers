/**
 * A call step's own fields: its Request card (the workflows redesign,
 * Step panel) — the saved request it sends, a line that says which that
 * is, and whether the request's scripts run — and the Captures card of
 * its response.
 *
 * Each capture carries an exposure line — the switch that makes it a
 * `{{live.<name>}}` — unless the workflow holds a session step: such a
 * workflow publishes no live variable (the workflow runs plan, Decisions
 * log, S16), so its captures offer none and a new one is not exposed.
 */

import type { DraftCallStep, DraftCapture, StructuralError } from '@openheaders/core/live';
import { newDraftCapture } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { Button, Checkbox, ConfigProvider, Input, Select, Switch, Tooltip, theme } from 'antd';
import type React from 'react';
import { scopeBadge } from '../shared/scope-colors';
import StepCapturesEditor from './StepCapturesEditor';
import { ProtocolTag } from './StepTags';
import WorkflowCard, { CardField } from './WorkflowCard';
import { buildRequestPickerOptions, type StepRequestChoice } from './workflow-step-request-options';

interface RequestCardProps {
  step: DraftCallStep;
  index: number;
  onChange: (next: DraftCallStep) => void;
  /** Requests the step's Request picker can choose from. */
  availableRequests: StepRequestChoice[];
  /** The step's backing request was deleted out from under it. */
  requestError: StructuralError | undefined;
  /** Opens the request's own tab — absent where the step names no request the workspace holds. */
  onOpenRequest?: () => void;
}

export const CallRequestCard: React.FC<RequestCardProps> = ({
  step,
  index,
  onChange,
  availableRequests,
  requestError,
  onOpenRequest,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const picked = availableRequests.find((each) => each.uid === step.requestUid);
  const scriptsLabel = t('workbench.editors.live.step.sessionScriptsLabel');

  // Off deletes the field rather than persisting `false` — absent is
  // the canonical "no scripts" state (schema default, cleaner YAML).
  const setRunScripts = (on: boolean) => {
    // Step scripts ship default-off, so switching them on is the
    // feature's first meaningful use (S17 product telemetry).
    if (on) noteFeatureUsed('workflow-scripts');
    const next = { ...step };
    if (on) {
      next.runScripts = true;
    } else {
      delete next.runScripts;
    }
    onChange(next);
  };

  return (
    <WorkflowCard
      testId={`wf-step-${index}-request`}
      title={t('workbench.editors.live.request.title')}
      description={t('workbench.editors.live.request.description')}
      extra={
        // It edits nothing, so it is told by its own `disabled`, never a read-only form's.
        <Button
          data-testid={`wf-step-${index}-open-request`}
          disabled={onOpenRequest === undefined}
          onClick={onOpenRequest}
        >
          {t('workbench.editors.live.request.open')}
        </Button>
      }
    >
      <div className="oh-wf-card-body oh-wf-fields">
        {/* Request picker. Option label is a structured breadcrumb:
         *
         *    [📂] <Collection>  ›  [📁] <Folder>  ›  [METHOD] <Request>
         *
         *  Method is colored via the shared `METHOD_COLORS` so it matches
         *  the sidebar + tab-bar method tags. Search filters on the full
         *  text breadcrumb via `filterOption` against the option `title`. */}
        <CardField label={t('workbench.editors.live.request.saved')}>
          <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'requestUid')} style={{ display: 'contents' }}>
            <Tooltip open={requestError ? undefined : false} title={requestError?.message}>
              <Select
                showSearch
                status={requestError ? 'error' : undefined}
                filterOption={(input, option) => {
                  if (!option) return true;
                  const haystack = String(option.title ?? '').toLowerCase();
                  return haystack.includes(input.toLowerCase());
                }}
                placeholder={t('workbench.editors.live.step.selectRequest')}
                aria-label={t('workbench.editors.live.request.saved')}
                value={step.requestUid || undefined}
                onChange={(uid) => onChange({ ...step, requestUid: uid })}
                options={buildRequestPickerOptions(availableRequests, token)}
              />
            </Tooltip>
          </span>
        </CardField>
        {picked !== undefined && (
          <div className="oh-wf-request-meta" data-testid={`wf-step-${index}-request-meta`}>
            {/* A request of a kind wears the kind's own name; an HTTP request its method. */}
            <ProtocolTag kind={picked.kind ?? 'http'} size="panel">
              {picked.kind === undefined ? picked.method : undefined}
            </ProtocolTag>
            {picked.collectionName !== null && (
              <span>
                {t('workbench.editors.live.request.inCollection', {
                  path: [picked.collectionName, ...picked.folderTrail].join(' › '),
                })}
              </span>
            )}
          </div>
        )}
        <span className="oh-wf-check">
          <Checkbox
            data-testid={`wf-step-${index}-run-scripts`}
            checked={step.runScripts === true}
            onChange={(e) => setRunScripts(e.target.checked)}
          >
            {scriptsLabel}
          </Checkbox>
          <InfoTrigger
            content={{ title: scriptsLabel, summary: t('workbench.editors.live.sections.scriptsTooltip') }}
          />
        </span>
      </div>
    </WorkflowCard>
  );
};

interface CapturesProps {
  step: DraftCallStep;
  index: number;
  onChange: (next: DraftCallStep) => void;
  /** The workflow publishes live variables — its captures carry the exposure line. */
  exposable: boolean;
  /** The steps that read a capture, by its name. */
  readersOf: (captureName: string) => readonly string[];
  /** The values the captures last held, by name. */
  lastValues: Readonly<Record<string, string>>;
}

export const CallStepCaptures: React.FC<CapturesProps> = ({
  step,
  index,
  onChange,
  exposable,
  readersOf,
  lastValues,
}) => {
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;
  const exposeLabel = t('workbench.editors.live.step.exposeAs');

  const renderExposure = (capture: DraftCapture, rowIndex: number, update: (next: DraftCapture) => void) => (
    // Expose switch — flipping on creates a Live Variable (on save)
    // that resolves `{{live.<liveName>}}` from this capture. Off by
    // default for pre-existing captures without an LV; on by default
    // for newly-added captures. The live-name defaults to the capture
    // name but can be overridden inline for alias-style renames.
    <div className="oh-wf-expose">
      <Switch
        size="small"
        checked={capture.exposed}
        onChange={(exposed) => {
          const next: DraftCapture = { ...capture, exposed };
          // First-time expose seeds liveName from capture name so the
          // user sees a sensible default.
          if (exposed && !capture.liveName.trim()) next.liveName = capture.name;
          update(next);
        }}
        aria-label={t('workbench.editors.live.step.exposeAria', { name: capture.name || rowIndex + 1 })}
      />
      <span className="oh-wf-quiet oh-wf-expose-label">
        {scopeBadge('live', 13)} {exposeLabel}
      </span>
      <span className="oh-wf-code oh-wf-quiet">{'{{'}live.</span>
      <Input
        className="oh-wf-code"
        disabled={readOnly || !capture.exposed}
        style={{ flex: '0 1 150px', minWidth: 60 }}
        placeholder={capture.name}
        aria-label={exposeLabel}
        value={capture.liveName}
        onChange={(e) => update({ ...capture, liveName: e.target.value })}
      />
      <span className="oh-wf-code oh-wf-quiet">{'}}'}</span>
      <InfoTrigger content={{ title: exposeLabel, summary: t('workbench.editors.live.step.exposeTooltip') }} />
    </div>
  );

  return (
    <StepCapturesEditor
      index={index}
      captures={step.captures}
      onChange={(captures) => onChange({ ...step, captures })}
      newCapture={(name) => ({ ...newDraftCapture(name, { kind: 'whole-body' }), exposed: exposable })}
      renderExposure={exposable ? renderExposure : undefined}
      readersOf={readersOf}
      lastValues={lastValues}
    />
  );
};
