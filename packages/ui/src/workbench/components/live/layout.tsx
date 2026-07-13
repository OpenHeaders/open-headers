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

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

export const LIVE_ROW_LABEL_WIDTH = 108;
export const LIVE_ROW_GAP = 12;
/** Horizontal padding of the Live editors' form scroll wrapper. Sticky
 *  header/floor surfaces bleed by this amount so their background spans
 *  the full scrollport — otherwise content (e.g. a selected card's
 *  1px selection ring, which paints outside its box) peeks through the
 *  padding gutters while scrolling. */
export const LIVE_FORM_PAD_X = 20;

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
  /** Pin the header row to the top of the nearest scroll container so
   *  its affordances stay reachable while the body scrolls. */
  sticky?: boolean;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, sticky = false, children }) => {
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
          ...(sticky && {
            position: 'sticky' as const,
            top: 0,
            zIndex: 3,
            background: token.colorBgContainer,
            paddingTop: 6,
            marginInline: -LIVE_FORM_PAD_X,
            paddingInline: LIVE_FORM_PAD_X,
          }),
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
};

interface InlineDescriptionProps {
  description: string;
  onChangeDescription: (next: string) => void;
  descriptionPlaceholder?: string;
}

/**
 * Standalone description text-area — the description half of
 * {@link InlineNameDescription}, reusable on its own where the entity is
 * renamed elsewhere (e.g. `LiveWorkflowEditor` renames via the tab strip
 * / sidebar, so only the description belongs in the form body). Grows to
 * fill its row via `flex: 1`; full-width when it has no name sibling.
 */
export const InlineDescription: React.FC<InlineDescriptionProps> = ({
  description,
  onChangeDescription,
  descriptionPlaceholder,
}) => {
  const t = useT();
  return (
    <Input.TextArea
      size="small"
      style={{ flex: 1, width: '100%' }}
      autoSize={{ minRows: 1, maxRows: 3 }}
      placeholder={descriptionPlaceholder ?? t('workbench.editors.live.form.descriptionPlaceholder')}
      value={description}
      onChange={(e) => onChangeDescription(e.target.value)}
    />
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
 * the left; Description ({@link InlineDescription}) is a flexible
 * text-area filling the rest.
 *
 * Used by `LiveVariableEditor` CreateMode (LV name/description). Kept as
 * the canonical "rename in the form" row so editors that DO own their
 * name inline look and behave identically.
 */
export const InlineNameDescription: React.FC<InlineNameDescriptionProps> = ({
  name,
  description,
  onChangeName,
  onChangeDescription,
  namePlaceholder,
  descriptionPlaceholder,
  nameWidth = 200,
}) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Input
        size="small"
        style={{ width: nameWidth, flexShrink: 0 }}
        placeholder={namePlaceholder ?? t('workbench.editors.live.form.namePlaceholder')}
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
      />
      <InlineDescription
        description={description}
        onChangeDescription={onChangeDescription}
        descriptionPlaceholder={descriptionPlaceholder}
      />
    </div>
  );
};
