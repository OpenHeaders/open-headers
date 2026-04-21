import * as v from 'valibot';
import { registerSetting } from '../registry';

declare module '../types' {
  interface SettingsMap {
    'recording.showWidget': boolean;
    'recording.videoEnabled': boolean;
    'recording.hotkey': string;
    'recording.hotkeyEnabled': boolean;
  }
}

registerSetting({
  key: 'recording.showWidget',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Recording Widget',
  description: 'Render an in-page widget with a live timer while a recording is active. Drag to reposition.',
  category: 'recording',
  tags: ['widget', 'overlay', 'in-page', 'timer'],
  scope: 'user',
});

registerSetting({
  key: 'recording.videoEnabled',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Include Video Capture',
  description: 'Capture a video (webm/mp4) alongside the DOM recording. May require extra OS permissions.',
  category: 'recording',
  tags: ['video', 'capture', 'mp4', 'webm'],
  scope: 'user',
  requiresConnection: true,
});

registerSetting({
  key: 'recording.hotkeyEnabled',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Global Recording Hotkey',
  description:
    'Enable a global keyboard shortcut that starts and stops recording. The desktop app owns the shortcut binding.',
  category: 'recording',
  tags: ['hotkey', 'shortcut', 'global', 'keyboard'],
  scope: 'user',
  requiresConnection: true,
});

registerSetting({
  key: 'recording.hotkey',
  type: 'info',
  default: '',
  schema: v.string(),
  label: 'Hotkey Binding',
  description: 'Current recording hotkey as registered on the desktop app. Edit the binding from the desktop app.',
  category: 'recording',
  tags: ['hotkey', 'shortcut', 'binding'],
  scope: 'user',
  requiresConnection: true,
});
