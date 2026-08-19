/**
 * Resource-type reference table — each Chrome `ResourceType` with its
 * badge color, description, and concrete examples.
 */

import type { MessageKey } from '@openheaders/i18n';
import { Tag } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { RESOURCE_TYPE_ICONS } from '../../diagrams';

export const ResourceTypeTable: React.FC = () => {
  const t = useT();
  return (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 4,
      marginBottom: 8,
    }}
  >
    {RESOURCE_TYPES.map(({ tag, code, color, descKey, examples }) => {
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
            <div style={{ color: 'var(--ant-color-text-secondary)' }}>{t(descKey)}</div>
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
};

// Tags and codes are raw parity vocabulary; the description sentences localize.
const RESOURCE_TYPES = [
  {
    tag: 'Page',
    code: 'main_frame',
    color: 'blue',
    descKey: 'workbench.docs.body.resourceTypes.descPage',
    examples: ['https://openheaders.com/', 'https://openheaders.com/docs/getting-started'],
  },
  {
    tag: 'Frame',
    code: 'sub_frame',
    color: 'cyan',
    descKey: 'workbench.docs.body.resourceTypes.descFrame',
    examples: ['<iframe src="https://ads.openheaders.com/banner">', '<iframe src="https://player.vimeo.com/video/123">'],
  },
  {
    tag: 'Fetch/XHR',
    code: 'xmlhttprequest',
    color: 'green',
    descKey: 'workbench.docs.body.resourceTypes.descXhr',
    examples: ['fetch("/api/v1/users")', 'new XMLHttpRequest(); xhr.open("GET", "/api/data")'],
  },
  {
    tag: 'Script',
    code: 'script',
    color: 'orange',
    descKey: 'workbench.docs.body.resourceTypes.descScript',
    examples: ['<script src="/js/app.bundle.js">', 'import("/modules/analytics.js")'],
  },
  {
    tag: 'CSS',
    code: 'stylesheet',
    color: 'purple',
    descKey: 'workbench.docs.body.resourceTypes.descStylesheet',
    examples: ['<link rel="stylesheet" href="/css/main.css">', '@import url("https://fonts.googleapis.com/css2?...")'],
  },
  {
    tag: 'Image',
    code: 'image',
    color: 'magenta',
    descKey: 'workbench.docs.body.resourceTypes.descImage',
    examples: ['<img src="/logo.png">', 'background-image: url("/hero.webp")'],
  },
  {
    tag: 'Font',
    code: 'font',
    color: 'volcano',
    descKey: 'workbench.docs.body.resourceTypes.descFont',
    examples: ['@font-face { src: url("/fonts/Inter.woff2") }', 'fonts.gstatic.com/s/roboto/v30/...woff2'],
  },
  {
    tag: 'Media',
    code: 'media',
    color: 'gold',
    descKey: 'workbench.docs.body.resourceTypes.descMedia',
    examples: ['<video src="/trailer.mp4">', '<audio src="/podcast-ep1.mp3">'],
  },
  {
    tag: 'WebSocket',
    code: 'websocket',
    color: 'lime',
    descKey: 'workbench.docs.body.resourceTypes.descWebsocket',
    examples: ['new WebSocket("wss://ws.openheaders.com/live")', 'new WebSocket("ws://localhost:59510")'],
  },
  {
    tag: 'Ping',
    code: 'ping',
    color: 'geekblue',
    descKey: 'workbench.docs.body.resourceTypes.descPing',
    examples: ['navigator.sendBeacon("/analytics", data)', '<a ping="/track/click" href="...">'],
  },
  {
    tag: 'Other',
    code: 'other',
    color: 'default',
    descKey: 'workbench.docs.body.resourceTypes.descOther',
    examples: ['<link rel="icon" href="/favicon.ico">', '<link rel="manifest" href="/site.webmanifest">'],
  },
] as const satisfies readonly {
  tag: string;
  code: string;
  color: string;
  descKey: MessageKey;
  examples: readonly string[];
}[];
