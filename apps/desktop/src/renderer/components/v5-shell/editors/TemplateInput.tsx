/**
 * TemplateInput — contentEditable input with inline variable highlighting
 * and hover popovers showing resolved values.
 *
 * Uses contentEditable (not <input>) so {{VAR}} can be rendered as colored
 * inline spans. Cursor position is preserved across re-highlights.
 * Invisible overlay divs track each var span's position for Ant Popover.
 *
 * Adapted from the wat2 browser-extension MVP TemplateInput.
 */

import { Popover, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TemplateInput.css';

const { Text } = Typography;

interface EnvVarInfo {
  value: string;
  isSecret: boolean;
}

export interface TemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  envVars?: Record<string, EnvVarInfo>;
  activeEnvironment?: string;
  borderless?: boolean;
  fontSize?: number;
  mono?: boolean;
  onPressEnter?: () => void;
  style?: React.CSSProperties;
}

interface VarOverlay {
  varName: string;
  rect: DOMRect;
}

// ── Cursor helpers ────────────────────────────────────────────────

function saveCursorPosition(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(el);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function restoreCursorPosition(el: HTMLElement, position: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let charCount = 0;
  let found = false;

  const walk = (node: Node): void => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (charCount + len >= position) {
        range.setStart(node, position - charCount);
        range.setEnd(node, position - charCount);
        found = true;
      }
      charCount += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
        if (found) break;
      }
    }
  };

  walk(el);
  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// ── Main component ────────────────────────────────────────────────

export function TemplateInput({
  value,
  onChange,
  placeholder = '',
  envVars,
  activeEnvironment,
  borderless,
  fontSize,
  mono,
  onPressEnter,
  style,
}: TemplateInputProps) {
  const { token } = theme.useToken();
  const editableRef = useRef<HTMLDivElement>(null);
  const [varOverlays, setVarOverlays] = useState<VarOverlay[]>([]);

  // All known var names for resolution checking
  const knownVars = useMemo(() => new Set(Object.keys(envVars || {})), [envVars]);

  // Build highlighted HTML from text
  const highlightText = useCallback(
    (text: string): string => {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return escaped.replace(/(\{\{([^}]*)\}\})/g, (_match, fullMatch: string, varName: string) => {
        const trimmed = varName.trim();
        const cls = knownVars.has(trimmed) ? 'template-var-resolved' : 'template-var-unresolved';
        return `<span class="${cls}" data-var="${trimmed}">${fullMatch}</span>`;
      });
    },
    [knownVars],
  );

  // Collect overlay positions for popover targets
  const updateOverlays = useCallback(() => {
    if (!editableRef.current) return;
    const spans = editableRef.current.querySelectorAll('.template-var-resolved, .template-var-unresolved');
    const overlays: VarOverlay[] = [];
    for (const span of Array.from(spans)) {
      const varName = (span as HTMLElement).getAttribute('data-var');
      if (varName) {
        overlays.push({ varName, rect: span.getBoundingClientRect() });
      }
    }
    setVarOverlays(overlays);
  }, []);

  // Handle input
  const handleInput = useCallback(() => {
    if (!editableRef.current) return;
    const cursorPos = saveCursorPosition(editableRef.current);
    const text = editableRef.current.textContent || '';
    onChange(text);
    editableRef.current.innerHTML = highlightText(text);
    restoreCursorPosition(editableRef.current, cursorPos);
    // Delay overlay update to let browser layout
    setTimeout(updateOverlays, 10);
  }, [onChange, highlightText, updateOverlays]);

  // Handle paste — insert plain text only
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      selection.deleteFromDocument();
      const textNode = document.createTextNode(text);
      selection.getRangeAt(0).insertNode(textNode);
      const range = document.createRange();
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      handleInput();
    },
    [handleInput],
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onPressEnter?.();
      }
    },
    [onPressEnter],
  );

  // Sync innerHTML when value or vars change externally
  useEffect(() => {
    if (!editableRef.current) return;
    const currentText = editableRef.current.textContent || '';
    if (currentText !== value) {
      editableRef.current.innerHTML = highlightText(value);
      setTimeout(updateOverlays, 10);
    } else {
      // Same text but highlighting might need updating (e.g. vars changed)
      const newHTML = highlightText(value);
      if (editableRef.current.innerHTML !== newHTML) {
        const cursorPos = saveCursorPosition(editableRef.current);
        editableRef.current.innerHTML = newHTML;
        restoreCursorPosition(editableRef.current, cursorPos);
        setTimeout(updateOverlays, 10);
      }
    }
  }, [value, highlightText, updateOverlays]);

  // Update overlays on scroll/resize
  useEffect(() => {
    const handler = () => updateOverlays();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [updateOverlays]);

  const borderStyle = borderless ? {} : { border: `1px solid ${token.colorBorder}`, borderRadius: 6 };

  return (
    <div className="template-input-wrapper" style={style}>
      <div
        ref={editableRef}
        className="template-input"
        contentEditable
        role="textbox"
        tabIndex={0}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        spellCheck={false}
        style={{
          minHeight: 24,
          padding: '4px 11px',
          outline: 'none',
          fontSize: fontSize || 12,
          lineHeight: '22px',
          fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : 'inherit',
          cursor: 'text',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: token.colorText,
          background: 'transparent',
          ...borderStyle,
        }}
      />

      {/* Invisible overlay divs for Popover hover targets */}
      {envVars &&
        activeEnvironment &&
        varOverlays.map(({ varName, rect }, i) => {
          const variable = envVars[varName];
          const resolved = !!variable;
          const displayValue = variable?.isSecret ? '••••••••' : variable?.value;

          return (
            <Popover
              key={`${varName}-${i}`}
              placement="bottom"
              trigger="hover"
              mouseEnterDelay={0.15}
              content={
                <div style={{ minWidth: 180 }}>
                  <div style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}>
                      {varName}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: '4px 8px',
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 4,
                      fontFamily: "'SF Mono', monospace",
                      fontSize: 12,
                      wordBreak: 'break-all',
                      marginBottom: 6,
                    }}
                  >
                    {resolved ? displayValue : <Text type="danger">Not defined</Text>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ color: '#3498db', fontWeight: 700 }}>E</span>
                    <span>{activeEnvironment}</span>
                  </div>
                </div>
              }
            >
              <div
                style={{
                  position: 'fixed',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  background: 'transparent',
                  pointerEvents: 'auto',
                  zIndex: 1,
                }}
              />
            </Popover>
          );
        })}
    </div>
  );
}
