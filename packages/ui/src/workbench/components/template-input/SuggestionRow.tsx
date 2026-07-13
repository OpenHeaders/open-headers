/**
 * SuggestionRow — single row inside the TemplateInput popover.
 *
 * Renders scope pill + reference + masked value preview + optional
 * stale / disabled badges. Kept in its own file so unit tests can
 * mount it without wrestling the full Mentions surface.
 *
 * Masking discipline (per plan locked decision #6): the raw value is
 * passed through for parent-controlled reveal, but the default render
 * shows `••••••••`. Callers that want "first 6 chars + …" on hover
 * wrap with their own reveal state; the row itself stays stateless so
 * it plays nicely with virtualized popover lists.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Typography } from 'antd';
import type React from 'react';
import { namespaceToScopeKey, SCOPE_COLORS, scopeBadge } from '../shared/scope-colors';

const { Text } = Typography;

// Namespace-scaffold rows: core mints an English subtitle for its own
// locale-free plane; the UI resolves the key from the row's scope
// instead (S8 core-copy rule). Dynamic-generator rows keep core's
// per-generator description — that registry is a data corpus and
// converts with its own plane.
const SCAFFOLD_SUBTITLE_KEY: Partial<Record<VariableSuggestion['scope'], MessageKey>> = {
  vault: 'shared.templateInput.scaffold.vault',
  env: 'shared.templateInput.scaffold.env',
  collection: 'shared.templateInput.scaffold.collection',
  workspace: 'shared.templateInput.scaffold.workspace',
  dynamic: 'shared.templateInput.scaffold.dynamic',
};

/** Resolve a namespace/reserved row's subtitle via the catalog, falling
 *  back to core's own copy for scopes without a key. */
export function scaffoldSubtitle(suggestion: VariableSuggestion, subtitle: string, t: Translate): string {
  if (suggestion.preview.kind === 'reserved') {
    return suggestion.scope === 'file' ? t('shared.templateInput.reservedFile') : subtitle;
  }
  const key = SCAFFOLD_SUBTITLE_KEY[suggestion.scope];
  return key ? t(key) : subtitle;
}

interface SuggestionRowProps {
  suggestion: VariableSuggestion;
  /** Render the value preview unmasked. Default: masked if the
   *  preview's `masked` flag is true. */
  reveal?: boolean;
}

function renderPreview(suggestion: VariableSuggestion, reveal: boolean, t: Translate): React.ReactNode {
  const preview = suggestion.preview;
  switch (preview.kind) {
    case 'reserved':
    case 'namespace':
      return (
        <Text type="secondary" italic style={{ fontSize: 11 }}>
          {scaffoldSubtitle(suggestion, preview.subtitle, t)}
        </Text>
      );
    case 'dynamic':
      return (
        <Text type="secondary" italic style={{ fontSize: 11 }}>
          {preview.subtitle}
        </Text>
      );
    case 'step-runtime':
      return (
        <Text type="secondary" italic style={{ fontSize: 11 }}>
          {t('shared.templateInput.capturedAtRuntime')}
        </Text>
      );
    case 'totp':
      return (
        <Text type="secondary" italic style={{ fontSize: 11 }}>
          {preview.issuer
            ? t('shared.templateInput.totpPreviewIssuer', {
                digits: preview.digits,
                period: preview.period,
                issuer: preview.issuer,
              })
            : t('shared.templateInput.totpPreview', { digits: preview.digits, period: preview.period })}
        </Text>
      );
    case 'stale':
    case 'value': {
      if (!preview.value) {
        return (
          <Text type="secondary" italic style={{ fontSize: 11 }}>
            {t('shared.templateInput.emptyValue')}
          </Text>
        );
      }
      if (preview.masked && !reveal) {
        // Use middle-dot filler so hover-reveal can show a clean first-6 chars + ellipsis.
        return (
          <Text code style={{ fontSize: 11, letterSpacing: 2 }}>
            ••••••••
          </Text>
        );
      }
      const shown =
        preview.masked && reveal ? `${preview.value.slice(0, 6)}${preview.value.length > 6 ? '…' : ''}` : preview.value;
      return (
        <Text
          code
          style={{
            fontSize: 11,
            maxWidth: 220,
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
        >
          {shown}
        </Text>
      );
    }
  }
}

const SuggestionRow: React.FC<SuggestionRowProps> = ({ suggestion, reveal }) => {
  const t = useT();
  const scopeKey = namespaceToScopeKey(suggestion.scope);
  const label = scopeKey ? SCOPE_COLORS[scopeKey].label : suggestion.scope;
  const { preview } = suggestion;
  const isStale = preview.kind === 'stale';
  const needsRerun =
    (preview.kind === 'value' || preview.kind === 'stale') && preview.definitionallyStale === true;
  return (
    <div
      role="group"
      aria-label={`${label}: ${suggestion.reference}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 0',
        opacity: suggestion.disabled ? 0.5 : 1,
      }}
    >
      {scopeKey && scopeBadge(scopeKey, 18)}
      <Text
        strong
        style={{
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          flexShrink: 0,
        }}
      >
        {suggestion.reference}
      </Text>
      <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {renderPreview(suggestion, reveal === true, t)}
        {isStale && (
          <Text type="warning" style={{ fontSize: 10 }}>
            {t('shared.templateInput.staleBadge')}
          </Text>
        )}
        {needsRerun && (
          <Text type="danger" style={{ fontSize: 10 }}>
            {t('shared.templateInput.needsRerunBadge')}
          </Text>
        )}
      </span>
    </div>
  );
};

export default SuggestionRow;
