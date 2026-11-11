/**
 * Where a file of a conflicted pass is listed in the merge editor's
 * rail: the surface it belongs to and its place there — an entity's
 * manifest by its kind, another file of an entity's directory by the
 * tree it sits in (the tree's root left out of the group), the
 * Variables under their named groups, and Files by directory for
 * anything else.
 */

import { COMMIT_FILE_SECTIONS, commitFilePlace } from '@openheaders/ui/shared/conflicts/commit-file-section';
import { describe, expect, it } from 'vitest';

describe('commitFilePlace', () => {
  it('places an entity manifest by its kind, whatever the protocol, under its directory in the tree', () => {
    expect(commitFilePlace('rules/headers-col1/add-auth-rule1/rule.yaml')).toEqual({
      section: 'http-rules',
      group: 'headers-col1/add-auth-rule1',
    });
    expect(commitFilePlace('requests/orders-col1/create-order-req3/request.yaml')).toEqual({
      section: 'api-requests',
      group: 'orders-col1/create-order-req3',
    });
    for (const manifest of ['grpc.yaml', 'websocket.yaml', 'mqtt.yaml', 'graphql.yaml']) {
      expect(commitFilePlace(`requests/orders-col1/stream-req4/${manifest}`).section).toBe('api-requests');
    }
    expect(commitFilePlace('workflows/token-refresh-wf1/workflow.yaml')).toEqual({
      section: 'workflows',
      group: 'workflows/token-refresh-wf1',
    });
  });

  it('places another file of an entity, a collection and a folder by the tree they sit in', () => {
    expect(commitFilePlace('requests/orders-col1/create-order-req3/body.json')).toEqual({
      section: 'api-requests',
      group: 'orders-col1/create-order-req3',
    });
    expect(commitFilePlace('requests/orders-col1/_collection.yaml')).toEqual({
      section: 'api-requests',
      group: 'orders-col1',
    });
    expect(commitFilePlace('rules/headers-col1/staging-fold1/_folder.yaml').section).toBe('http-rules');
    expect(commitFilePlace('rules/headers-col1/add-auth-rule1/script.js').section).toBe('http-rules');
  });

  it('places the Variables under their named groups', () => {
    expect(commitFilePlace('environments/staging-env1.yaml')).toEqual({ section: 'variables', group: 'environments' });
    expect(commitFilePlace('environments/staging-env1.secret.yaml.template')).toEqual({
      section: 'variables',
      group: 'environments',
    });
    expect(commitFilePlace('workspace-vars.yaml')).toEqual({ section: 'variables', group: 'workspace-variables' });
    expect(commitFilePlace('live/token-lv1/variable.yaml')).toEqual({ section: 'variables', group: 'live-variables' });
  });

  it('places the user’s own files, a template, a spec and the workspace manifest under Files by directory', () => {
    expect(commitFilePlace('notes/orders.md')).toEqual({ section: 'files', group: 'notes' });
    expect(commitFilePlace('README.md')).toEqual({ section: 'files', group: '' });
    expect(commitFilePlace('workspace.yaml')).toEqual({ section: 'files', group: '' });
    expect(commitFilePlace('templates/base-col1/json-tpl1/template.yaml').section).toBe('files');
    expect(commitFilePlace('templates/base-col1/json-tpl1/body.json').section).toBe('files');
    expect(commitFilePlace('specs/orders-spec1/spec.yaml')).toEqual({ section: 'files', group: 'specs/orders-spec1' });
  });

  it('orders the sections as the activity bar does, the user’s files last', () => {
    expect(COMMIT_FILE_SECTIONS).toEqual(['http-rules', 'api-requests', 'workflows', 'variables', 'files']);
  });
});
