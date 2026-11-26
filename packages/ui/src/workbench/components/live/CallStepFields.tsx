/**
 * The fields of a call step's card, under the card's shared head and
 * above its sections: the request it sends, an optional description, and
 * the captures of its response.
 *
 * Each capture carries an exposure row — the switch that makes it a
 * `{{live.<name>}}` — unless the workflow holds a session step: such a
 * workflow publishes no live variable (the workflow runs plan, Decisions
 * log, S16), so its captures offer none and a new one is not exposed.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import type { DraftCallStep, DraftCapture, StructuralError } from '@openheaders/core/live';
import { newDraftCapture } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { ConfigProvider, Input, Select, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { scopeBadge } from '../shared/scope-colors';
import StepCapturesEditor from './StepCapturesEditor';
import { buildRequestPickerOptions, type StepRequestChoice } from './workflow-step-request-options';

const { Text } = Typography;

interface Props {
  step: DraftCallStep;
  index: number;
  onChange: (next: DraftCallStep) => void;
  /** Requests the step's Request picker can choose from. */
  availableRequests: StepRequestChoice[];
  /** The step's backing request was deleted out from under it. */
  requestError: StructuralError | undefined;
  /** The workflow publishes live variables — its captures carry the exposure row. */
  exposable: boolean;
}

const CallStepFields: React.FC<Props> = ({ step, index, onChange, availableRequests, requestError, exposable }) => {
  const { token } = theme.useToken();
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;

  const renderExposure = (capture: DraftCapture, rowIndex: number, update: (next: DraftCapture) => void) => (
    // Expose switch — flipping on creates a Live Variable (on save)
    // that resolves `{{live.<liveName>}}` from this capture. Off by
    // default for pre-existing captures without an LV; on by default
    // for newly-added captures. The live-name defaults to the capture
    // name but can be overridden inline for alias-style renames.
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
      <Text type="secondary" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {scopeBadge('live', 13)} {t('workbench.editors.live.step.exposeAs')}
      </Text>
      <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, color: token.colorTextTertiary }}>
        {'{{'}live.
      </span>
      <Input
        size="small"
        disabled={readOnly || !capture.exposed}
        style={{ width: 180 }}
        placeholder={capture.name || t('workbench.editors.live.step.namePrefix')}
        value={capture.liveName}
        onChange={(e) => update({ ...capture, liveName: e.target.value })}
      />
      <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, color: token.colorTextTertiary }}>{'}}'}</span>
      <Tooltip title={t('workbench.editors.live.step.exposeTooltip')}>
        <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
      </Tooltip>
    </div>
  );

  return (
    <>
      {/* Request picker + optional description — inlined on one row.
       *  Request gets ~60% width, description ~40%. Both `size="small"`
       *  so they render at identical heights (the Select's option label
       *  is single-line). Option label is a structured breadcrumb:
       *
       *    [📂] <Collection>  ›  [📁] <Folder>  ›  [METHOD] <Request>
       *
       *  Method is colored via the shared `METHOD_COLORS` so it matches
       *  the sidebar + tab-bar method tags. Search filters on the full
       *  text breadcrumb via `filterOption` against the option `title`. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'requestUid')} style={{ display: 'contents' }}>
          <Tooltip open={requestError ? undefined : false} title={requestError?.message}>
            <Select
              size="small"
              style={{ flex: '1 1 60%', minWidth: 0 }}
              showSearch
              status={requestError ? 'error' : undefined}
              filterOption={(input, option) => {
                if (!option) return true;
                const haystack = String(option.title ?? '').toLowerCase();
                return haystack.includes(input.toLowerCase());
              }}
              placeholder={t('workbench.editors.live.step.selectRequest')}
              value={step.requestUid || undefined}
              onChange={(uid) => onChange({ ...step, requestUid: uid })}
              options={buildRequestPickerOptions(availableRequests, token)}
            />
          </Tooltip>
        </span>
        <Input
          size="small"
          style={{ flex: '1 1 40%' }}
          placeholder={t('workbench.editors.live.step.descriptionPlaceholder')}
          value={step.description ?? ''}
          onChange={(e) => onChange({ ...step, description: e.target.value || undefined })}
        />
      </div>

      <StepCapturesEditor
        index={index}
        captures={step.captures}
        onChange={(captures) => onChange({ ...step, captures })}
        newCapture={(name) => ({ ...newDraftCapture(name, { kind: 'whole-body' }), exposed: exposable })}
        emptyText={exposable ? t('workbench.editors.live.step.captureRequired') : undefined}
        renderExposure={exposable ? renderExposure : undefined}
      />
    </>
  );
};

export default CallStepFields;
