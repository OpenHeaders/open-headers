/**
 * Resource-type reference table — each Chrome `ResourceType` with its
 * badge color, description, and concrete examples.
 */

import { Tag } from 'antd';
import type React from 'react';
import { RESOURCE_TYPE_ICONS } from '../../diagrams';

export const ResourceTypeTable: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 4,
      marginBottom: 8,
    }}
  >
    {RESOURCE_TYPES.map(({ tag, code, color, desc, examples }) => {
      const Icon = RESOURCE_TYPE_ICONS[code];
      return (
        <div
          key={code}
          style={{
            padding: '8px 10px',
            borderRadius: 4,
            background: 'var(--ant-color-fill-quaternary)',
            fontSize: 12,
            lineHeight: 1.6,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {Icon ? (
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <Icon size={36} />
            </div>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <strong>{tag}</strong>
              <Tag color={color} style={{ fontSize: 10, margin: 0 }}>
                {code}
              </Tag>
            </div>
            <div style={{ color: 'var(--ant-color-text-secondary)' }}>{desc}</div>
            <div
              style={{
                marginTop: 4,
                fontFamily: 'monospace',
                fontSize: 11,
                color: 'var(--ant-color-text-tertiary)',
              }}
            >
              {examples.map((ex, i) => (
                <code
                  key={i}
                  style={{
                    display: 'block',
                    paddingLeft: 8,
                    opacity: 0.85,
                    whiteSpace: 'pre',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ex}
                </code>
              ))}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const RESOURCE_TYPES = [
  {
    tag: 'Page',
    code: 'main_frame',
    color: 'blue',
    desc: 'Top-level document navigation — the URL shown in the address bar.',
    examples: ['https://openheaders.io/', 'https://openheaders.io/docs/getting-started'],
  },
  {
    tag: 'Frame',
    code: 'sub_frame',
    color: 'cyan',
    desc: 'An iframe or nested frame embedded within the page.',
    examples: ['<iframe src="https://ads.openheaders.io/banner">', '<iframe src="https://player.vimeo.com/video/123">'],
  },
  {
    tag: 'Fetch/XHR',
    code: 'xmlhttprequest',
    color: 'green',
    desc: 'API calls via fetch() or XMLHttpRequest. Chrome reports both as the same type — there is no way to distinguish them.',
    examples: ['fetch("/api/v1/users")', 'new XMLHttpRequest(); xhr.open("GET", "/api/data")'],
  },
  {
    tag: 'Script',
    code: 'script',
    color: 'orange',
    desc: 'JavaScript files loaded by the page.',
    examples: ['<script src="/js/app.bundle.js">', 'import("/modules/analytics.js")'],
  },
  {
    tag: 'CSS',
    code: 'stylesheet',
    color: 'purple',
    desc: 'Stylesheets loaded by the page.',
    examples: ['<link rel="stylesheet" href="/css/main.css">', '@import url("https://fonts.googleapis.com/css2?...")'],
  },
  {
    tag: 'Image',
    code: 'image',
    color: 'magenta',
    desc: 'Images loaded by the page or its styles.',
    examples: ['<img src="/logo.png">', 'background-image: url("/hero.webp")'],
  },
  {
    tag: 'Font',
    code: 'font',
    color: 'volcano',
    desc: 'Web fonts loaded via @font-face rules.',
    examples: ['@font-face { src: url("/fonts/Inter.woff2") }', 'fonts.gstatic.com/s/roboto/v30/...woff2'],
  },
  {
    tag: 'Media',
    code: 'media',
    color: 'gold',
    desc: 'Audio or video resources.',
    examples: ['<video src="/trailer.mp4">', '<audio src="/podcast-ep1.mp3">'],
  },
  {
    tag: 'WebSocket',
    code: 'websocket',
    color: 'lime',
    desc: 'WebSocket handshake — the initial HTTP upgrade request. Only the handshake is tracked, not individual messages.',
    examples: ['new WebSocket("wss://ws.openheaders.io/live")', 'new WebSocket("ws://localhost:59510")'],
  },
  {
    tag: 'Ping',
    code: 'ping',
    color: 'geekblue',
    desc: 'Beacon and ping requests typically used for analytics/tracking.',
    examples: ['navigator.sendBeacon("/analytics", data)', '<a ping="/track/click" href="...">'],
  },
  {
    tag: 'Other',
    code: 'other',
    color: 'default',
    desc: "Anything that doesn't fit the above categories.",
    examples: ['<link rel="icon" href="/favicon.ico">', '<link rel="manifest" href="/site.webmanifest">'],
  },
] as const;
