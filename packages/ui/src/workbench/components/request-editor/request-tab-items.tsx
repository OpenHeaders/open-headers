/**
 * Request editor tab catalog — the ordered list of editor tabs plus
 * their live labels (count badges + has-content / unresolved dots).
 * `TabKey` is the shared identity for the active-tab state and the
 * tab→content switch.
 */

import { theme } from 'antd';
import type React from 'react';
import { getCapability } from '@openheaders/core/capabilities';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { previewAuthContributions } from './auth-preview';
import type { Draft } from './draft';
import { NO_UNSAVED_SECTIONS, type UnsavedSections } from './section-unsaved';
import { NO_UNSAVED_SETTINGS, type SettingsKnobKey } from './settings-unsaved';
import type { SectionUnresolved } from './useSectionUnresolved';

export type TabKey = 'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';

/** Mini count badge on a tab label. `unsaved` recolors it in the
 *  sidebar/tab-bar dirty salmon — the section's rows differ from the
 *  saved request, and the badge doubles as the dirty dot. */
const TabCount: React.FC<{ n: number; unsaved?: boolean }> = ({ n, unsaved }) => {
  const { token } = theme.useToken();
  return (
    <span
      data-testid={unsaved === true ? 'oh-section-count-unsaved' : undefined}
      style={{
        display: 'inline-block',
        marginLeft: 4,
        padding: '0 6px',
        fontSize: 10,
        fontWeight: 500,
        color: unsaved === true ? '#fff' : token.colorTextSecondary,
        background: unsaved === true ? '#ff7875' : token.colorFillSecondary,
        borderRadius: 8,
        lineHeight: '16px',
      }}
    >
      {n}
    </span>
  );
};

/** Small colored dot shown on a tab label to flag that the section
 *  has content OR an unresolved `{{ref}}`. `tone='error'` renders in
 *  red to match the inline mirror + sidebar badge; `tone='unsaved'`
 *  renders in the sidebar/tab-bar dirty salmon — the section holds
 *  knobs that differ from the saved request (see settings-unsaved.ts). */
const TabDot: React.FC<{ tone?: 'default' | 'error' | 'unsaved' }> = ({ tone = 'default' }) => {
  const { token } = theme.useToken();
  return (
    <span
      data-testid={tone === 'error' ? 'oh-section-unresolved' : tone === 'unsaved' ? 'oh-section-unsaved' : undefined}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: tone === 'error' ? token.colorError : tone === 'unsaved' ? '#ff7875' : token.colorPrimary,
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    />
  );
};

/** Build the AntD Tabs items for the request editor's sub-tab bar.
 *  Counters are body-aware (auto-gen header count sheds Content-Type +
 *  Content-Length when the body is `none`, matching `HeadersTab`).
 *  `scriptsExtra` renders inline in the Scripts label between the text
 *  and the has-content dot — the script-mode tag's slot, threaded from
 *  the editor so this catalog stays a pure builder. */
export function buildRequestTabItems(
  draft: Draft,
  sectionUnresolved: SectionUnresolved,
  t: Translate,
  scriptsExtra?: React.ReactNode,
  unsavedSettings: ReadonlySet<SettingsKnobKey> = NO_UNSAVED_SETTINGS,
  unsaved: UnsavedSections = NO_UNSAVED_SECTIONS,
): { key: TabKey; label: React.ReactNode }[] {
  // Header badge counts the rows the user actually owns — their enabled
  // header rows plus the auth-derived `Authorization` row (shown locked
  // at the top of the table). The browser-managed auto-headers are NOT
  // counted: they're environment noise revealed behind the "N hidden"
  // toggle, not the user's own headers. Params likewise count user rows
  // plus any auth credential that rides on the URL.
  const authContrib = previewAuthContributions(draft.auth, t);
  const paramCount = authContrib.params.length + draft.params.filter((p) => p.enabled && p.key.trim()).length;
  const headerCount = authContrib.headers.length + draft.headers.filter((h) => h.enabled && h.key.trim()).length;
  const scriptsMark = (draft.preRequestScript?.trim() ? 1 : 0) + (draft.postResponseScript?.trim() ? 1 : 0);
  // Settings is "dirty" if any wired knob differs from default. Knobs
  // that only exist on one runtime gate their contribution on it — a
  // synced `credentialsMode` / `sslVerification` must not dot a tab
  // that shows no such control.
  const browserRuntime = (getCapability('requestRuntime')?.() ?? 'browser') === 'browser';
  const settingsDirty =
    (browserRuntime && draft.credentialsMode === 'include') ||
    (draft.followRedirects !== undefined && draft.followRedirects !== true) ||
    (!browserRuntime && draft.sslVerification === false) ||
    (!browserRuntime &&
      (draft.tlsMinVersion !== undefined || draft.tlsMaxVersion !== undefined || draft.tlsCipherSuites !== undefined)) ||
    (!browserRuntime && draft.httpVersion !== undefined && draft.httpVersion !== 'auto') ||
    (!browserRuntime && draft.resolveToAddress !== undefined) ||
    (!browserRuntime && draft.clientCertificateRef !== undefined) ||
    // The proxy-credentials row hides while the mode isn't Custom, so a
    // bare synced ref never dots; a set ref implies a set mode, which
    // already counts. Any explicit mode (Direct or Custom) is off the
    // Inherit default and dots.
    (!browserRuntime && (draft.proxyMode !== undefined || draft.proxyUrl !== undefined)) ||
    (!browserRuntime && draft.unixSocketPath !== undefined) ||
    (!browserRuntime && draft.cookieJar === true) ||
    draft.timeoutMs !== undefined ||
    (!browserRuntime && draft.maxResponseBytes !== undefined) ||
    // The redirect trio's rows hide while follow-redirects is off; no
    // extra gate needed — a non-default followRedirects already dotted
    // the tab above, so this clause only runs while the rows are shown.
    (!browserRuntime &&
      (draft.maxRedirects !== undefined ||
        draft.followOriginalHttpMethod === true ||
        draft.followAuthorizationHeader === true));
  // Settings holds a knob that differs from the SAVED request — the
  // orange (unsaved) tone outranks the blue non-default dot. Same
  // per-runtime visibility gates as `settingsDirty`: a synced delta on
  // a knob with no row here must not dot the tab. Hidden-row deltas
  // (proxy URL with mode ≠ Custom, the redirect trio with follow off)
  // only ever arrive together with a delta on their visible gate knob,
  // which already counts.
  const settingsUnsaved =
    (browserRuntime && unsavedSettings.has('credentialsMode')) ||
    unsavedSettings.has('followRedirects') ||
    unsavedSettings.has('timeoutMs') ||
    (!browserRuntime &&
      (unsavedSettings.has('sslVerification') ||
        unsavedSettings.has('tlsMinVersion') ||
        unsavedSettings.has('tlsMaxVersion') ||
        unsavedSettings.has('tlsCipherSuites') ||
        unsavedSettings.has('httpVersion') ||
        unsavedSettings.has('resolveToAddress') ||
        unsavedSettings.has('clientCertificateRef') ||
        unsavedSettings.has('proxyMode') ||
        unsavedSettings.has('proxyUrl') ||
        unsavedSettings.has('proxyCredentialRef') ||
        unsavedSettings.has('unixSocketPath') ||
        unsavedSettings.has('cookieJar') ||
        unsavedSettings.has('maxResponseBytes') ||
        unsavedSettings.has('maxRedirects') ||
        unsavedSettings.has('followOriginalHttpMethod') ||
        unsavedSettings.has('followAuthorizationHeader')));

  // Tone precedence on every label: red unresolved > salmon unsaved >
  // blue has-content. On the badge tabs (Params / Headers) the count
  // badge itself carries the unsaved tone; a section whose rows were
  // all removed but not yet saved has no badge, so a bare unsaved dot
  // stands in.
  return [
    {
      key: 'docs',
      label: (
        <span>
          {t('workbench.editors.request.tab.docs')} {unsaved.docs && <TabDot tone="unsaved" />}
        </span>
      ),
    },
    {
      key: 'params',
      label: (
        <span>
          {t('workbench.editors.request.tab.params')}{' '}
          {paramCount > 0 ? (
            <TabCount n={paramCount} unsaved={unsaved.params} />
          ) : unsaved.params ? (
            <TabDot tone="unsaved" />
          ) : null}
          {sectionUnresolved.params && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'authorization',
      label: (
        <span>
          {t('workbench.editors.request.tab.authorization')}
          {sectionUnresolved.auth ? <TabDot tone="error" /> : unsaved.auth ? <TabDot tone="unsaved" /> : null}
        </span>
      ),
    },
    {
      key: 'headers',
      label: (
        <span>
          {t('workbench.editors.request.tab.headers')}{' '}
          {headerCount > 0 ? (
            <TabCount n={headerCount} unsaved={unsaved.headers} />
          ) : unsaved.headers ? (
            <TabDot tone="unsaved" />
          ) : null}
          {sectionUnresolved.headers && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'body',
      label: (
        <span>
          {t('workbench.editors.request.tab.body')}{' '}
          {sectionUnresolved.body ? (
            <TabDot tone="error" />
          ) : unsaved.body ? (
            <TabDot tone="unsaved" />
          ) : draft.body.type !== 'none' ? (
            <TabDot />
          ) : null}
        </span>
      ),
    },
    {
      key: 'scripts',
      label: (
        <span>
          {t('workbench.editors.request.tab.scripts')} {scriptsExtra}{' '}
          {unsaved.preRequestScript || unsaved.postResponseScript ? (
            <TabDot tone="unsaved" />
          ) : scriptsMark > 0 ? (
            <TabDot />
          ) : null}
        </span>
      ),
    },
    {
      key: 'settings',
      label: (
        <span>
          {t('workbench.editors.request.tab.settings')}{' '}
          {settingsUnsaved ? <TabDot tone="unsaved" /> : settingsDirty ? <TabDot /> : null}
        </span>
      ),
    },
  ];
}
