/**
 * Data category — diagnostics and destructive maintenance actions.
 *
 * The action handlers operate on the live settings store via its
 * public API. Anything that would wipe user-visible data prompts
 * through window.confirm first; ActionField styles destructive
 * buttons via `action.danger`.
 */

import { call } from '@utils/bridge';
import * as v from 'valibot';
import { allDefs, registerSetting } from '../registry';
import { get as getStoreValue, reset as resetSetting, set as setStoreValue } from '../store';
import type { SettingKey, SettingsMap } from '../types';

const logLevelSchema = v.picklist(['error', 'warn', 'info', 'debug']);
export type LogLevel = v.InferOutput<typeof logLevelSchema>;

declare module '../types' {
  interface SettingsMap {
    'data.logLevel': LogLevel;
    'data.exportSettings': string;
    'data.importSettings': string;
    'data.resetAllSettings': string;
    'data.exportObservabilityLog': string;
    'data.clearObservabilityLog': string;
  }
}

// ── Real preference ──────────────────────────────────────────────────

registerSetting({
  key: 'data.logLevel',
  type: 'enum',
  default: 'info',
  schema: logLevelSchema,
  label: 'Log Level',
  description: 'Verbosity of the extension logger. Higher levels include every level above them.',
  category: 'data',
  tags: ['log', 'debug', 'verbose', 'diagnostics'],
  scope: 'user',
  enumOptions: [
    { value: 'error', label: 'Error', description: 'Failures only' },
    { value: 'warn', label: 'Warn', description: 'Anomalies and retries' },
    { value: 'info', label: 'Info', description: 'Operational events' },
    { value: 'debug', label: 'Debug', description: 'Verbose internals' },
  ],
});

// ── Action helpers ───────────────────────────────────────────────────

const actionSchema = v.string();

function isPersistedSetting(type: string): boolean {
  return type !== 'action' && type !== 'info';
}

function snapshotSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of allDefs()) {
    if (!isPersistedSetting(def.type)) continue;
    out[def.key] = getStoreValue(def.key as SettingKey);
  }
  return out;
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)));
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// ── Action fields ────────────────────────────────────────────────────

registerSetting({
  key: 'data.exportSettings',
  type: 'action',
  default: '',
  schema: actionSchema,
  label: 'Export Settings',
  description: 'Download all settings as a JSON file.',
  category: 'data',
  tags: ['export', 'backup', 'download', 'json'],
  scope: 'user',
  action: {
    label: 'Export',
    run: () => {
      downloadJson(`openheaders-settings-${new Date().toISOString().slice(0, 10)}.json`, snapshotSettings());
    },
  },
});

registerSetting({
  key: 'data.importSettings',
  type: 'action',
  default: '',
  schema: actionSchema,
  label: 'Import Settings',
  description: 'Load settings from a previously exported JSON file.',
  category: 'data',
  tags: ['import', 'restore', 'upload', 'json'],
  scope: 'user',
  action: {
    label: 'Import…',
    run: async () => {
      const parsed = await pickJsonFile();
      if (!parsed || typeof parsed !== 'object') return;
      const dict = parsed as Record<string, unknown>;
      for (const def of allDefs()) {
        if (!isPersistedSetting(def.type)) continue;
        if (!(def.key in dict)) continue;
        const result = v.safeParse(def.schema, dict[def.key]);
        if (result.success) {
          setStoreValue(def.key as SettingKey, result.output as SettingsMap[SettingKey]);
        }
      }
    },
  },
});

registerSetting({
  key: 'data.exportObservabilityLog',
  type: 'action',
  default: '',
  schema: actionSchema,
  label: 'Export Diagnostic Log',
  description:
    'Download the last 500 structured events (rule rebuilds, request errors, workspace switches) as JSON. Local-only; nothing leaves the device unless you attach the file to a bug report yourself.',
  category: 'data',
  tags: ['export', 'log', 'diagnostic', 'observability', 'bug-report', 'triage'],
  scope: 'user',
  action: {
    label: 'Export log',
    run: async () => {
      const resp = await call('getObservabilityLog').catch(() => null);
      const entries = resp?.entries ?? [];
      downloadJson(`openheaders-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`, {
        exportedAt: new Date().toISOString(),
        entries,
      });
    },
  },
});

registerSetting({
  key: 'data.clearObservabilityLog',
  type: 'action',
  default: '',
  schema: actionSchema,
  label: 'Clear Diagnostic Log',
  description: 'Drop every buffered event. Does not affect rules, requests, or any workspace data.',
  category: 'data',
  tags: ['clear', 'log', 'diagnostic', 'observability', 'reset'],
  scope: 'user',
  action: {
    label: 'Clear',
    danger: true,
    run: async () => {
      if (!window.confirm('Clear the diagnostic log? This drops every buffered event.')) return;
      await call('clearObservabilityLog').catch(() => null);
    },
  },
});

registerSetting({
  key: 'data.resetAllSettings',
  type: 'action',
  default: '',
  schema: actionSchema,
  label: 'Reset All Settings',
  description: 'Return every setting in every category to its default value.',
  category: 'data',
  tags: ['reset', 'defaults', 'restore'],
  scope: 'user',
  action: {
    label: 'Reset to defaults',
    danger: true,
    run: () => {
      if (!window.confirm('Reset every setting to its default? This cannot be undone.')) return;
      for (const def of allDefs()) {
        if (!isPersistedSetting(def.type)) continue;
        resetSetting(def.key as SettingKey);
      }
    },
  },
});
