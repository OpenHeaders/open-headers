/**
 * System-overrides toolbar control (CDP Control Plane, Phase F3b). One
 * "Overrides" dropdown beside the throttle picker that opens a compact popover
 * (no modal) for this tab's system identity: the User-Agent triple (UA /
 * Accept-Language / Platform — F3a) plus the `Emulation.*` facets locale /
 * timezone / emulated media (F3b).
 *
 * None of these have a standard-mode fallback (`Network.setUserAgentOverride` and
 * `Emulation.*` are the only mechanisms), so the control is DISABLED whenever the
 * inspected tab is not CDP-controlled; the hover tooltip and the (i) popover both
 * point the user at Debug mode. This is the never-silent surface for the override
 * plane — the user can only set overrides that will actually take effect.
 *
 * The whole bag is edited in one draft and applied at once (the hook exposes a
 * single whole-bag `setOverrides`), so the draft is seeded from the active
 * overrides each time the popover opens and committed on Apply.
 */

import type { TabEmulatedMedia, TabSystemOverrides } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Input, Popover, Segmented, Select, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { LOCALE_OPTIONS, TIMEZONE_OPTIONS } from '../data/system-override-options';
import { buildOverridesInfo } from './debug-controls-info';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';

export interface OverridesControlProps {
  /** The active override bag, or `null` when the tab uses its real system. */
  overrides: TabSystemOverrides | null;
  /** Replace the whole override bag, or `null` to clear all. */
  setOverrides: (next: TabSystemOverrides | null) => void;
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

function draftFrom(o: TabSystemOverrides | null): OverridesDraft {
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
function bagFromDraft(d: OverridesDraft): TabSystemOverrides {
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

function activeFacetCount(o: TabSystemOverrides | null): number {
  if (!o) return 0;
  return [o.userAgent, o.acceptLanguage, o.platform, o.locale, o.timezoneId, o.emulatedMedia].filter(Boolean).length;
}

export const OverridesControl: React.FC<OverridesControlProps> = ({
  overrides,
  setOverrides,
  cdpOwned,
  onEnableDebug,
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OverridesDraft>(EMPTY_DRAFT);

  // Portal the popover (and its inner Selects) into the panel root, the same
  // container seam the other toolbar popovers use.
  const resolveContainer = useInfoPopoverContainer();
  const getPopupContainer = useCallback(
    (node: HTMLElement) => resolveContainer?.(node) ?? document.body,
    [resolveContainer],
  );

  // Cap the form to the room below the toolbar trigger so a tall override list
  // scrolls inside the popover instead of overrunning the panel — the same fit
  // the top-level toolbar menus get.
  const { triggerRef, onOpenChange: onFitOpenChange, maxHeight } = usePopoverViewportFit<HTMLButtonElement>();

  const onOpenChange = (next: boolean): void => {
    // Seed a fresh draft from the applied overrides each time the popover opens.
    if (next) setDraft(draftFrom(overrides));
    setOpen(next);
    onFitOpenChange(next);
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

  const form = (
    <div className="dt-overrides-form dt-scrollbar" style={maxHeight != null ? { maxHeight } : undefined}>
      <p className="dt-overrides-group-hint">{t('panel.overrides.wireHint')}</p>
      <label className="dt-overrides-row dt-overrides-row--stacked">
        <span className="dt-overrides-label">User-Agent</span>
        <Input.TextArea
          size="small"
          value={draft.userAgent}
          onChange={(e) => setDraft({ ...draft, userAgent: e.target.value })}
          placeholder={t('panel.overrides.uaPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 5 }}
        />
      </label>
      <label className="dt-overrides-row">
        <span className="dt-overrides-label">Accept-Language</span>
        <Input
          size="small"
          value={draft.acceptLanguage}
          onChange={(e) => setDraft({ ...draft, acceptLanguage: e.target.value })}
          placeholder={t('panel.overrides.alPlaceholder')}
        />
      </label>
      <label className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.platform')}</span>
        <Input
          size="small"
          value={draft.platform}
          onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
          placeholder={t('panel.overrides.platformPlaceholder')}
        />
      </label>

      <p className="dt-overrides-group-hint">{t('panel.overrides.pageOnlyHint')}</p>
      <label className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.locale')}</span>
        <Select
          size="small"
          showSearch
          allowClear
          placeholder={t('panel.overrides.localePlaceholder')}
          optionFilterProp="label"
          options={[...LOCALE_OPTIONS]}
          value={draft.locale || undefined}
          onChange={(value) => setDraft({ ...draft, locale: value ?? '' })}
          getPopupContainer={getPopupContainer}
          style={{ width: '100%' }}
        />
      </label>
      <label className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.timezone')}</span>
        <Select
          size="small"
          showSearch
          allowClear
          placeholder={t('panel.overrides.timezonePlaceholder')}
          optionFilterProp="label"
          options={[...TIMEZONE_OPTIONS]}
          value={draft.timezoneId || undefined}
          onChange={(value) => setDraft({ ...draft, timezoneId: value ?? '' })}
          getPopupContainer={getPopupContainer}
          style={{ width: '100%' }}
        />
      </label>
      <div className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.colorScheme')}</span>
        <Segmented
          size="small"
          value={draft.colorScheme}
          onChange={(value) => {
            if (value === '' || value === 'light' || value === 'dark') setDraft({ ...draft, colorScheme: value });
          }}
          options={[
            { label: t('panel.overrides.auto'), value: '' },
            { label: t('panel.overrides.light'), value: 'light' },
            { label: t('panel.overrides.dark'), value: 'dark' },
          ]}
        />
      </div>
      <div className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.reducedMotion')}</span>
        <Segmented
          size="small"
          value={draft.reducedMotion}
          onChange={(value) => {
            if (value === '' || value === 'reduce' || value === 'no-preference')
              setDraft({ ...draft, reducedMotion: value });
          }}
          options={[
            { label: t('panel.overrides.auto'), value: '' },
            { label: t('panel.overrides.reduce'), value: 'reduce' },
            { label: t('panel.overrides.noPref'), value: 'no-preference' },
          ]}
        />
      </div>
      <div className="dt-overrides-row">
        <span className="dt-overrides-label">{t('panel.overrides.printMedia')}</span>
        <Segmented
          size="small"
          value={draft.print ? 'print' : ''}
          onChange={(value) => setDraft({ ...draft, print: value === 'print' })}
          options={[
            { label: t('panel.overrides.screen'), value: '' },
            { label: t('panel.overrides.print'), value: 'print' },
          ]}
        />
      </div>

      <div className="dt-overrides-footer">
        <button type="button" className="dt-overrides-reset" disabled={!overrides} onClick={resetToDefault}>
          {t('panel.overrides.resetAll')}
        </button>
        <button type="button" className="dt-sortmode-builder-apply" onClick={apply}>
          {t('panel.debug.apply')}
        </button>
      </div>
    </div>
  );

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      className={`dt-toolbar-dropdown dt-overrides-trigger${count > 0 ? ' dt-toolbar-dropdown--active' : ''}`}
      disabled={!cdpOwned}
    >
      <span>{t('panel.overrides.trigger')}</span>
      {count > 0 && <span className="dt-toolbar-dropdown-count">{count}</span>}
      <span className="dt-toolbar-dropdown-caret">▾</span>
    </button>
  );

  return (
    <span className="dt-debug-control">
      {cdpOwned ? (
        <Popover
          open={open}
          onOpenChange={onOpenChange}
          trigger="click"
          placement="bottomLeft"
          arrow={false}
          autoAdjustOverflow={false}
          classNames={{ root: 'dt-morefilters-popover' }}
          getPopupContainer={getPopupContainer}
          content={form}
        >
          {triggerButton}
        </Popover>
      ) : (
        <Tooltip title={t('panel.overrides.disabledTooltip')} placement="bottom">
          {/* span wrapper so the tooltip shows over the disabled trigger */}
          <span className="dt-overrides-disabled-wrap">{triggerButton}</span>
        </Tooltip>
      )}
      <InfoTrigger
        content={buildOverridesInfo(t, { cdpOwned, onEnableDebug })}
        className="dt-header-info-trigger dt-debug-info-trigger"
        ariaLabel={t('panel.overrides.aboutAria')}
      />
    </span>
  );
};
