/**
 * Which surface a file of a conflicted pass belongs to — the glyph it
 * wears in the merge editor's file rail: an entity's manifest by its
 * kind, another file of an entity's directory by the tree it sits in,
 * an environment's files the Variables', and null (the file's own type)
 * for anything else.
 */

import { conflictFileSurface } from '@openheaders/ui/workbench/components/panels/git/conflict-file-surface';
import { describe, expect, it } from 'vitest';

describe('conflictFileSurface', () => {
  it('reads an entity manifest by its kind, whatever the protocol', () => {
    expect(conflictFileSurface('rules/headers-col1/add-auth-rule1/rule.yaml')).toBe('http-rules');
    expect(conflictFileSurface('requests/orders-col1/create-order-req3/request.yaml')).toBe('api-requests');
    expect(conflictFileSurface('requests/orders-col1/stream-req4/grpc.yaml')).toBe('api-requests');
    expect(conflictFileSurface('requests/orders-col1/feed-req5/websocket.yaml')).toBe('api-requests');
    expect(conflictFileSurface('requests/orders-col1/query-req6/graphql.yaml')).toBe('api-requests');
    expect(conflictFileSurface('workflows/token-refresh-wf1/workflow.yaml')).toBe('workflows');
    expect(conflictFileSurface('live/token-lv1/variable.yaml')).toBe('variables');
  });

  it('reads another file of an entity, a collection and a folder by the tree they sit in', () => {
    expect(conflictFileSurface('requests/orders-col1/create-order-req3/body.json')).toBe('api-requests');
    expect(conflictFileSurface('requests/orders-col1/_collection.yaml')).toBe('api-requests');
    expect(conflictFileSurface('rules/headers-col1/staging-fold1/_folder.yaml')).toBe('http-rules');
    expect(conflictFileSurface('rules/headers-col1/add-auth-rule1/script.js')).toBe('http-rules');
  });

  it('reads an environment, its secret template and the workspace variables as the Variables’', () => {
    expect(conflictFileSurface('environments/staging-env1.yaml')).toBe('variables');
    expect(conflictFileSurface('environments/staging-env1.secret.yaml.template')).toBe('variables');
    expect(conflictFileSurface('workspace-vars.yaml')).toBe('variables');
  });

  it('answers null for the user’s own files, a template, a spec and the workspace manifest', () => {
    expect(conflictFileSurface('notes/orders.md')).toBeNull();
    expect(conflictFileSurface('README.md')).toBeNull();
    expect(conflictFileSurface('workspace.yaml')).toBeNull();
    expect(conflictFileSurface('templates/base-col1/json-tpl1/template.yaml')).toBeNull();
    expect(conflictFileSurface('specs/orders-spec1/spec.yaml')).toBeNull();
    expect(conflictFileSurface('templates/base-col1/json-tpl1/body.json')).toBeNull();
  });
});
