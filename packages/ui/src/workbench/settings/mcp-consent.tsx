/**
 * The one home for the "turn on the MCP server" gesture outside the
 * Settings window. Three surfaces flip `mcp.enabled`: the MCP pane's
 * switch row (a deliberately opened settings page is its own consent
 * surface), the Add-ons popover's MCP row, and the terminal's TUI-gate
 * checkbox. The latter two act from ambient chrome, so they share this
 * module — the popover asks through `confirmEnableMcp`, the TUI gate
 * composes `mcpEndpointInfo` into its own token-consent dialog and
 * flips through `enableMcp` — so copy and flip never fork.
 */

import type { App as AntApp } from 'antd';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { set as setSettingValue } from './store';

type ModalApi = ReturnType<typeof AntApp.useApp>['modal'];

/** The single write site for the master switch outside Settings. */
export function enableMcp(): void {
  setSettingValue('mcp.enabled', true);
}

/**
 * `(i)` copy for the switch: what /mcp is and what `mcp.enabled`
 * gates. `rider` appends a surface-specific consequence sentence
 * (e.g. the TUI gate's unreachable/uncheck note).
 */
export function mcpEndpointInfo(t: Translate, rider?: string): InfoPopoverContent {
  const summary = t('workbench.settings.mcpConsent.info.summary');
  return {
    title: t('workbench.settings.mcpConsent.info.title'),
    summary: rider ? `${summary} ${rider}` : summary,
  };
}

/**
 * The consent dialog for a one-click enable from ambient chrome:
 * names what turns on, carries the endpoint explainer, flips only on
 * OK. `info` (blue) rather than `confirm` (warning) — the dialog is
 * an offer, not a caution; `okCancel` keeps the decline path.
 */
export function confirmEnableMcp(modal: ModalApi, t: Translate): void {
  modal.info({
    okCancel: true,
    title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.settings.mcpConsent.title')}</span>,
    width: 420,
    centered: true,
    content: (
      <p style={{ fontSize: 12, margin: '4px 0 0' }}>
        {t('workbench.settings.mcpConsent.body')} <InfoTrigger content={mcpEndpointInfo(t)} />
      </p>
    ),
    okText: t('workbench.settings.mcpConsent.ok'),
    okButtonProps: { size: 'small' },
    cancelButtonProps: { size: 'small' },
    onOk: enableMcp,
  });
}
