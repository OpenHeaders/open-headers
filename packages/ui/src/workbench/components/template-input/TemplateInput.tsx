/**
 * TemplateInput — contentEditable-backed field with inline `{{ref}}`
 * highlighting + suggestion popover.
 *
 * The editable element itself renders the styled spans (no mirror
 * overlay, no transparent-text hack). That collapses the textarea /
 * mirror two-layer design into a single source of truth and removes
 * the computed-style-sync machinery that was needed to keep the
 * layers aligned — whatever padding / font / letter-spacing the
 * caller sets applies to the only element that exists.
 *
 * Value lifecycle:
 *   - External `value` prop → `innerHTML = highlightText(value)`
 *     when `textContent` differs, preserving caret via a char-offset
 *     save/restore.
 *   - User input → read `textContent`, fire `onChange`, re-highlight
 *     with the same save/restore.
 *   - While the caret sits inside a `{{...}}` range, that span uses
 *     the neutral `editing` class so classification doesn't flicker
 *     red/blue on every keystroke; it snaps back to resolved /
 *     unresolved once the caret leaves.
 */

import { CloseCircleFilled } from '@ant-design/icons';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { theme } from 'antd';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
// Co-located styles travel with the component — anyone who imports
// TemplateInput automatically gets `{{ref}}` highlighting + suggestion
// popover chrome without per-app CSS plumbing.
import './template-input.css';
import { useSettingValue } from '../../settings/hooks';
import { getCaretOffset, setCaretOffset } from './caret';
import { type RefState, renderHighlightedHtml, TEMPLATE_REGEX } from './highlight';
import { useAutoSuggestionContext } from './SuggestionContextProvider';
import SuggestionPopover from './SuggestionPopover';
import type { TemplateInputProps } from './types';
import { useGripResize } from './use-grip-resize';
import { useTemplateSuggestions } from './use-template-suggestions';

const TemplateInput = forwardRef<HTMLDivElement, TemplateInputProps>(
  (
    {
      value,
      onChange,
      suggestionContext,
      multiline = false,
      expandOnFocus = false,
      wrap = false,
      expanded,
      maxRows = 5,
      resizable = false,
      allowClear = false,
      placeholder = '',
      size = 'middle',
      variant = 'outlined',
      disableSuggestions = false,
      style,
      className,
      onPressEnter,
      onFocus,
      onBlur,
      autoFocus,
      id,
      'aria-label': ariaLabel,
      status,
      secret = false,
      flagUnresolved = false,
    },
    ref,
  ) => {
    const editableRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useCallback(
      (instance: HTMLDivElement | null) => {
        editableRef.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = instance;
      },
      [ref],
    );

    const autoContext = useAutoSuggestionContext();
    const effectiveContext = suggestionContext ?? autoContext;
    const resolver = useVariableResolver();
    const autocompleteEnabled = useSettingValue('rulesEngine.variableAutocomplete');
    const effectiveDisable = disableSuggestions || !autocompleteEnabled;
    const { token } = theme.useToken();

    const [isFocused, setIsFocused] = useState(false);

    // Classifier: delegates to the live resolver. Memoised by (resolver,
    // collectionId) so the `renderHighlightedHtml` recompute doesn't
    // build a new closure every render.
    const classify = useCallback(
      (inner: string): RefState => {
        const context = effectiveContext.collectionId ? { collectionId: effectiveContext.collectionId } : undefined;
        const { errors } = resolver.resolveTemplate(`{{${inner}}}`, context);
        if (errors.length === 0) return 'resolved';
        if (errors[0].reason === 'reserved-namespace') return 'reserved';
        return 'unresolved';
      },
      [resolver, effectiveContext.collectionId],
    );

    // Whether the value holds an UNRESOLVED ref — drives the optional
    // right-end dot. Reuses the highlighter's classifier so the dot stays
    // in lockstep with the red ref highlight; only walked when opted in.
    const hasUnresolvedRef = useMemo(() => {
      if (!flagUnresolved || !value) return false;
      for (const m of value.matchAll(new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags))) {
        if (classify(m[1]) === 'unresolved') return true;
      }
      return false;
    }, [flagUnresolved, value, classify]);

    const {
      isOpen,
      suggestions,
      activeIndex,
      setActiveIndex,
      measureDouble,
      popoverCoords,
      createTarget,
      insertReference,
      triggerCreate,
      closeSuggestions,
      handleInput,
      handleKeyDown,
      handleKeyUpOrMouseUp,
      handlePaste,
      handleEditableMouseOver,
      handleEditableMouseOut,
    } = useTemplateSuggestions({
      editableRef,
      value,
      onChange,
      onPressEnter,
      multiline,
      effectiveContext,
      effectiveDisable,
      classify,
    });

    // Sync external `value` prop → innerHTML. Only writes when the
    // current text content differs from `value` (prevents every
    // external re-render from clobbering the caret).
    useEffect(() => {
      const root = editableRef.current;
      if (!root) return;
      const next = value ?? '';
      const current = root.textContent ?? '';
      const focused = document.activeElement === root;
      const caretWas = focused ? getCaretOffset(root) : null;
      const html = renderHighlightedHtml(next, caretWas, classify);
      if (root.innerHTML !== html) {
        root.innerHTML = html;
        if (focused && caretWas !== null && current === next) {
          // Re-highlight only — restore previous caret position.
          setCaretOffset(root, caretWas);
        } else if (focused) {
          // External value change — anchor caret at end.
          setCaretOffset(root, next.length);
        }
      }
    }, [value, classify]);

    // `autoFocus` equivalent — contentEditable doesn't honor the HTML
    // attribute, so we focus imperatively after mount.
    useEffect(() => {
      if (!autoFocus) return;
      editableRef.current?.focus();
    }, [autoFocus]);

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(true);
        // Re-render so the ref the caret lands in renders neutral.
        handleKeyUpOrMouseUp();
        onFocus?.(e);
      },
      [onFocus, handleKeyUpOrMouseUp],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(false);
        closeSuggestions();
        // Re-classify refs now that the caret isn't tracked.
        const root = editableRef.current;
        if (root) {
          const text = root.textContent ?? '';
          const html = renderHighlightedHtml(text, null, classify);
          if (root.innerHTML !== html) root.innerHTML = html;
        }
        onBlur?.(e);
      },
      [onBlur, classify, closeSuggestions],
    );

    // Derive paddings from `size` — match AntD defaults so we visually
    // line up with sibling AntD inputs. Caller styles override via
    // `style` prop (applied last).
    const sizePadding = size === 'small' ? '0 7px' : size === 'large' ? '6.5px 11px' : '4px 11px';
    const sizeMinHeight = size === 'small' ? 24 : size === 'large' ? 40 : 32;

    // `status === 'error'` wins regardless of focus so the error
    // colour doesn't flicker back to primary-blue when the field is
    // active — matches AntD Input's behaviour.
    const borderColor = status === 'error' ? token.colorError : isFocused ? token.colorPrimary : token.colorBorder;
    const focusShadow =
      status === 'error' ? `0 0 0 2px ${token.colorErrorBorderHover}` : `0 0 0 2px ${token.controlOutline}`;

    // Split the caller's `style` between the two elements. Layout keys
    // (flex sizing, width) belong on the WRAPPER — the element that
    // participates in the parent's flex/grid layout — while surface
    // keys (padding, fonts, heights) belong on the editable, which
    // fills the wrapper. Without the split the wrapper stays at its
    // `width: 100%` default while e.g. `width: 180` lands on the
    // editable, so the two disagree about the field's box — and the
    // absolutely-positioned chrome (clear ✕, resize grip) anchors to
    // the phantom full-row wrapper, painting over neighboring fields.
    const [layoutStyle, surfaceStyle] = useMemo(() => {
      const layoutKeys = new Set([
        'flex',
        'flexGrow',
        'flexShrink',
        'flexBasis',
        'width',
        'minWidth',
        'maxWidth',
        'alignSelf',
      ]);
      const layout: Record<string, unknown> = {};
      const surface: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(style ?? {})) {
        (layoutKeys.has(key) ? layout : surface)[key] = val;
      }
      return [layout as React.CSSProperties, surface as React.CSSProperties];
    }, [style]);

    // Wrapped, growable surface: always for `multiline`, or for an
    // `expandOnFocus` field while it's active. "Active" is the controlled
    // `expanded` prop when supplied (so a row can expand all its cells
    // together), else the field's own focus. Collapsed-ellipsis is the
    // inactive state of an `expandOnFocus` field.
    const expandActive = expanded ?? isFocused;
    const displayExpanded = multiline || wrap || (expandOnFocus && expandActive);
    const displayCollapsed = expandOnFocus && !wrap && !expandActive;

    const { manualHeight, setManualHeight, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp } =
      useGripResize(editableRef);

    // AntD-parity clear affordance: clears both the DOM (covers
    // uncontrolled use) and the controlled value, keeping focus in the
    // field so the user can type the replacement straight away.
    const showClear = allowClear && (value ?? '').length > 0;
    const handleClear = useCallback(() => {
      const root = editableRef.current;
      if (root) {
        root.innerHTML = '';
        root.focus();
      }
      onChange?.('');
    }, [onChange]);

    const editableStyle: React.CSSProperties = {
      minHeight: sizeMinHeight,
      padding: sizePadding,
      // Reserve just enough room that the last characters don't slide
      // under the ✕ (12px icon + its inset + a 2px gap).
      ...(showClear ? { paddingRight: displayExpanded ? 26 : 22 } : null),
      lineHeight: 1.5714,
      fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
      fontFamily: 'inherit',
      color: token.colorText,
      background: variant === 'borderless' ? 'transparent' : token.colorBgContainer,
      border: variant === 'borderless' ? 'none' : `1px solid ${borderColor}`,
      borderRadius: variant === 'borderless' ? 0 : token.borderRadius,
      outline: 'none',
      cursor: 'text',
      width: '100%',
      boxSizing: 'border-box',
      // Display mode (separate from `multiline` newline SEMANTICS):
      //   - expanded → word-wrap + vertical scroll (multiline surface,
      //     or an expand-on-focus field while it has focus)
      //   - collapsed-ellipsis → one line, clipped with an ellipsis
      //     (an expand-on-focus field while blurred)
      //   - default single-line → one line, horizontal caret-scroll
      whiteSpace: displayExpanded ? 'pre-wrap' : displayCollapsed ? 'nowrap' : 'pre',
      overflowX: displayExpanded || displayCollapsed ? 'hidden' : 'auto',
      overflowY: displayExpanded ? 'auto' : 'hidden',
      textOverflow: displayCollapsed ? 'ellipsis' : undefined,
      // Auto-grow cap for the wrapped editor (`multiline`, `wrap`, or an
      // expand-on-focus field while active): ~maxRows lines (lineHeight
      // 1.5714) + a little padding allowance; past it the surface
      // inner-scrolls. A grip-dragged manual height replaces the cap
      // entirely — the user's chosen size wins. (Callers can still
      // override via `style.maxHeight`, applied after this block.)
      height: displayExpanded && resizable && manualHeight != null ? manualHeight : undefined,
      maxHeight:
        displayExpanded && resizable && manualHeight != null
          ? 'none'
          : displayExpanded
            ? `${(maxRows * 1.5714 + 0.9).toFixed(2)}em`
            : undefined,
      wordBreak: displayExpanded ? 'break-word' : 'normal',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: isFocused && variant !== 'borderless' ? focusShadow : undefined,
      ...surfaceStyle,
      // An expand-on-focus caller sets a tall `line-height` to vertically
      // center the single collapsed line in the cell; once it expands,
      // force the normal line-height so the wrapped multi-line editor
      // isn't loosely spaced. (After the style spread so it wins.)
      ...(expandOnFocus && expandActive ? { lineHeight: 1.5714 } : null),
    };

    return (
      <span
        className={`oh-template-input-wrapper${hasUnresolvedRef ? ' oh-template-input-wrapper--flagged' : ''}${className ? ` ${className}` : ''}`}
        style={layoutStyle}
      >
        <div
          ref={mergedRef}
          className={`oh-template-input-editable${displayExpanded ? ' oh-template-input-editable--expanded' : ''}${secret ? ' oh-template-input-secret' : ''}`}
          contentEditable
          suppressContentEditableWarning
          role="combobox"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          spellCheck={false}
          id={id}
          data-placeholder={placeholder}
          style={editableStyle}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUpOrMouseUp}
          onMouseUp={handleKeyUpOrMouseUp}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseOver={handleEditableMouseOver}
          onMouseOut={handleEditableMouseOut}
        />
        {resizable && (
          <div
            className="oh-template-input-resize-grip"
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onDoubleClick={() => setManualHeight(null)}
            aria-hidden="true"
          />
        )}
        {showClear && (
          <CloseCircleFilled
            className="oh-template-input-clear"
            aria-label="Clear value"
            style={{
              // Inset left of the resize grip's column (a one-row expanded
              // field puts "top-right" and "bottom-right" at the same
              // spot, so side-by-side is the only non-overlapping layout —
              // same as AntD TextArea's allowClear + resize). Also clears
              // the unresolved dot when flagged. Top-right on an expanded
              // surface, centered on a single line.
              // Expanded: sit immediately left of the 8px scrollbar column
              // (the grip below never collides — the scrollbar track stops
              // above it). Single line: hug the right edge. The unresolved
              // dot pushes either further left.
              right: (displayExpanded ? 10 : 6) + (hasUnresolvedRef ? 10 : 0),
              // Expanded: pin to the first line's center (size-dependent —
              // small fields have no vertical padding). Single line:
              // center in the field.
              ...(displayExpanded ? { top: size === 'small' ? 4 : 9 } : { top: '50%', transform: 'translateY(-50%)' }),
            }}
            // preventDefault keeps the editable focused through the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          />
        )}
        {isOpen &&
          popoverCoords &&
          // A lone `{` only opens the popover once it has a match —
          // `{{` (clear template intent) always opens, even to show
          // "No matches" — so a literal brace in a value doesn't flash
          // an empty list.
          (suggestions.length > 0 || measureDouble) &&
          createPortal(
            <div
              className="oh-template-popover-anchor"
              style={{ top: popoverCoords.top, bottom: popoverCoords.bottom, left: popoverCoords.left }}
            >
              <SuggestionPopover
                suggestions={suggestions}
                activeIndex={activeIndex}
                maxListHeight={popoverCoords.maxListHeight}
                onActiveIndexChange={setActiveIndex}
                onSelect={insertReference}
                createAction={
                  createTarget
                    ? {
                        label: (
                          <>
                            Create “{createTarget.name}” in {createTarget.scopeLabel}
                          </>
                        ),
                        onSelect: triggerCreate,
                      }
                    : undefined
                }
              />
            </div>,
            document.body,
          )}
        {hasUnresolvedRef && (
          <span
            className="oh-template-input-unresolved-dot"
            aria-hidden="true"
            title="Contains an unresolved variable"
          />
        )}
      </span>
    );
  },
);

TemplateInput.displayName = 'TemplateInput';

export default TemplateInput;
