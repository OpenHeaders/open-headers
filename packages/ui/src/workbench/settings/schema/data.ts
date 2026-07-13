/**
 * Data category — diagnostics and destructive maintenance actions.
 *
 * The action handlers operate on the live settings store via its
 * public API. Anything that would wipe user-visible data prompts
 * through window.confirm first; ActionField styles destructive
 * buttons via `action.danger`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import * as v from 'valibot';
import { allDefs, registerSetting } from '../registry';
import { get as getStoreValue, reset as resetSetting, set as setStoreValue } from '../store';
import type { SettingKey, SettingsMap } from '../types';

const logLevelSchema = v.picklist(['error', 'warn', 'info', 'debug']);
export type LogLevel = v.InferOutput<typeof logLevelSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'data.logLevel': LogLevel;
    'data.exportSettings': string;
    'data.importSettings': string;
    'data.resetAllSettings': string;
    'data.exportObservabilityLog': string;
    'data.clearObservabilityLog': string;
    'data.exportImportReports': string;
    'data.clearImportReports': string;
    'data.uploadFile': string;
    'data.exportFilesManifest': string;
    'data.clearAllFiles': string;
    'data.filesBrowser': string;
  }
}

// ── Real preference ──────────────────────────────────────────────────

registerSetting({
  key: 'data.logLevel',
  type: 'enum',
  default: 'info',
  schema: logLevelSchema,
  labelKey: 'workbench.settings.def.data.logLevel.label',
  descriptionKey: 'workbench.settings.def.data.logLevel.description',
  category: 'data',
  tags: ['log', 'debug', 'verbose', 'diagnostics'],
  scope: 'user',
  enumOptions: [
    {
      value: 'error',
      labelKey: 'workbench.settings.def.data.logLevel.option.error.label',
      descriptionKey: 'workbench.settings.def.data.logLevel.option.error.description',
    },
    {
      value: 'warn',
      labelKey: 'workbench.settings.def.data.logLevel.option.warn.label',
      descriptionKey: 'workbench.settings.def.data.logLevel.option.warn.description',
    },
    {
      value: 'info',
      labelKey: 'workbench.settings.def.data.logLevel.option.info.label',
      descriptionKey: 'workbench.settings.def.data.logLevel.option.info.description',
    },
    {
      value: 'debug',
      labelKey: 'workbench.settings.def.data.logLevel.option.debug.label',
      descriptionKey: 'workbench.settings.def.data.logLevel.option.debug.description',
    },
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
  labelKey: 'workbench.settings.def.data.exportSettings.label',
  descriptionKey: 'workbench.settings.def.data.exportSettings.description',
  category: 'data',
  tags: ['export', 'backup', 'download', 'json'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.exportSettings.action.label',
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
  labelKey: 'workbench.settings.def.data.importSettings.label',
  descriptionKey: 'workbench.settings.def.data.importSettings.description',
  category: 'data',
  tags: ['import', 'restore', 'upload', 'json'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.importSettings.action.label',
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
  labelKey: 'workbench.settings.def.data.exportObservabilityLog.label',
  descriptionKey: 'workbench.settings.def.data.exportObservabilityLog.description',
  category: 'data',
  tags: ['export', 'log', 'diagnostic', 'observability', 'bug-report', 'triage'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.exportObservabilityLog.action.label',
    run: async () => {
      const resp = await hostBridge.call('getObservabilityLog').catch(() => null);
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
  labelKey: 'workbench.settings.def.data.clearObservabilityLog.label',
  descriptionKey: 'workbench.settings.def.data.clearObservabilityLog.description',
  category: 'data',
  tags: ['clear', 'log', 'diagnostic', 'observability', 'reset'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.clearObservabilityLog.action.label',
    danger: true,
    run: async (t) => {
      if (!window.confirm(t('workbench.settings.def.data.clearObservabilityLog.confirm'))) return;
      await hostBridge.call('clearObservabilityLog').catch(() => null);
    },
  },
});

registerSetting({
  key: 'data.exportImportReports',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.exportImportReports.label',
  descriptionKey: 'workbench.settings.def.data.exportImportReports.description',
  category: 'data',
  tags: ['export', 'import', 'curl', 'har', 'report', 'audit'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.exportImportReports.action.label',
    run: async () => {
      const resp = await hostBridge.call('listImportReports').catch(() => null);
      const reports = resp?.reports ?? [];
      downloadJson(`openheaders-import-reports-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`, {
        exportedAt: new Date().toISOString(),
        reports,
      });
    },
  },
});

registerSetting({
  key: 'data.clearImportReports',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.clearImportReports.label',
  descriptionKey: 'workbench.settings.def.data.clearImportReports.description',
  category: 'data',
  tags: ['clear', 'import', 'curl', 'har', 'report', 'reset'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.clearImportReports.action.label',
    danger: true,
    run: async (t) => {
      if (!window.confirm(t('workbench.settings.def.data.clearImportReports.confirm'))) return;
      await hostBridge.call('clearImportReports').catch(() => null);
    },
  },
});

registerSetting({
  key: 'data.uploadFile',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.uploadFile.label',
  descriptionKey: 'workbench.settings.def.data.uploadFile.description',
  category: 'data',
  tags: ['file', 'blob', 'upload', 'multipart', 'attachment'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.uploadFile.action.label',
    run: async () => {
      const input = document.createElement('input');
      input.type = 'file';
      await new Promise<void>((resolve) => {
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve();
            return;
          }
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const CHUNK = 0x8000;
          let binary = '';
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
          }
          const bytesBase64 = btoa(binary);
          await hostBridge
            .call('putFile', {
              filename: file.name,
              mimeType: file.type || undefined,
              bytesBase64,
            })
            .catch(() => null);
          resolve();
        };
        input.click();
      });
    },
  },
});

registerSetting({
  key: 'data.exportFilesManifest',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.exportFilesManifest.label',
  descriptionKey: 'workbench.settings.def.data.exportFilesManifest.description',
  category: 'data',
  tags: ['file', 'blob', 'export', 'manifest', 'audit'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.exportFilesManifest.action.label',
    run: async () => {
      const resp = await hostBridge.call('listFiles', {}).catch(() => null);
      const files = resp?.files ?? [];
      downloadJson(`openheaders-files-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`, {
        exportedAt: new Date().toISOString(),
        files,
      });
    },
  },
});

registerSetting({
  key: 'data.filesBrowser',
  type: 'files-browser',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.filesBrowser.label',
  descriptionKey: 'workbench.settings.def.data.filesBrowser.description',
  category: 'data',
  tags: ['file', 'blob', 'browser', 'download', 'preview', 'attachment'],
  scope: 'user',
});

registerSetting({
  key: 'data.clearAllFiles',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.clearAllFiles.label',
  descriptionKey: 'workbench.settings.def.data.clearAllFiles.description',
  category: 'data',
  tags: ['file', 'blob', 'clear', 'delete', 'reset'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.clearAllFiles.action.label',
    danger: true,
    run: async (t) => {
      if (!window.confirm(t('workbench.settings.def.data.clearAllFiles.confirm'))) return;
      const resp = await hostBridge.call('listFiles', {}).catch(() => null);
      const files = resp?.files ?? [];
      for (const f of files) {
        await hostBridge.call('deleteFile', { fileId: f.fileId }).catch(() => null);
      }
    },
  },
});

registerSetting({
  key: 'data.resetAllSettings',
  type: 'action',
  default: '',
  schema: actionSchema,
  labelKey: 'workbench.settings.def.data.resetAllSettings.label',
  descriptionKey: 'workbench.settings.def.data.resetAllSettings.description',
  category: 'data',
  tags: ['reset', 'defaults', 'restore'],
  scope: 'user',
  action: {
    labelKey: 'workbench.settings.def.data.resetAllSettings.action.label',
    danger: true,
    run: (t) => {
      if (!window.confirm(t('workbench.settings.def.data.resetAllSettings.confirm'))) return;
      for (const def of allDefs()) {
        if (!isPersistedSetting(def.type)) continue;
        resetSetting(def.key as SettingKey);
      }
    },
  },
});
