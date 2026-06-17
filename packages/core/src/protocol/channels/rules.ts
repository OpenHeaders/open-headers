/**
 * Rule-domain bridge RPCs — rule CRUD (local + desktop-routed), local
 * collection / folder management, per-tab telemetry, and active-rule
 * resolution.
 */

import type {
  ActiveRule,
  Collection,
  CollectionTree,
  NetworkThrottleConditions,
  PerfResourceEntry,
  Rule,
  RuleDraft,
  TabSystemOverrides,
  TabTelemetrySnapshot,
} from '../../types';
import type { FolderDescriptor } from './common';

export interface RuleRpc {
  // ── Rule CRUD (local + desktop-routed) ─────────────────────────
  deleteRule: {
    req: { ruleId: string };
    res: { success: boolean; error?: string };
  };
  createRuleDraft: {
    req: { draft: RuleDraft };
    res: { success: boolean; nonce?: string; error?: string };
  };
  takeRuleDraft: {
    req: { nonce: string };
    res: { success: boolean; draft: RuleDraft | null };
  };
  setCacheBypass: {
    req: { tabId: number; enabled: boolean };
    res: { success: boolean; error?: string };
  };
  setNetworkConditions: {
    req: { tabId: number; conditions: NetworkThrottleConditions | null };
    res: { success: boolean; error?: string };
  };
  getNetworkConditions: {
    req: { tabId: number };
    res: { conditions: NetworkThrottleConditions | null };
  };
  setTabOverrides: {
    req: { tabId: number; overrides: TabSystemOverrides | null };
    res: { success: boolean; error?: string };
  };
  getTabOverrides: {
    req: { tabId: number };
    res: { overrides: TabSystemOverrides | null };
  };
  setCdpTabPin: {
    req: { tabId: number; pinned: boolean };
    res: { success: boolean; error?: string };
  };
  getLocalRules: {
    req: Record<string, never>;
    res: { rules: Rule[] };
  };
  getLocalCollections: {
    req: Record<string, never>;
    res: { collections: Collection[] };
  };
  getLocalCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: CollectionTree[] };
  };
  getLocalFolders: {
    req: Record<string, never>;
    res: { folders: unknown[] };
  };
  createLocalFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameLocalFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };
  createLocalCollection: {
    req: { name: string };
    res: { success: boolean; collection?: Collection };
  };
  renameLocalCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };

  // ── Per-tab telemetry + active rules ───────────────────────────
  getActiveRulesForTab: {
    req: { tabId: number | undefined; tabUrl: string | undefined };
    res: { activeRules: ActiveRule[] };
  };
  getTabTelemetry: {
    req: { tabId: number };
    res: TabTelemetrySnapshot;
  };
  tabFire: {
    req: { ruleUid: string; url: string; t: number };
    res: { success: boolean };
  };
  perfResourceEntries: {
    req: { entries: PerfResourceEntry[] };
    res: { success: boolean };
  };
}
