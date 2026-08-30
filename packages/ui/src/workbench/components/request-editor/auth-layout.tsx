/**
 * auth-layout — the Authorization tab anatomy every protocol editor
 * shares: a sticky left rail (auth-type picker + contextual note)
 * behind a draggable divider, a right pane for the type's form, the
 * centered empty state for the no-auth case, the 90px labeled row and
 * the masked secret field. The HTTP tab is the reference; the MQTT and
 * gRPC tabs render the same parts so the three read as one surface.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type GripResizeXEvent, TemplateInput } from '../template-input';
import { useValueEditAction } from '../value-editors';

const { Text } = Typography;

// Draggable rail bounds — narrow enough to reclaim space for long
// credentials, wide enough that every auth-type label stays readable.
const RAIL_MIN = 160;
const RAIL_MAX = 420;
const RAIL_DEFAULT = 210;

// Untouched fields cap at the classic form width (the row containers
// are full-pane so a grip drag has room to grow); a manual width
// escapes the cap up to the pane edge.
export const AUTH_FIELD_DEFAULT_MAX_WIDTH = 438;

const SECRET_FIELD_MIN_WIDTH = 160;

export const AuthTabShell: React.FC<{ rail: React.ReactNode; children: React.ReactNode }> = ({ rail, children }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  return (
    <div style={{ display: 'flex', minHeight: 320 }}>
      {/* Left rail — sticks to the top of the scroll container so the
          auth-type picker stays visible while a long right-pane form
          scrolls past it. `align-self: start` keeps the rail
          content-sized so `position: sticky` has something to anchor
          against; without it the flex item stretches to the row's
          full height and sticky collapses to a no-op. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: railWidth,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
        }}
      >
        {rail}
      </div>

      {/* Draggable divider — resizes the rail within [RAIL_MIN, RAIL_MAX];
          double-click resets. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-drag-only resize affordance */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('workbench.editors.request.auth.resizeRailAria')}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { startX: e.clientX, startWidth: railWidth };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          const next = drag.startWidth + (e.clientX - drag.startX);
          setRailWidth(Math.min(RAIL_MAX, Math.max(RAIL_MIN, next)));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onDoubleClick={() => setRailWidth(RAIL_DEFAULT)}
        style={{
          width: 9,
          margin: '0 6px',
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          touchAction: 'none',
        }}
      >
        <span style={{ width: 1, background: token.colorBorderSecondary }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
};

export const AuthTypeLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text strong style={{ fontSize: 12 }}>
    {children}
  </Text>
);

export const AuthRailNote: React.FC<{ children: string }> = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
    {children}
  </Text>
);

// Centered pane for the types that carry no form — an optional glyph
// tile above the type name and its note.
export const AuthEmptyState: React.FC<{ title: string; note: string; glyph?: string; testId?: string }> = ({
  title,
  note,
  glyph,
  testId,
}) => {
  const { token } = theme.useToken();
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: token.colorTextTertiary,
        gap: 8,
      }}
    >
      {glyph !== undefined && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            background: token.colorFillTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: token.colorTextSecondary,
          }}
        >
          {glyph}
        </div>
      )}
      <Text strong style={{ fontSize: 14 }}>
        {title}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
        {note}
      </Text>
    </div>
  );
};

export const AuthForm: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
);

export const AuthLabeledRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'start', gap: 12 }}>
    <Text style={{ fontSize: 13, lineHeight: '24px' }}>{label}</Text>
    <div style={{ minWidth: 0 }}>{children}</div>
  </div>
);

// ── Secret credential field ────────────────────────────────────────
//
// Long secrets (a 500-char JWT) must never force the tab to scroll
// horizontally: collapsed, the field is one masked line with an
// ellipsis; focusing it expands to a textarea-style surface that
// wraps, grows to ~7 lines, then inner-scrolls. The in-field eye
// reveals/masks the literal characters (`{{ref}}` spans are always
// readable either way). The 2D corner grip resizes both axes — the
// field owns its width here (no column split to feed), so X travel
// sets an explicit width; double-click restores the default.

export const AuthSecretField: React.FC<{
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  'data-testid'?: string;
}> = ({ value, onChange, placeholder, 'data-testid': dataTestId }) => {
  const [revealed, setRevealed] = useState(false);
  const [manualWidth, setManualWidth] = useState<number | null>(null);
  const widthDragRef = useRef<{ startWidth: number } | null>(null);
  const handleResizeX = useCallback((e: GripResizeXEvent) => {
    if (e.phase === 'reset') {
      widthDragRef.current = null;
      setManualWidth(null);
      return;
    }
    if (e.phase === 'start') {
      const wrapper = e.gripEl.closest('.oh-template-input-wrapper');
      widthDragRef.current = wrapper instanceof HTMLElement ? { startWidth: wrapper.offsetWidth } : null;
      return;
    }
    if (e.phase === 'end') {
      widthDragRef.current = null;
      return;
    }
    const drag = widthDragRef.current;
    if (!drag) return;
    setManualWidth(Math.max(SECRET_FIELD_MIN_WIDTH, drag.startWidth + e.deltaX));
  }, []);
  const { editProps, editorModal } = useValueEditAction(value, onChange);
  return (
    <>
      <TemplateInput
        size="small"
        secret={!revealed}
        onSecretToggle={() => setRevealed((v) => !v)}
        {...editProps}
        expandOnFocus
        maxRows={7}
        resizable
        onResizeX={handleResizeX}
        allowClear
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        data-testid={dataTestId}
        // Default caps at the classic form width; a grip-dragged width
        // lifts the cap and the field grows into the pane's free space.
        style={
          manualWidth != null
            ? { width: manualWidth, minWidth: 0 }
            : { minWidth: 0, maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH }
        }
      />
      {editorModal}
    </>
  );
};
