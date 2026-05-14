/**
 * Shared layout primitives for the Live Variable / Live Workflow editors.
 *
 * `FieldRow` is a label-left two-column grid; the label column has a fixed
 * width so inputs across the form share a single vertical rule, which is
 * cheaper to scan than stacked CAPS labels above full-width fields.
 *
 * `Section` is a rule-style group header — a tight bottom divider instead
 * of a full 1px border so sections can stack without the visual fatigue of
 * nested boxes.
 *
 * These primitives are intentionally scoped to the Live editors — their
 * rhythm assumes compact forms with `size="small"` AntD inputs. The
 * Environment / Collection-vars editors keep their own tabular layout.
 */

import { Input, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

export const LIVE_ROW_LABEL_WIDTH = 108;
export const LIVE_ROW_GAP = 12;

interface FieldRowProps {
  label: string;
  /** Tiny text shown under the label — e.g. reference syntax hint. */
  hint?: React.ReactNode;
  /** Vertically center the input against the label (default). Set `false`
   *  when the input is multi-line and should start-align. */
  center?: boolean;
  /** Canonical schema path. When set, focus capture by ancestors that
   *  walk `closest('[data-field-path]')` resolves to this string —
   *  used by per-field awareness publishing. */
  fieldPath?: string;
  children: React.ReactNode;
}

export const FieldRow: React.FC<FieldRowProps> = ({ label, hint, center = true, fieldPath, children }) => {
  const { token } = theme.useToken();
  return (
    <div
      data-field-path={fieldPath}
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIVE_ROW_LABEL_WIDTH}px 1fr`,
        gap: LIVE_ROW_GAP,
        alignItems: center ? 'center' : 'start',
        minHeight: 28,
      }}
    >
      <div style={{ paddingTop: center ? 0 : 6 }}>
        <Text style={{ fontSize: 12 }}>{label}</Text>
        {hint && (
          <div style={{ fontSize: 10, color: token.colorTextTertiary, lineHeight: 1.3, marginTop: 1 }}>{hint}</div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
};

interface SectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children }) => {
  const { token } = theme.useToken();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 6,
          marginBottom: 8,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 11,
          fontWeight: 500,
          color: token.colorTextSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
};

interface InlineNameDescriptionProps {
  name: string;
  description: string;
  onChangeName: (next: string) => void;
  onChangeDescription: (next: string) => void;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  /** Width of the name column. Descriptions take the remaining flex-1 space. */
  nameWidth?: number;
}

/**
 * Inline Name + Description row. Name is a short identifier input on
 * the left; Description is a flexible text-area filling the rest.
 *
 * Used by both `LiveWorkflowEditor` (workflow name/description) and
 * `LiveVariableEditor` CreateMode (LV name/description). Extracted to
 * keep the rhythm identical across both editors — the same rows on
 * different entity types should look and behave the same.
 */
export const InlineNameDescription: React.FC<InlineNameDescriptionProps> = ({
  name,
  description,
  onChangeName,
  onChangeDescription,
  namePlaceholder = 'Name',
  descriptionPlaceholder = 'Description (optional)',
  nameWidth = 200,
}) => {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Input
        size="small"
        style={{ width: nameWidth, flexShrink: 0 }}
        placeholder={namePlaceholder}
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
      />
      <Input.TextArea
        size="small"
        style={{ flex: 1 }}
        autoSize={{ minRows: 1, maxRows: 3 }}
        placeholder={descriptionPlaceholder}
        value={description}
        onChange={(e) => onChangeDescription(e.target.value)}
      />
    </div>
  );
};
