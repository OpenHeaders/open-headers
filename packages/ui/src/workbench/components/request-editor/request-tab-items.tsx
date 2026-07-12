/**
 * Request editor tab catalog — the ordered list of editor tabs plus
 * their live labels (count badges + has-content / unresolved dots).
 * `TabKey` is the shared identity for the active-tab state and the
 * tab→content switch.
 */

import { theme } from 'antd';
import type React from 'react';
import { getCapability } from '@openheaders/core/capabilities';
import { previewAuthContributions } from './auth-preview';
import type { Draft } from './draft';
import type { SectionUnresolved } from './useSectionUnresolved';

export type TabKey = 'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';

/** Mini count badge on a tab label. */
const TabCount: React.FC<{ n: number }> = ({ n }) => {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: 4,
        padding: '0 6px',
        fontSize: 10,
        fontWeight: 500,
        color: token.colorTextSecondary,
        background: token.colorFillSecondary,
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
 *  red to match the inline mirror + sidebar badge — orange is
 *  reserved for the unsaved/dirty state on the Save button. */
const TabDot: React.FC<{ tone?: 'default' | 'error' }> = ({ tone = 'default' }) => {
  const { token } = theme.useToken();
  return (
    <span
      data-testid={tone === 'error' ? 'oh-section-unresolved' : undefined}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: tone === 'error' ? token.colorError : token.colorPrimary,
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    />
  );
};

/** Build the AntD Tabs items for the request editor's sub-tab bar.
 *  Counters are body-aware (auto-gen header count sheds Content-Type +
 *  Content-Length when the body is `none`, matching `HeadersTab`). */
export function buildRequestTabItems(
  draft: Draft,
  sectionUnresolved: SectionUnresolved,
): { key: TabKey; label: React.ReactNode }[] {
  // Header badge counts the rows the user actually owns — their enabled
  // header rows plus the auth-derived `Authorization` row (shown locked
  // at the top of the table). The browser-managed auto-headers are NOT
  // counted: they're environment noise revealed behind the "N hidden"
  // toggle, not the user's own headers. Params likewise count user rows
  // plus any auth credential that rides on the URL.
  const authContrib = previewAuthContributions(draft.auth);
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
    (!browserRuntime && draft.allowHttp2 === true) ||
    (!browserRuntime && draft.resolveToAddress !== undefined) ||
    (!browserRuntime && draft.clientCertificateRef !== undefined) ||
    // The proxy-credentials row hides while no proxy URL is set, so a
    // bare synced ref never dots; a set ref implies a set URL, which
    // already counts.
    (!browserRuntime && draft.proxyUrl !== undefined) ||
    draft.timeoutMs !== undefined ||
    (!browserRuntime && draft.maxResponseBytes !== undefined) ||
    // The redirect trio's rows hide while follow-redirects is off; no
    // extra gate needed — a non-default followRedirects already dotted
    // the tab above, so this clause only runs while the rows are shown.
    (!browserRuntime &&
      (draft.maxRedirects !== undefined ||
        draft.followOriginalHttpMethod === true ||
        draft.followAuthorizationHeader === true));

  return [
    { key: 'docs', label: 'Docs' },
    {
      key: 'params',
      label: (
        <span>
          Params {paramCount > 0 && <TabCount n={paramCount} />}
          {sectionUnresolved.params && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'authorization',
      label: (
        <span>
          Authorization
          {sectionUnresolved.auth && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'headers',
      label: (
        <span>
          Headers {headerCount > 0 && <TabCount n={headerCount} />}
          {sectionUnresolved.headers && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'body',
      label: (
        <span>
          Body {sectionUnresolved.body ? <TabDot tone="error" /> : draft.body.type !== 'none' ? <TabDot /> : null}
        </span>
      ),
    },
    {
      key: 'scripts',
      label: <span>Scripts {scriptsMark > 0 && <TabDot />}</span>,
    },
    {
      key: 'settings',
      label: <span>Settings {settingsDirty && <TabDot />}</span>,
    },
  ];
}
