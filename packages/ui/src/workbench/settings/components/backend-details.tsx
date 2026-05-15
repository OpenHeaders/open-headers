/**
 * Compact topology diagrams for the Backend settings panel — one per
 * scenario. Renders below the picker; shows clients, the back-end
 * container, LAN/WAN reach, TLS/Auth annotations, and the URL pattern
 * for the active mode.
 *
 * Uses the docs' shared primitives (`BrowserWindow`, `Box`,
 * `ArrowDefs`, palette tokens) so the visual identity matches the
 * "Where you'll see this" diagrams exactly. Heights are deliberately
 * compact (~180-200px viewBox) so the settings page stays short.
 */

import type React from 'react';
import {
  ArrowDefs,
  Box,
  BrowserWindow,
  FILL_BLUE,
  FILL_GREEN,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from '../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../components/docs/diagrams/open-headers/_shared';
import type { BackendMode } from '../schema/backend';

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

// ── In-browser ─────────────────────────────────────────────────────

const InBrowserDetail: React.FC = () => (
  <svg viewBox="0 0 600 180" width="100%" role="img" aria-label="In-browser back-end">
    <BrowserWindow x={150} y={20} w={300} h={140} chromeH={22} title="Open Headers · this browser" />
    {/* Four UI surfaces */}
    {(['Popup', 'Workbench', 'DevPanel', 'Sidepanel'] as const).map((label, i) => (
      <Box
        key={label}
        x={166 + i * 70}
        y={56}
        w={64}
        h={32}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label={label}
      />
    ))}
    {/* Inline SW = back-end */}
    <rect
      x={166}
      y={102}
      width={268}
      height={42}
      rx={6}
      fill={FILL_GREEN}
      stroke={STROKE_GREEN}
      strokeWidth={1.5}
    />
    <circle cx={184} cy={123} r={5} fill={OH_GREEN} />
    <text x={196} y={119} fontSize={11} fontWeight={700} fill={TEXT}>
      Service worker = back-end
    </text>
    <text x={196} y={134} fontSize={9} fill={TEXT_DIM}>
      oracle · sync engine · vault, in-process
    </text>
    <text x={300} y={172} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
      No external host · single browser · single device
    </text>
  </svg>
);

// ── Desktop app ────────────────────────────────────────────────────

const DesktopAppDetail: React.FC = () => {
  const ID = 'be-desktop-app';
  return (
    <svg viewBox="0 0 600 200" width="100%" role="img" aria-label="Desktop app back-end">
      <ArrowDefs id={ID} />
      {/* "Your machine" outline */}
      <rect
        x={28}
        y={20}
        width={544}
        height={150}
        rx={10}
        fill="transparent"
        stroke={STROKE}
        strokeDasharray="4 3"
        opacity={0.5}
      />
      <text x={44} y={36} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Your machine
      </text>

      <BrowserWindow x={56} y={50} w={150} h={48} chromeH={18} title="Chrome" />
      <BrowserWindow x={56} y={108} w={150} h={48} chromeH={18} title="Firefox" />

      <Box x={384} y={70} w={172} h={70} fill={FILL_GREEN} stroke={STROKE_GREEN} label="Desktop app" sub="oracle · sync · vault" />

      <line x1={206} y1={74} x2={384} y2={94} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      <line x1={206} y1={132} x2={384} y2={116} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />

      <text
        x={295}
        y={92}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={TEXT}
      >
        ws://127.0.0.1:59210
      </text>

      <text x={300} y={190} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        One machine · multiple browsers · localhost · no auth
      </text>
    </svg>
  );
};

// ── Local / LAN daemon ─────────────────────────────────────────────

const LocalSelfHostedDetail: React.FC = () => {
  const ID = 'be-local-sh';
  return (
    <svg viewBox="0 0 600 200" width="100%" role="img" aria-label="Local LAN daemon back-end">
      <ArrowDefs id={ID} />

      {/* LAN cloud in the center */}
      <LanCloud cx={300} cy={108} scale={1.6} label="LAN" />

      <BrowserWindow x={56} y={28} w={120} h={42} chromeH={16} title="Laptop A" />
      <Box x={56} y={130} w={120} h={42} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Desktop app" sub="workstation" />

      <BrowserWindow x={424} y={28} w={120} h={42} chromeH={16} title="Laptop B" />
      <Box x={424} y={130} w={120} h={42} fill={FILL_BLUE} stroke={STROKE_BLUE} label="CLI" sub="CI / scripts" />

      <Box
        x={250}
        y={86}
        w={100}
        h={50}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        label="Daemon"
        sub="oracle · sync"
      />

      <line x1={176} y1={49} x2={250} y2={102} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />
      <line x1={176} y1={151} x2={250} y2={118} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />
      <line x1={424} y1={49} x2={350} y2={102} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />
      <line x1={424} y1={151} x2={350} y2={118} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />

      <text
        x={300}
        y={80}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={TEXT}
      >
        ws://192.168.x.x:59210
      </text>

      <text x={300} y={192} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Same workspaces across every device on your network
      </text>
    </svg>
  );
};

// ── Remote self-hosted ─────────────────────────────────────────────

const RemoteSelfHostedDetail: React.FC = () => {
  const ID = 'be-remote-sh';
  return (
    <svg viewBox="0 0 600 200" width="100%" role="img" aria-label="Remote self-hosted back-end">
      <ArrowDefs id={ID} />

      <LanCloud cx={300} cy={108} scale={1.75} label="WAN · Internet" />

      <BrowserWindow x={32} y={28} w={120} h={42} chromeH={16} title="Office" />
      <Box x={32} y={130} w={120} h={42} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Desktop app" sub="Home" />

      <Box x={448} y={28} w={120} h={42} fill={FILL_BLUE} stroke={STROKE_BLUE} label="CLI" sub="CI / runner" />
      <BrowserWindow x={448} y={130} w={120} h={42} chromeH={16} title="On the road" />

      <Box
        x={250}
        y={80}
        w={100}
        h={58}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
        label="Your VM"
        sub="oracle · sync · vault"
      />

      <ConnectorTls id={ID} x1={152} y1={49} x2={250} y2={102} />
      <ConnectorTls id={ID} x1={152} y1={151} x2={250} y2={120} />
      <ConnectorTls id={ID} x1={448} y1={49} x2={350} y2={102} />
      <ConnectorTls id={ID} x1={448} y1={151} x2={350} y2={120} />

      <text
        x={300}
        y={74}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={TEXT}
      >
        wss://oh.your-domain.com
      </text>

      <text x={300} y={192} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        TLS · auth · multi-device anywhere — still your data, still your host
      </text>
    </svg>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────

const LanCloud: React.FC<{ cx: number; cy: number; scale?: number; label?: string }> = ({
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

/** Connector line with a small padlock dot at the midpoint. */
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
      <path d={`M ${mx - 1.6} ${my - 0.5} v -1.6 a 1.6 1.6 0 0 1 3.2 0 v 1.6`} stroke={OH_GREEN} strokeWidth={0.8} fill="none" />
    </g>
  );
};
