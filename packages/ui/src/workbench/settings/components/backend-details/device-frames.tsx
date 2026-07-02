/**
 * Device-frame containers for the backend topology scenes — desktop
 * monitor, laptop and server/rack. Each draws the hardware shell and
 * renders child SVG content inside its screen inset.
 */

import type React from 'react';
import { TEXT_DIM } from '../../../components/docs/diagrams/_shared';

// Neutral grey for the device-frame outer container so the BLUE
// children (BrowserWindow, BackendGlyph) stay visually dominant.
// The frame reads as "this is hardware / a host" while the contents
// read as "these are the apps".
const DEVICE_FRAME_STROKE = 'var(--ant-color-border)';
const DEVICE_FRAME_FILL_INSET = 'var(--ant-color-fill-quaternary)';
const DEVICE_FRAME_FILL_BODY = 'var(--ant-color-bg-container)';

/**
 * Big desktop-monitor frame used as the outer "this is one machine"
 * container — monitor body + inset screen area + a small stand below.
 * Child SVG content renders inside the screen area; consumers should
 * lay content out within `{x + INSET, y + INSET}` to `{x + w - INSET, y + h - INSET}`.
 */
const DESKTOP_SCREEN_INSET = 10;
export const DesktopContainer: React.FC<{
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
 * Compact laptop frame — screen body on top + short trapezoidal
 * keyboard underneath. Same grey palette as the desktop monitor so the
 * two read as members of the same "device hardware" family. Content
 * children render inside the screen inset.
 */
const LAPTOP_SCREEN_INSET = 8;
export const LaptopContainer: React.FC<{
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

/**
 * Server / rack frame — body with rack-style horizontal ribs at the
 * top. Used for the daemon (Local/LAN) and the VM (Remote/WAN).
 * Same grey frame palette as the device containers; the rack ribs
 * distinguish it visually as "this is a headless host, not a desk
 * device".
 */
const SERVER_SCREEN_INSET = 8;
export const ServerContainer: React.FC<{
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
