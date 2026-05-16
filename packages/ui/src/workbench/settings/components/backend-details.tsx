/**
 * Compact topology diagrams for the Backend settings panel — one per
 * scenario. Renders below the picker; shows clients, the back-end
 * container, LAN/WAN reach, TLS/Auth annotations, and the URL pattern
 * for the active mode.
 *
 * Conceptually a "Browser" surface and a "Desktop App" surface render
 * the same workbench UI — so both are drawn as the same macOS-chrome
 * `BrowserWindow`, differentiated by a small `corner` label in the
 * chrome bar. Genuinely different shapes (CLI terminal, daemon rack,
 * cloud-mounted VM) keep their own glyphs.
 *
 * All primitives come from the docs (`BrowserWindow`, `ArrowDefs`,
 * palette tokens) + the lifted glyphs in `backend-icons.tsx` so the
 * visual identity matches the workbench docs.
 */

import type React from 'react';
import {
  ArrowDefs,
  BrowserWindow,
  FILL_BLUE,
  FILL_GREEN,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  TEXT,
  TEXT_DIM,
} from '../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../components/docs/diagrams/open-headers/_shared';
import { type DocSurface, SURFACE_LABELS, SurfaceGlyphBody } from '../../components/docs/shared';
import type { BackendMode } from '../schema/backend';
import { BackendGlyph } from './backend-icons';

interface DetailProps {
  mode: BackendMode;
}

export const BackendDetailDiagram: React.FC<DetailProps> = ({ mode }) => {
  switch (mode) {
    case 'in-browser':
      return <InBrowserDetail />;
    case 'desktop-app':
      return <DesktopAppDetail />;
    case 'local-self-hosted':
      return <LocalSelfHostedDetail />;
    case 'remote-self-hosted':
      return <RemoteSelfHostedDetail />;
  }
};

// ── Helpers ─────────────────────────────────────────────────────────

const SubLabel: React.FC<{ x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }> = ({
  x,
  y,
  text,
  anchor = 'middle',
}) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
    {text}
  </text>
);

const UrlLabel: React.FC<{ x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }> = ({
  x,
  y,
  text,
  anchor = 'middle',
}) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontSize={10}
    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
    fill={TEXT}
  >
    {text}
  </text>
);

const Cloud: React.FC<{ cx: number; cy: number; scale?: number; label?: string }> = ({
  cx,
  cy,
  scale = 1,
  label,
}) => {
  const s = scale;
  const d = `
    M ${cx - 28 * s} ${cy + 6 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${-18 * s}
    a ${12 * s} ${12 * s} 0 0 1 ${22 * s} ${-4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${20 * s} ${4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${20 * s}
    h ${-50 * s}
    a ${8 * s} ${8 * s} 0 0 1 0 ${-2 * s}
    z
  `;
  return (
    <g>
      <path d={d} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1} strokeDasharray="3 2" />
      {label && (
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      )}
    </g>
  );
};

/**
 * Big desktop-monitor frame used as the outer "this is one machine"
 * container — monitor body + inset screen area + a small stand below.
 * Child SVG content renders inside the screen area; consumers should
 * lay content out within `{x + INSET, y + INSET}` to `{x + w - INSET, y + h - INSET}`.
 */
// Neutral grey for the device-frame outer container so the BLUE
// children (BrowserWindow, BackendGlyph) stay visually dominant.
// The frame reads as "this is hardware / a host" while the contents
// read as "these are the apps".
const DEVICE_FRAME_STROKE = 'var(--ant-color-border)';
const DEVICE_FRAME_FILL_INSET = 'var(--ant-color-fill-quaternary)';
const DEVICE_FRAME_FILL_BODY = 'var(--ant-color-bg-container)';

const DESKTOP_SCREEN_INSET = 10;
const DesktopContainer: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  children?: React.ReactNode;
}> = ({ x, y, w, h, label, children }) => {
  const standTopW = 70;
  const standBotW = 110;
  const standH = 10;
  const baseH = 3;
  return (
    <g>
      {/* Monitor body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={DEVICE_FRAME_FILL_BODY}
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={1.6}
      />
      {/* Inset screen */}
      <rect
        x={x + DESKTOP_SCREEN_INSET}
        y={y + DESKTOP_SCREEN_INSET}
        width={w - DESKTOP_SCREEN_INSET * 2}
        height={h - DESKTOP_SCREEN_INSET * 2}
        rx={5}
        fill={DEVICE_FRAME_FILL_INSET}
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={0.8}
      />
      {/* Stand (trapezoid) */}
      <path
        d={`M ${x + w / 2 - standTopW / 2} ${y + h}
            L ${x + w / 2 + standTopW / 2} ${y + h}
            L ${x + w / 2 + standBotW / 2} ${y + h + standH}
            L ${x + w / 2 - standBotW / 2} ${y + h + standH}
            Z`}
        fill="var(--ant-color-fill-tertiary)"
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={1}
      />
      {/* Base bar */}
      <rect
        x={x + w / 2 - standBotW / 2 - 6}
        y={y + h + standH}
        width={standBotW + 12}
        height={baseH}
        rx={1.5}
        fill={DEVICE_FRAME_STROKE}
        opacity={0.7}
      />
      {label && (
        <text
          x={x + w / 2}
          y={y + h + standH + baseH + 22}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {label}
        </text>
      )}
      {children}
    </g>
  );
};

/**
 * Y coordinate of the bottom edge of a `DesktopContainer`'s label.
 * Consumers anchor their next-row content under this so labels stack
 * cleanly instead of fighting for vertical space.
 */
function desktopContainerBottomY(y: number, h: number): number {
  // y + h + stand (10) + baseH (3) + label-baseline-offset (22) + descender (~4)
  return y + h + 10 + 3 + 22 + 4;
}

/**
 * Compact laptop frame — screen body on top + short trapezoidal
 * keyboard underneath. Same grey palette as the desktop monitor so the
 * two read as members of the same "device hardware" family. Content
 * children render inside the screen inset.
 */
const LAPTOP_SCREEN_INSET = 8;
const LaptopContainer: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  children?: React.ReactNode;
}> = ({ x, y, w, h, label, children }) => {
  const kbTopW = w * 0.6;
  const kbBotW = w * 0.9;
  const kbH = 7;
  return (
    <g>
      {/* Screen body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={1.6}
      />
      {/* Inset screen */}
      <rect
        x={x + LAPTOP_SCREEN_INSET}
        y={y + LAPTOP_SCREEN_INSET}
        width={w - LAPTOP_SCREEN_INSET * 2}
        height={h - LAPTOP_SCREEN_INSET * 2}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={0.8}
      />
      {/* Keyboard trapezoid */}
      <path
        d={`M ${x + w / 2 - kbTopW / 2} ${y + h}
            L ${x + w / 2 + kbTopW / 2} ${y + h}
            L ${x + w / 2 + kbBotW / 2} ${y + h + kbH}
            L ${x + w / 2 - kbBotW / 2} ${y + h + kbH}
            Z`}
        fill="var(--ant-color-fill-tertiary)"
        stroke={DEVICE_FRAME_STROKE}
        strokeWidth={1}
      />
      {/* Trackpad notch */}
      <rect
        x={x + w / 2 - 6}
        y={y + h + kbH - 2}
        width={12}
        height={1.5}
        rx={0.5}
        fill={DEVICE_FRAME_STROKE}
        opacity={0.5}
      />
      {label && (
        <text
          x={x + w / 2}
          y={y + h + kbH + 16}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {label}
        </text>
      )}
      {children}
    </g>
  );
};

function laptopContainerBottomY(y: number, h: number): number {
  // y + h + keyboard (7) + label-baseline-offset (16) + descender (~4)
  return y + h + 7 + 16 + 4;
}

/**
 * Server / rack frame — body with rack-style horizontal ribs at the
 * top. Used for the daemon (Local/LAN) and the VM (Remote/WAN).
 * Same grey frame palette as the device containers; the rack ribs
 * distinguish it visually as "this is a headless host, not a desk
 * device".
 */
const SERVER_SCREEN_INSET = 8;
const ServerContainer: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  children?: React.ReactNode;
}> = ({ x, y, w, h, label, children }) => (
  <g>
    {/* Outer body */}
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={8}
      fill="var(--ant-color-bg-container)"
      stroke={DEVICE_FRAME_STROKE}
      strokeWidth={1.6}
    />
    {/* Rack ribs at the top */}
    <line x1={x + 10} y1={y + 10} x2={x + w - 10} y2={y + 10} stroke={DEVICE_FRAME_STROKE} strokeWidth={0.8} opacity={0.6} />
    <line x1={x + 10} y1={y + 15} x2={x + w - 10} y2={y + 15} stroke={DEVICE_FRAME_STROKE} strokeWidth={0.8} opacity={0.6} />
    {/* Three drive-bay dots on the upper right */}
    <circle cx={x + w - 18} cy={y + 12.5} r={1.5} fill={DEVICE_FRAME_STROKE} opacity={0.7} />
    <circle cx={x + w - 13} cy={y + 12.5} r={1.5} fill={DEVICE_FRAME_STROKE} opacity={0.7} />
    {/* Inset content area below the rack ribs */}
    <rect
      x={x + SERVER_SCREEN_INSET}
      y={y + 22}
      width={w - SERVER_SCREEN_INSET * 2}
      height={h - 22 - SERVER_SCREEN_INSET}
      rx={4}
      fill="var(--ant-color-fill-quaternary)"
      stroke={DEVICE_FRAME_STROKE}
      strokeWidth={0.8}
    />
    {label && (
      <text
        x={x + w / 2}
        y={y + h + 18}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {label}
      </text>
    )}
    {children}
  </g>
);

function serverContainerBottomY(y: number, h: number): number {
  // y + h + label-baseline-offset (18) + descender (~4)
  return y + h + 18 + 4;
}

const ConnectorTls: React.FC<{ id: string; x1: number; y1: number; x2: number; y2: number }> = ({
  id,
  x1,
  y1,
  x2,
  y2,
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${id})`} />
      <circle cx={mx} cy={my} r={5.5} fill={FILL_GREEN} stroke={STROKE_GREEN} strokeWidth={1} />
      <rect x={mx - 2} y={my - 0.5} width={4} height={3.5} rx={0.6} fill={OH_GREEN} />
      <path
        d={`M ${mx - 1.6} ${my - 0.5} v -1.6 a 1.6 1.6 0 0 1 3.2 0 v 1.6`}
        stroke={OH_GREEN}
        strokeWidth={0.8}
        fill="none"
      />
    </g>
  );
};

/**
 * Compact "X = back-end" pill used inside every scenario container
 * (the in-browser SW pill, the desktop app's in-process pill, the
 * daemon pill on the Local/LAN scene, the VM pill on the Remote one).
 * One layout for the dot + main + sub so every diagram speaks the
 * same visual language.
 *
 * `engine` fills the X — "Service worker" / "Embedded server" /
 * "Local server" / "Remote server". `where` is appended after
 * "oracle · rule-engine · sync-engine · vault — " and conveys the
 * reach (no wire / localhost / LAN / WAN), matching the tier card's
 * footer cloud label.
 */
const BackEndPill: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  engine: string;
  where: string;
}> = ({ x, y, w, h = 76, engine, where }) => {
  const bulletX = x + 30;
  const textX = x + 36;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={FILL_GREEN} stroke={STROKE_GREEN} strokeWidth={1.5} />
      <circle cx={x + 16} cy={y + 18} r={4} fill={OH_GREEN} />
      <text x={x + 28} y={y + 22} fontSize={10.5} fontWeight={700} fill={TEXT}>
        Back-end = {engine}
      </text>
      <circle cx={bulletX} cy={y + 36} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 39} fontSize={8.5} fill={TEXT_DIM}>
        sync-engine · rule-engine
      </text>
      <circle cx={bulletX} cy={y + 50} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 53} fontSize={8.5} fill={TEXT_DIM}>
        oracle · vault
      </text>
      <circle cx={bulletX} cy={y + 64} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 67} fontSize={8.5} fill={TEXT_DIM}>
        {where}
      </text>
    </g>
  );
};

/**
 * Front-end pill — blue rounded container mirroring `BackEndPill`'s
 * silhouette. Shows the 4 user-facing surfaces of the extension
 * (popup / workbench / DevTools / side-panel) underneath a "Front-end
 * = N surfaces" title so the in-browser scenario reads as a balanced
 * front-end + back-end pair.
 */
interface FrontEndItem {
  label: string;
  glyph: React.ReactNode;
}

const FrontEndPill: React.FC<{ x: number; y: number; w: number; items: readonly FrontEndItem[] }> = ({
  x,
  y,
  w,
  items,
}) => {
  // Vertical rhythm with explicit paddings so title + glyphs + labels
  // have visible breathing room from the rect edges:
  //   top pad → title (~14) → gap → glyph (32) → label (14) → bottom pad
  const padTop = 10;
  const titleH = 14;
  const titleToGlyphGap = 10;
  const glyphH = 32;
  const labelH = 14;
  const padBottom = 12;
  const glyphTop = y + padTop + titleH + titleToGlyphGap;
  const h = padTop + titleH + titleToGlyphGap + glyphH + labelH + padBottom;
  const startX = x + 10;
  const endX = x + w - 10;
  const slotW = (endX - startX) / items.length;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1.5} />
      <circle cx={x + 16} cy={y + padTop + 6} r={4} fill={STROKE_BLUE} />
      <text x={x + 28} y={y + padTop + 10} fontSize={10.5} fontWeight={700} fill={TEXT}>
        Front-end = {items.length} surface{items.length === 1 ? '' : 's'}
      </text>
      {items.map((it, i) => {
        const cx = startX + slotW * i + slotW / 2;
        return (
          <g key={it.label} transform={`translate(${cx - 21} ${glyphTop})`}>
            {it.glyph}
            <text x={21} y={glyphH + 14} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={TEXT}>
              {it.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * Headless glyph — browser-frame shell with `{ }` glyph inside,
 * signalling a server-side or programmatic client (SDK, headless
 * runtime, REST consumer) that has no human UI.
 */
function HeadlessGlyphBody({ accent }: { accent: string }) {
  const frameStroke = 'var(--ant-color-border)';
  const inner = 'var(--ant-color-bg-container)';
  return (
    <g>
      <title>Headless</title>
      <rect x={1} y={1} width={40} height={30} rx={3} fill={inner} stroke={frameStroke} />
      <line x1={1} y1={7} x2={41} y2={7} stroke={frameStroke} />
      <circle cx={4} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={6.5} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={9} cy={4} r={0.8} fill={frameStroke} />
      <text
        x={21}
        y={25}
        textAnchor="middle"
        fontSize={15}
        fontWeight={700}
        fill={accent}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {'{ }'}
      </text>
    </g>
  );
}

/**
 * Web App glyph — same browser-frame shell as `SurfaceGlyphBody` but
 * with a globe inside (circle with meridian + equator) to read as a
 * web-served front-end rather than a per-surface extension page.
 */
function WebAppGlyphBody({ accent }: { accent: string }) {
  const frameStroke = 'var(--ant-color-border)';
  const inner = 'var(--ant-color-bg-container)';
  return (
    <g>
      <title>Web App</title>
      <rect x={1} y={1} width={40} height={30} rx={3} fill={inner} stroke={frameStroke} />
      <line x1={1} y1={7} x2={41} y2={7} stroke={frameStroke} />
      <circle cx={4} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={6.5} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={9} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={21} cy={19.5} r={9} fill={accent} />
      <ellipse cx={21} cy={19.5} rx={3} ry={9} fill="none" stroke={inner} strokeWidth={0.8} opacity={0.85} />
      <line x1={12} y1={19.5} x2={30} y2={19.5} stroke={inner} strokeWidth={0.8} opacity={0.85} />
      <line x1={21} y1={10.5} x2={21} y2={28.5} stroke={inner} strokeWidth={0.6} opacity={0.6} />
    </g>
  );
}

// ── In-browser ─────────────────────────────────────────────────────

const InBrowserDetail: React.FC = () => (
  <svg viewBox="0 0 600 350" width="100%" role="img" aria-label="In-browser back-end">
    <DesktopContainer x={30} y={18} w={540} h={280} label="Your device">
      <BrowserWindow x={56} y={42} w={488} h={240} chromeH={20} title="Open Headers — Chrome / Edge / Firefox" corner="Browser">
        <FrontEndPill
          x={70}
          y={82}
          w={460}
          items={(['popup', 'workbench', 'devtools', 'side-panel'] as const).map((s) => ({
            label: SURFACE_LABELS[s],
            glyph: <SurfaceGlyphBody surface={s} accent="var(--ant-color-primary)" />,
          }))}
        />
        <BackEndPill x={70} y={196} w={460} engine="Embedded browser service worker" where="no wire" />
      </BrowserWindow>
    </DesktopContainer>
  </svg>
);

// ── Desktop app ────────────────────────────────────────────────────

const DesktopAppDetail: React.FC = () => {
  const ID = 'be-desktop-app';
  // The big monitor IS the machine — its screen area holds every
  // process running on it (the browsers + the Open Headers back-end).
  // Layout math:
  //   monitor at (30, 18) → (570, 228), screen inset 10 →
  //   usable screen area (40, 28) → (560, 218).
  return (
    <svg viewBox="0 0 600 350" width="100%" role="img" aria-label="Desktop app back-end">
      <ArrowDefs id={ID} />

      <DesktopContainer x={30} y={18} w={540} h={280} label="Your device">
        {/* Screen content lives inside the inset (y ∈ [28, 188]). The
            monitor's height was tightened so the screen wraps the
            content with even margins — no big empty band at the bottom. */}
        <BrowserWindow x={56} y={56} w={166} h={36} chromeH={18} title="Chrome" corner="Browser" />
        <BrowserWindow x={56} y={102} w={166} h={36} chromeH={18} title="Firefox" corner="Browser" />
        <BrowserWindow x={56} y={148} w={166} h={36} chromeH={18} title="Edge" corner="Browser" />
        <BrowserWindow
          x={56}
          y={196}
          w={166}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={64}
            y={228}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={76} y={222} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>

        {/* Back-end window on the right — same chrome shape as the
            browsers with "Desktop App" corner. Inside: a Front-end pill
            (Workbench + Web App surfaces) stacked above the green
            back-end pill, mirroring the in-browser scenario. */}
        <BrowserWindow x={290} y={50} w={264} h={224} chromeH={20} title="Open Headers" corner="Desktop App">
          <FrontEndPill
            x={302}
            y={90}
            w={240}
            items={[
              {
                label: 'Workbench',
                glyph: <SurfaceGlyphBody surface="workbench" accent="var(--ant-color-primary)" />,
              },
              { label: 'Web App', glyph: <WebAppGlyphBody accent="var(--ant-color-primary)" /> },
            ]}
          />
          <BackEndPill x={302} y={192} w={240} engine="Embedded server" where="localhost" />
        </BrowserWindow>

        {/* Connectors from each browser + the CLI right edge to the back-end window. */}
        <line x1={222} y1={74} x2={290} y2={130} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={120} x2={290} y2={150} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={166} x2={290} y2={170} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={220} x2={290} y2={220} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      </DesktopContainer>

      {/* Footer — descriptive sub-label centered (same pattern as
          the in-browser scenario), with a compact "Localhost" cloud
          + loopback URL parked on the right edge so the middle stays
          devoted to the one-line summary. */}
    </svg>
  );
};

// ── Local / LAN daemon ─────────────────────────────────────────────

const LocalSelfHostedDetail: React.FC = () => {
  const ID = 'be-local-sh';
  // Layout: two CLIENT device frames stacked on the left (laptop with
  // 2 browsers; desktop with 1 desktop app + 1 browser). The SERVER
  // frame on the right holds the daemon glyph + back-end pill. A LAN
  // cloud sits between, with arrows running client → server.
  //
  // Inner windows render with no title — the chrome bar shows just
  // the traffic-light dots and the corner label ("Browser" /
  // "Desktop App"). The device-container label below tells you whose
  // machine you're looking at.
  // 2×2 layout:
  //   row 1 → Laptop (top-left) · Desktop (top-right)
  //   row 2 → Workstation (bottom-left) · Server (bottom-right)
  // Clients fan into the server through a LAN cloud at the grid's
  // center.
  return (
    <svg viewBox="0 0 600 410" width="100%" role="img" aria-label="Local LAN daemon back-end">
      <ArrowDefs id={ID} />

      {/* ── Row 1 ─────────────────────────────────────────────── */}

      <LaptopContainer x={20} y={12} w={200} h={108} label="Laptop">
        <BrowserWindow x={30} y={22} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={52} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={82} w={180} h={24} chromeH={11} corner="Desktop App" />
      </LaptopContainer>

      <DesktopContainer x={380} y={12} w={200} h={76} label="Desktop">
        <BrowserWindow x={392} y={24} w={176} h={24} chromeH={12} corner="Desktop App" />
        <BrowserWindow x={392} y={54} w={176} h={24} chromeH={12} corner="Browser" />
      </DesktopContainer>

      {/* ── Row 2 ─────────────────────────────────────────────── */}

      <DesktopContainer x={20} y={172} w={200} h={72} label="Workstation">
        {/* Same chrome shape as the laptop's browser rows — traffic
            lights on the left, italic "CLI" corner on the right — but
            the body is filled black with a green `$ _` prompt so the
            window reads as a terminal at a glance. Sized to fill the
            workstation's inset like the laptop's stacked browsers. */}
        <BrowserWindow
          x={30}
          y={184}
          w={180}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={38}
            y={216}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={50} y={210} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>
      </DesktopContainer>

      <ServerContainer x={320} y={148} w={260} h={234} label="Local server">
        <FrontEndPill
          x={332}
          y={178}
          w={236}
          items={[
            { label: 'Web App', glyph: <WebAppGlyphBody accent="var(--ant-color-primary)" /> },
            { label: 'Headless', glyph: <HeadlessGlyphBody accent="var(--ant-color-primary)" /> },
          ]}
        />
        <BackEndPill x={332} y={278} w={236} engine="Local server" where="Localhost/LAN" />
      </ServerContainer>

      {/* Connectors — clean geometry, no overlap with container labels:
            • Laptop bottom-right → server top-left  (diagonal across)
            • Desktop bottom-LEFT → server top  (offset from x=480 to
              x=420 so the vertical line doesn't cross the centered
              "Desktop" label that sits below the desktop container)
            • Workstation right → server left  (near-horizontal) */}
      <line x1={220} y1={94} x2={320} y2={200} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      <line x1={420} y1={88} x2={420} y2={148} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      <line x1={220} y1={208} x2={320} y2={230} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />

    </svg>
  );
};

// ── Remote self-hosted ─────────────────────────────────────────────

const RemoteSelfHostedDetail: React.FC = () => {
  const ID = 'be-remote-sh';
  // Same 2×2 device-container layout as Local/LAN — same client
  // shapes (laptop, desktop, workstation) on the left and top-right,
  // with the back-end frame at bottom-right. The two scenarios differ
  // only in: WAN cloud between rows, TLS-padlock connectors instead
  // of plain lines, `wss://` URL, and the back-end is a VM "on the
  // internet" instead of a daemon "on your LAN".
  return (
    <svg viewBox="0 0 600 410" width="100%" role="img" aria-label="Remote self-hosted back-end">
      <ArrowDefs id={ID} />

      {/* ── Row 1 ─────────────────────────────────────────────── */}

      <LaptopContainer x={20} y={12} w={200} h={108} label="Laptop">
        <BrowserWindow x={30} y={22} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={52} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={82} w={180} h={24} chromeH={11} corner="Desktop App" />
      </LaptopContainer>

      <DesktopContainer x={380} y={12} w={200} h={76} label="Desktop">
        <BrowserWindow x={392} y={24} w={176} h={24} chromeH={12} corner="Desktop App" />
        <BrowserWindow x={392} y={54} w={176} h={24} chromeH={12} corner="Browser" />
      </DesktopContainer>

      {/* ── Row 2 ─────────────────────────────────────────────── */}

      <DesktopContainer x={20} y={148} w={200} h={72} label="Workstation">
        <BrowserWindow
          x={30}
          y={160}
          w={180}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={38}
            y={192}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={50} y={186} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>
      </DesktopContainer>

      {/* CI/CD container — automated client driven by a workflow YAML
          (GitHub Actions, GitLab CI, Jenkins, etc.). Visual parallel to
          the CLI terminal above: same dark body, but the content is a
          mocked workflow file (green keys, dim values) instead of a
          shell prompt. The CLI window is for interactive sessions; this
          one is for unattended pipeline runs. Both hit the back-end. */}
      <DesktopContainer x={20} y={232} w={200} h={72} label="CI/CD">
        <BrowserWindow
          x={30}
          y={244}
          w={180}
          h={48}
          chromeH={14}
          corner="Workflow"
          bodyFill="var(--ant-color-text)"
        >
          {(() => {
            const lines: { key: string; value: string }[] = [
              { key: 'name:', value: 'deploy latest' },
              { key: 'on:', value: 'push @ main' },
              { key: 'run:', value: 'oh apply --env dev' },
            ];
            const startY = 268;
            return lines.map((ln, i) => (
              <g key={ln.key}>
                <text
                  x={38}
                  y={startY + i * 9}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize={7.5}
                  fontWeight={700}
                  fill={OH_GREEN}
                >
                  {ln.key}
                </text>
                {ln.value && (
                  <text
                    x={72}
                    y={startY + i * 9}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize={7.5}
                    fill="rgba(255, 255, 255, 0.7)"
                  >
                    {ln.value}
                  </text>
                )}
              </g>
            ));
          })()}
        </BrowserWindow>
      </DesktopContainer>

      <ServerContainer x={320} y={148} w={260} h={234} label="Remote server">
        <FrontEndPill
          x={332}
          y={178}
          w={236}
          items={[
            { label: 'Web App', glyph: <WebAppGlyphBody accent="var(--ant-color-primary)" /> },
            { label: 'Headless', glyph: <HeadlessGlyphBody accent="var(--ant-color-primary)" /> },
          ]}
        />
        <BackEndPill x={332} y={278} w={236} engine="Remote server" where="Internet/WAN" />
      </ServerContainer>

      {/* TLS connectors — all client → VM links cross the public
            internet, so each gets a padlock annotation:
            • Laptop bottom-right → VM top-left  (diagonal across)
            • Desktop bottom-LEFT → VM top  (offset from x=480 to
              x=420 so the vertical line doesn't cross the centered
              "Desktop" label below the desktop container)
            • Workstation right → VM left  (near-horizontal) */}
      <ConnectorTls id={ID} x1={220} y1={94} x2={320} y2={200} />
      <ConnectorTls id={ID} x1={420} y1={88} x2={420} y2={148} />
      <ConnectorTls id={ID} x1={220} y1={184} x2={320} y2={230} />
      <ConnectorTls id={ID} x1={220} y1={268} x2={320} y2={300} />

    </svg>
  );
};
