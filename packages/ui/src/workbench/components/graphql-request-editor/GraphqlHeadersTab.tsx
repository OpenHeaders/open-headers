/**
 * GraphqlHeadersTab — the request's own header rows on the shared
 * KeyValueTable plus the auto-generated section behind the shared
 * Show/Hide toggle: the three headers every GraphQL POST carries —
 * `Content-Type: application/json` (the `{query, variables,
 * operationName}` envelope the compile builds), `Accept`, and the
 * dialing host's `User-Agent` — each overridable by a user row of the
 * same name. The auth-derived `Authorization` preview row rides the
 * HTTP tab's helper so an inherited pool entry reads the same here.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { AuthConfig } from '@openheaders/core/types';
import { productUserAgent } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import type React from 'react';
import { useMemo, useState } from 'react';
import { previewAuthContributions, previewedAuth } from '../request-editor/auth-preview';
import AutoHeadersToggle from '../request-editor/AutoHeadersToggle';
import { type InheritedAuthAttribution, inheritSourceLabel } from '../request-editor/inherited-auth';
import KeyValueTable, { type KeyValueRow, type SuggestionRow } from '../request-editor/KeyValueTable';

declare const __APP_VERSION__: string;

interface GraphqlHeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  auth: AuthConfig;
  inheritedFrom?: InheritedAuthAttribution;
}

const GraphqlHeadersTab: React.FC<GraphqlHeadersTabProps> = ({ rows, onChange, auth, inheritedFrom }) => {
  const t = useT();
  const [showAuto, setShowAuto] = useState(false);
  const [disabledAutoKeys, setDisabledAutoKeys] = useState<Set<string>>(new Set());

  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const toggleAutoKey = (key: string, next: boolean) => {
    setDisabledAutoKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  const userRowKeys = useMemo(() => {
    const out = new Set<string>();
    for (const r of rows) {
      if (r.enabled && r.key.trim()) out.add(r.key.trim().toLowerCase());
    }
    return out;
  }, [rows]);
  const overrideBy = (key: string): string | undefined => (userRowKeys.has(key.toLowerCase()) ? key : undefined);

  const effective = useMemo(() => previewedAuth(auth, inheritedFrom), [auth, inheritedFrom]);
  const authSuggestions = useMemo<SuggestionRow[]>(() => {
    if (effective === null) return [];
    const source = auth.type === 'inherit' && inheritedFrom?.source ? inheritSourceLabel(t, inheritedFrom.source) : null;
    return previewAuthContributions(effective, t).headers.map((h) => ({
      key: h.key,
      value: h.value,
      hint: source === null ? h.hint : `${h.hint} ${t('workbench.editors.request.authPreview.inheritedFrom', { source })}`,
      enabled: auth.disabled !== true,
    }));
  }, [effective, auth, inheritedFrom, t]);

  const autoSuggestions: SuggestionRow[] = [
    {
      key: 'Content-Type',
      value: 'application/json',
      hint: t('workbench.editors.graphql.headers.hint.contentType'),
      enabled: !disabledAutoKeys.has('Content-Type'),
      onToggle: (next: boolean) => toggleAutoKey('Content-Type', next),
      overriddenBy: overrideBy('Content-Type'),
    },
    {
      key: 'Accept',
      value: '*/*',
      hint: t('workbench.editors.request.headers.hint.accept'),
      enabled: !disabledAutoKeys.has('Accept'),
      onToggle: (next: boolean) => toggleAutoKey('Accept', next),
      overriddenBy: overrideBy('Accept'),
    },
    {
      key: 'User-Agent',
      value: nodeHost
        ? productUserAgent(__APP_VERSION__)
        : typeof navigator !== 'undefined'
          ? navigator.userAgent
          : t('workbench.editors.request.headers.browserUserAgent'),
      hint: nodeHost
        ? t('workbench.editors.request.headers.hint.node.userAgent')
        : t('workbench.editors.request.headers.hint.userAgent'),
      enabled: !disabledAutoKeys.has('User-Agent'),
      onToggle: (next: boolean) => toggleAutoKey('User-Agent', next),
      overriddenBy: overrideBy('User-Agent'),
    },
  ];
  const suggestions: SuggestionRow[] = showAuto ? [...authSuggestions, ...autoSuggestions] : authSuggestions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="graphql-headers-tab">
      <AutoHeadersToggle shown={showAuto} count={autoSuggestions.length} onToggle={() => setShowAuto((s) => !s)} />
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder={t('workbench.editors.request.headers.keyPlaceholder')}
        suggestionRows={suggestions}
        rowPath={(uid, leaf) => REQUEST_PATHS.header(uid, leaf)}
      />
    </div>
  );
};

export default GraphqlHeadersTab;
