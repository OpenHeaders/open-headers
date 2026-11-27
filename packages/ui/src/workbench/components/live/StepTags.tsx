/**
 * The two tags a step wears beside its name (the workflows redesign,
 * Step node): the protocol its request speaks, and its kind. A node's
 * are a size under the panel's.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { type RequestKind, requestKindMeta } from '../../request-kind-menu';
import { REQUEST_KIND_COLORS } from '../sidebar/icons';

export type StepTagSize = 'node' | 'panel';

const TAG_SIZE: Record<StepTagSize, React.CSSProperties> = {
  node: { padding: '0 5px', fontSize: 10, lineHeight: '14px' },
  panel: { padding: '0 5px', fontSize: 11, lineHeight: '16px' },
};

export function stepTagStyle(size: StepTagSize): React.CSSProperties {
  return { flex: 'none', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap', ...TAG_SIZE[size] };
}

/** The colours of the kind tag, and of anything that stands where it does. */
export const KIND_TAG_COLORS: React.CSSProperties = {
  background: 'var(--oh-wf-tag-bg)',
  color: 'var(--oh-wf-tag-text)',
};

/** The design draws three protocol tags; a kind it does not draw wears the app's own colour for that kind. */
const DESIGNED_PROTOCOL_TAG: Partial<Record<RequestKind, React.CSSProperties>> = {
  http: { color: 'var(--oh-wf-tag-http)', background: 'var(--oh-wf-tag-http-bg)' },
  graphql: { color: 'var(--oh-wf-tag-graphql)', background: 'var(--oh-wf-tag-graphql-bg)' },
  mqtt: { color: 'var(--oh-wf-tag-mqtt)', background: 'var(--oh-wf-tag-mqtt-bg)' },
};

function protocolTagColors(kind: RequestKind): React.CSSProperties {
  return (
    DESIGNED_PROTOCOL_TAG[kind] ?? {
      color: REQUEST_KIND_COLORS[kind],
      background: `color-mix(in srgb, ${REQUEST_KIND_COLORS[kind]} 14%, transparent)`,
    }
  );
}

export const ProtocolTag: React.FC<{ kind: RequestKind; size: StepTagSize }> = ({ kind, size }) => {
  const t = useT();
  return <span style={{ ...stepTagStyle(size), ...protocolTagColors(kind) }}>{t(requestKindMeta(kind).labelKey)}</span>;
};

export const KindTag: React.FC<{ size: StepTagSize; children: React.ReactNode }> = ({ size, children }) => (
  <span style={{ ...stepTagStyle(size), ...KIND_TAG_COLORS }}>{children}</span>
);
