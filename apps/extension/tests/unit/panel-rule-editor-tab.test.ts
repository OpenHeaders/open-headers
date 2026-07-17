/**
 * Rule-editor tab arm — builders + the reducer's committed-binding
 * re-key. Edit mode keys on the rule uid so re-opens activate the
 * existing tab; create mode keys on a per-escalation draft nonce. A
 * `ruleUid` patch is the committed binding: the tab re-keys to the
 * uid, sheds its seed payloads (create draft / popover hand-off), and
 * the leaf's active pointer follows — an edit-mode save re-lands the
 * same id and still sheds a consumed hand-off.
 */

import type { ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import type { EditorLeaf, EditorNode } from '@openheaders/ui/panel/data/editor-groups';
import { insertTabIntoLeaf, makeLeaf, updateTabInLeaf } from '@openheaders/ui/panel/data/editor-groups';
import type { InspectorTab, RuleEditorInspectorTab } from '@openheaders/ui/panel/data/inspector-tab';
import {
  buildRuleEditorDraftTab,
  buildRuleEditorTab,
  ruleEditorDraftTabId,
  ruleEditorTabId,
  tabIsDirty,
  tabPillLabel,
  tabSearchText,
  tabTitle,
} from '@openheaders/ui/panel/data/inspector-tab';
import { describe, expect, it } from 'vitest';

const DRAFT: ResponseRuleDraft = {
  type: 'response',
  url: 'https://api.openheaders.io/v1/users',
  requestMethods: ['GET'],
  responseSource: 'network',
  bodyType: 'static',
  statusCode: 200,
  responseBody: '{"users":[]}',
  contentType: 'application/json',
  resourceType: 'rest',
};

const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'url-filter', values: ['https://api.openheaders.io/*'] }];

const HAND_OFF = { statusCode: 404, contentType: 'text/plain', responseBody: 'not found' };

const EDIT_TAB = buildRuleEditorTab({
  ruleUid: 'rule-1',
  ruleName: 'Mock users',
  timestamp: 1_770_000_000_000,
});

const DRAFT_TAB = buildRuleEditorDraftTab({
  nonce: 'nonce-1',
  name: 'users override',
  draft: DRAFT,
  conditions: CONDITIONS,
  timestamp: 1_770_000_000_000,
});

function leafWith(...tabs: InspectorTab[]): EditorNode {
  return tabs.reduce<EditorNode>((acc, tab) => insertTabIntoLeaf(acc, 'leaf-root', tab), makeLeaf('leaf-root'));
}

describe('rule-editor tab builders', () => {
  it('edit mode keys on the rule uid, so re-opens dedupe onto the same tab', () => {
    expect(EDIT_TAB.id).toBe(ruleEditorTabId('rule-1'));
    expect(EDIT_TAB).toMatchObject({ kind: 'rule-editor', label: 'Mock users', ruleUid: 'rule-1' });
    expect(EDIT_TAB.draft).toBeUndefined();
    expect(EDIT_TAB.handOff).toBeUndefined();
    const again = buildRuleEditorTab({ ruleUid: 'rule-1', ruleName: 'Renamed since', timestamp: 1 });
    expect(again.id).toBe(EDIT_TAB.id);
  });

  it('carries a popover hand-off when escalating mid-edit', () => {
    const tab = buildRuleEditorTab({ ruleUid: 'rule-1', ruleName: 'Mock users', handOff: HAND_OFF, timestamp: 1 });
    expect(tab.handOff).toEqual(HAND_OFF);
  });

  it('create mode keys on the draft nonce and carries the seed payloads', () => {
    expect(DRAFT_TAB.id).toBe(ruleEditorDraftTabId('nonce-1'));
    expect(DRAFT_TAB).toMatchObject({
      kind: 'rule-editor',
      label: 'users override',
      ruleUid: null,
      draftName: 'users override',
    });
    expect(DRAFT_TAB.draft).toBe(DRAFT);
    expect(DRAFT_TAB.draftConditions).toBe(CONDITIONS);
  });

  it('feeds the per-kind helpers: title, pill label, search haystack, dirty', () => {
    expect(tabTitle(EDIT_TAB)).toBe('Mock users › response override rule');
    expect(tabPillLabel(EDIT_TAB)).toBe('Mock users');
    expect(tabSearchText(EDIT_TAB)).toBe('Mock users response override rule');
    expect(tabIsDirty(EDIT_TAB)).toBe(false);
    expect(tabIsDirty({ ...EDIT_TAB, dirty: true })).toBe(true);
  });
});

describe('updateTabInLeaf — committed rule binding (ruleUid patch)', () => {
  it('re-keys a draft tab to the minted uid: id, ruleUid, label and active pointer follow; payloads shed', () => {
    const root = leafWith(EDIT_TAB, DRAFT_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', DRAFT_TAB.id, {
      ruleUid: 'rule-2',
      label: 'users override (final)',
      dirty: false,
    }) as EditorLeaf;

    const rekeyed = next.tabs.find((t) => t.kind === 'rule-editor' && t.ruleUid === 'rule-2') as
      | RuleEditorInspectorTab
      | undefined;
    expect(rekeyed).toMatchObject({
      id: ruleEditorTabId('rule-2'),
      label: 'users override (final)',
      ruleUid: 'rule-2',
      dirty: false,
    });
    expect(rekeyed?.draft).toBeUndefined();
    expect(rekeyed?.draftName).toBeUndefined();
    expect(rekeyed?.draftConditions).toBeUndefined();
    // The draft tab was active — the leaf's pointer moves with it.
    expect(next.activeTabId).toBe(ruleEditorTabId('rule-2'));
  });

  it('an edit-mode save re-lands the same id and sheds a consumed hand-off', () => {
    const withHandOff = buildRuleEditorTab({
      ruleUid: 'rule-1',
      ruleName: 'Mock users',
      handOff: HAND_OFF,
      timestamp: 1,
    });
    const root = leafWith(withHandOff);
    const next = updateTabInLeaf(root, 'leaf-root', withHandOff.id, { ruleUid: 'rule-1', dirty: false }) as EditorLeaf;
    const tab = next.tabs[0] as RuleEditorInspectorTab;
    expect(tab.id).toBe(withHandOff.id);
    expect(tab.handOff).toBeUndefined();
  });

  it('a binding patch changing nothing is a no-op', () => {
    const root = leafWith(EDIT_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', EDIT_TAB.id, { ruleUid: 'rule-1' });
    expect(next).toBe(root);
  });

  it('patches dirty through the generic document branch', () => {
    const root = leafWith(EDIT_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', EDIT_TAB.id, { dirty: true }) as EditorLeaf;
    expect(next.tabs[0] && tabIsDirty(next.tabs[0])).toBe(true);
  });
});
