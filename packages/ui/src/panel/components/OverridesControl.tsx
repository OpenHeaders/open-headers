/**
 * Environment-overrides toolbar control (CDP Control Plane, Phase F3b). One
 * "Overrides" button beside the throttle dropdown that opens a multi-field form
 * for this tab's page environment: the User-Agent triple (UA / Accept-Language /
 * Platform — F3a) plus the `Emulation.*` facets locale / timezone / emulated
 * media (F3b).
 *
 * None of these have a standard-mode fallback (`Network.setUserAgentOverride` and
 * `Emulation.*` are the only mechanisms), so the control is DISABLED whenever the
 * inspected tab is not CDP-controlled; the hover tooltip and the (i) popover both
 * point the user at Debug mode. This is the never-silent surface for the override
 * plane — the user can only set overrides that will actually take effect.
 *
 * The whole bag is edited in one draft and applied at once, so seeding the draft
 * from the current overrides on open is what keeps editing one facet from
 * clobbering another (the hook exposes a single whole-bag `setOverrides`).
 */

import type { TabEmulatedMedia, TabEnvironmentOverrides } from '@openheaders/core/types';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Input, Modal, Segmented, Select, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { LOCALE_OPTIONS, TIMEZONE_OPTIONS } from '../data/environment-override-options';
import { buildOverridesInfo } from './debug-controls-info';

export interface OverridesControlProps {
  /** The active override bag, or `null` when the tab uses its real environment. */
  overrides: TabEnvironmentOverrides | null;
  /** Replace the whole override bag, or `null` to clear all. */
  setOverrides: (next: TabEnvironmentOverrides | null) => void;
  /** The inspected tab is CDP-controlled — the overrides are operable. */
  cdpOwned: boolean;
  /** Renders an "Enable Debug mode" action in the (i) popover when set. */
  onEnableDebug?: () => void;
}

type ColorSchemeDraft = '' | 'light' | 'dark';
type ReducedMotionDraft = '' | 'reduce' | 'no-preference';

/** The flat, all-strings-and-bools editor shape; `''`/`false` mean "no override". */
interface OverridesDraft {
  userAgent: string;
  acceptLanguage: string;
  platform: string;
  locale: string;
  timezoneId: string;
  colorScheme: ColorSchemeDraft;
  reducedMotion: ReducedMotionDraft;
  print: boolean;
}

const EMPTY_DRAFT: OverridesDraft = {
  userAgent: '',
  acceptLanguage: '',
  platform: '',
  locale: '',
  timezoneId: '',
  colorScheme: '',
  reducedMotion: '',
  print: false,
};

function draftFrom(o: TabEnvironmentOverrides | null): OverridesDraft {
  if (!o) return EMPTY_DRAFT;
  return {
    userAgent: o.userAgent ?? '',
    acceptLanguage: o.acceptLanguage ?? '',
    platform: o.platform ?? '',
    locale: o.locale ?? '',
    timezoneId: o.timezoneId ?? '',
    colorScheme: o.emulatedMedia?.colorScheme ?? '',
    reducedMotion: o.emulatedMedia?.reducedMotion ?? '',
    print: o.emulatedMedia?.print ?? false,
  };
}

/** Build the override bag from the draft, dropping empty facets and an
 *  all-empty media struct. The hook collapses an all-empty bag to `null`. */
function bagFromDraft(d: OverridesDraft): TabEnvironmentOverrides {
  const userAgent = d.userAgent.trim();
  const acceptLanguage = d.acceptLanguage.trim();
  const platform = d.platform.trim();
  const media: TabEmulatedMedia = {
    ...(d.colorScheme ? { colorScheme: d.colorScheme } : {}),
    ...(d.reducedMotion ? { reducedMotion: d.reducedMotion } : {}),
    ...(d.print ? { print: true } : {}),
  };
  return {
    ...(userAgent ? { userAgent } : {}),
    ...(acceptLanguage ? { acceptLanguage } : {}),
    ...(platform ? { platform } : {}),
    ...(d.locale ? { locale: d.locale } : {}),
    ...(d.timezoneId ? { timezoneId: d.timezoneId } : {}),
    ...(Object.keys(media).length > 0 ? { emulatedMedia: media } : {}),
  };
}

function activeFacetCount(o: TabEnvironmentOverrides | null): number {
  if (!o) return 0;
  return [o.userAgent, o.acceptLanguage, o.platform, o.locale, o.timezoneId, o.emulatedMedia].filter(Boolean).length;
}

export const OverridesControl: React.FC<OverridesControlProps> = ({
  overrides,
  setOverrides,
  cdpOwned,
  onEnableDebug,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OverridesDraft>(EMPTY_DRAFT);

  const openModal = (): void => {
    setDraft(draftFrom(overrides));
    setOpen(true);
  };

  const apply = (): void => {
    setOverrides(bagFromDraft(draft));
    setOpen(false);
  };

  const resetToDefault = (): void => {
    setOverrides(null);
    setOpen(false);
  };

  const count = activeFacetCount(overrides);
  const trigger = (
    <button
      type="button"
      className={`dt-toolbar-dropdown dt-overrides-trigger${count > 0 ? ' dt-toolbar-dropdown--active' : ''}`}
      disabled={!cdpOwned}
      onClick={openModal}
    >
      <span>{count > 0 ? `Overrides (${count})` : 'Overrides'}</span>
      <span className="dt-toolbar-dropdown-caret">▾</span>
    </button>
  );

  return (
    <span className="dt-debug-control">
      {cdpOwned ? (
        trigger
      ) : (
        <Tooltip
          title="Environment overrides are available only in Debug mode. Enable Debug mode to override this tab."
          placement="bottom"
        >
          {/* span wrapper so the tooltip shows over the disabled trigger */}
          <span className="dt-overrides-disabled-wrap">{trigger}</span>
        </Tooltip>
      )}
      <InfoTrigger content={buildOverridesInfo({ cdpOwned, onEnableDebug })} ariaLabel="About environment overrides" />

      <Modal
        title="Environment overrides"
        open={open}
        onOk={apply}
        onCancel={() => setOpen(false)}
        okText="Apply"
        width={520}
        footer={[
          <Button key="reset" disabled={!overrides} onClick={resetToDefault}>
            Reset all
          </Button>,
          <Button key="cancel" onClick={() => setOpen(false)}>
            Cancel
          </Button>,
          <Button key="apply" type="primary" onClick={apply}>
            Apply
          </Button>,
        ]}
      >
        <div className="dt-overrides-form">
          <p className="dt-overrides-group-hint">
            Sent on requests and reported to page scripts while this tab stays in Debug mode.
          </p>
          <label className="dt-overrides-row dt-overrides-row--stacked">
            <span className="dt-overrides-label">User-Agent</span>
            <Input.TextArea
              value={draft.userAgent}
              onChange={(e) => setDraft({ ...draft, userAgent: e.target.value })}
              placeholder="Custom User-Agent string"
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
          </label>
          <label className="dt-overrides-row">
            <span className="dt-overrides-label">Accept-Language</span>
            <Input
              value={draft.acceptLanguage}
              onChange={(e) => setDraft({ ...draft, acceptLanguage: e.target.value })}
              placeholder="e.g. fr-FR,fr;q=0.9"
            />
          </label>
          <label className="dt-overrides-row">
            <span className="dt-overrides-label">Platform</span>
            <Input
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
              placeholder="navigator.platform, e.g. Linux"
            />
          </label>

          <p className="dt-overrides-group-hint">
            Page environment only — these change what the page’s own scripts and CSS observe, not requests.
          </p>
          <label className="dt-overrides-row">
            <span className="dt-overrides-label">Locale</span>
            <Select
              showSearch
              allowClear
              placeholder="Real locale"
              optionFilterProp="label"
              options={[...LOCALE_OPTIONS]}
              value={draft.locale || undefined}
              onChange={(value) => setDraft({ ...draft, locale: value ?? '' })}
              style={{ width: '100%' }}
            />
          </label>
          <label className="dt-overrides-row">
            <span className="dt-overrides-label">Timezone</span>
            <Select
              showSearch
              allowClear
              placeholder="Real timezone"
              optionFilterProp="label"
              options={[...TIMEZONE_OPTIONS]}
              value={draft.timezoneId || undefined}
              onChange={(value) => setDraft({ ...draft, timezoneId: value ?? '' })}
              style={{ width: '100%' }}
            />
          </label>
          <div className="dt-overrides-row">
            <span className="dt-overrides-label">Color scheme</span>
            <Segmented
              value={draft.colorScheme}
              onChange={(value) => {
                if (value === '' || value === 'light' || value === 'dark') setDraft({ ...draft, colorScheme: value });
              }}
              options={[
                { label: 'Auto', value: '' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
            />
          </div>
          <div className="dt-overrides-row">
            <span className="dt-overrides-label">Reduced motion</span>
            <Segmented
              value={draft.reducedMotion}
              onChange={(value) => {
                if (value === '' || value === 'reduce' || value === 'no-preference')
                  setDraft({ ...draft, reducedMotion: value });
              }}
              options={[
                { label: 'Auto', value: '' },
                { label: 'Reduce', value: 'reduce' },
                { label: 'No preference', value: 'no-preference' },
              ]}
            />
          </div>
          <div className="dt-overrides-row">
            <span className="dt-overrides-label">Print media</span>
            <Segmented
              value={draft.print ? 'print' : ''}
              onChange={(value) => setDraft({ ...draft, print: value === 'print' })}
              options={[
                { label: 'Screen', value: '' },
                { label: 'Print', value: 'print' },
              ]}
            />
          </div>
        </div>
      </Modal>
    </span>
  );
};
