/**
 * useSidebarCreateActions — the "create new top-level entity" handlers
 * behind the sidebar's `+` affordances (toolbar dropdowns, per-section
 * header buttons, empty-state Create links).
 *
 * Each handler shares one shape: derive a unique default name against
 * the live pool, fire the create RPC, then reveal the result (expand
 * the owning section and open its overview / select it). The template
 * variant is exposed once here so the TEMPLATES section header and its
 * empty-state stop re-inlining the same body.
 */

import type { Collection, Environment } from '@openheaders/core/types';
import {
  NEW_ENVIRONMENT_NAME,
  NEW_REQUESTS_COLLECTION_NAME,
  NEW_RULES_COLLECTION_NAME,
  NEW_TEMPLATE_COLLECTION_NAME,
  uniqueName,
} from '@openheaders/ui/shared/naming';
import type { App } from 'antd';
import type React from 'react';
import { useCallback } from 'react';

/** Antd `message` API handed down from the sidebar's `App.useApp()` context. */
type SidebarMessageApi = ReturnType<typeof App.useApp>['message'];

export interface UseSidebarCreateActionsParams {
  localCollections: Collection[];
  requestCollections: Collection[];
  templateCollections: Collection[];
  environments: Environment[];
  createLocalCollection: (name: string) => Promise<Collection | null>;
  createRequestCollectionRpc: (name: string) => Promise<Collection | null>;
  createTemplateCollection: (name: string) => Promise<Collection | null>;
  createEnvironment: (name: string) => Promise<Environment | null>;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenTemplateCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onSelectEnvironment?: (uid: string, name: string, autoRename?: boolean) => void;
  message: SidebarMessageApi;
}

export interface SidebarCreateActions {
  createNewCollection: () => Promise<void>;
  createNewRequestCollection: () => Promise<void>;
  createNewTemplateCollection: () => Promise<void>;
  createNewEnvironment: () => Promise<void>;
}

export function useSidebarCreateActions({
  localCollections,
  requestCollections,
  templateCollections,
  environments,
  createLocalCollection,
  createRequestCollectionRpc,
  createTemplateCollection,
  createEnvironment,
  setSectionsExpanded,
  setExpandedKeys,
  onOpenCollectionOverview,
  onOpenTemplateCollectionOverview,
  onSelectEnvironment,
  message,
}: UseSidebarCreateActionsParams): SidebarCreateActions {
  const createNewCollection = useCallback(async () => {
    const name = uniqueName(NEW_RULES_COLLECTION_NAME, new Set(localCollections.map((c) => c.name)));
    const col = await createLocalCollection(name);
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      onOpenCollectionOverview?.(col.uid, col.name, true);
    }
  }, [createLocalCollection, localCollections, onOpenCollectionOverview]);

  const createNewRequestCollection = useCallback(async () => {
    const name = uniqueName(NEW_REQUESTS_COLLECTION_NAME, new Set(requestCollections.map((c) => c.name)));
    const col = await createRequestCollectionRpc(name);
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, 'api-requests': true }));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.add(`req-col-${col.uid}`);
        return next;
      });
    } else {
      message.error('Failed to create request collection');
    }
  }, [createRequestCollectionRpc, requestCollections, message]);

  const createNewTemplateCollection = useCallback(async () => {
    const name = uniqueName(NEW_TEMPLATE_COLLECTION_NAME, new Set(templateCollections.map((c) => c.name)));
    const col = await createTemplateCollection(name);
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, templates: true }));
      onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
    }
  }, [createTemplateCollection, templateCollections, onOpenTemplateCollectionOverview]);

  const createNewEnvironment = useCallback(async () => {
    const name = uniqueName(NEW_ENVIRONMENT_NAME, new Set(environments.map((e) => e.name)));
    const env = await createEnvironment(name);
    if (env) {
      setSectionsExpanded((prev) => ({ ...prev, environments: true }));
      onSelectEnvironment?.(env.uid, env.name, true);
    } else {
      message.error('Failed to create environment');
    }
  }, [createEnvironment, environments, onSelectEnvironment, message]);

  return { createNewCollection, createNewRequestCollection, createNewTemplateCollection, createNewEnvironment };
}
