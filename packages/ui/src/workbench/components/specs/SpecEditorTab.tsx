/**
 * SpecEditorTab — the spec document's editor surface (tab mode
 * `spec-edit`).
 *
 * Phase C: Monaco editor over the root source file, live off the spec
 * sync mirror. Dirty derives from buffer-vs-canonical equality
 * (`useReprime` — the mirror row is the baseline; a peer edit reprimes
 * a clean buffer). Save writes the whole file row through
 * `applySpecSetFile` verbatim — the buffer persists byte-for-byte,
 * never normalized. Validation is parse-on-idle through
 * `parseOpenApi` in report-only mode (`spec-validation.ts`); the
 * status strip shows error/warning counts, local only.
 *
 * Phase D: outline rail left of the editor (Allotment split, vendor
 * parity) over the same parse-on-idle tick — clicking an outline row
 * maps its character offset to a position and moves the caret. The
 * rail's visibility toggles from the header, session-local. Add
 * affordances (YAML roots only) splice scaffold snippets into the
 * BUFFER via `executeEdits` — undoable, dirty derives, the mirror
 * only ever sees a Save.
 */

import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
  PlusOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { SPEC_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection, SpecFile } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { App, Badge, Button, Empty, Popover, Tag, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { applySpecSetFile } from '@openheaders/ui/shared/sync/spec-write-client';
import type { Monaco } from '@monaco-editor/react';
import CodeEditor from '../shared/CodeEditor';
import EditorHeader from '../shell/EditorHeader';
import GenerateCollectionModal from './GenerateCollectionModal';
import SpecOutlinePane from './SpecOutlinePane';
import { attachSpecEditorServices } from './spec-editor-services';
import { SPEC_FORMAT_LABELS } from './spec-format-labels';
import { planSpecInsertion, type SpecInsertTarget } from './spec-outline-insert';
import { specFileLanguage, specFileSyntaxLabel, useSpecAnalysis } from './spec-validation';
import UpdateCollectionModal from './UpdateCollectionModal';
import { useSpecSourceHash } from './use-spec-drift';

const SURFACE_ID = 'workbench';

/** Dirty keys on the buffer alone — rename reprimes nothing. */
const fileSignature = (f: SpecFile) => f.content;

interface SpecEditorTabProps {
  specUid: string;
  workspaceId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const SpecEditorTab: React.FC<SpecEditorTabProps> = ({ specUid, workspaceId, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const localInstanceId = useLocalInstanceId();
  const specs = useSpecs(workspaceId);
  const spec = specs.find((s) => s.uid === specUid);
  const rootFile = useMemo(
    () => (spec ? (spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0] ?? null) : null),
    [spec],
  );

  const [draft, setDraft] = useState<string>(() => rootFile?.content ?? '');

  const reprime = useReprime<SpecFile>({
    liveEntity: rootFile,
    scope: { entityType: SPEC_ENTITY_TYPE, entityId: spec?.uid ?? null },
    enabled: rootFile !== null,
    formFingerprint: draft,
    signature: fileSignature,
    populate: (f) => setDraft(f.content),
  });
  const isDirty = reprime.isDirty;

  const { validation, outline } = useSpecAnalysis(draft, spec?.format ?? 'openapi-3.1');

  // Outline rail visibility — session-local by design (a persisted
  // preference is a settings-schema key away if demand shows).
  const [outlineOpen, setOutlineOpen] = useState(true);

  // Generate Collection (Phase E). Linked collections derive from the
  // live collection list by specLink — never cached (drift and link
  // health are judged at read time, Phase F).
  const requestsApi = useRequests();
  const linkedCollections = useMemo(
    () => requestsApi.collections.filter((c) => c.specLink?.specUid === specUid),
    [requestsApi.collections, specUid],
  );
  const [generateOpen, setGenerateOpen] = useState(false);

  // Drift (Phase F) — judged per link against the SAVED source's hash,
  // derived at read time; a dirty buffer never drifts anything.
  const savedHash = useSpecSourceHash(rootFile?.content ?? null);
  const isDrifted = useCallback(
    (c: Collection) => savedHash !== null && c.specLink !== undefined && c.specLink.sourceHash !== savedHash,
    [savedHash],
  );
  const anyDrift = useMemo(() => linkedCollections.some(isDrifted), [linkedCollections, isDrifted]);
  const [updateTarget, setUpdateTarget] = useState<Collection | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const navHighlightRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  // The mount callback reads the format through a ref so its identity
  // stays stable; language services detach with the tab (useEffect
  // teardown), not with the editor instance.
  const specFormatRef = useRef(spec?.format);
  specFormatRef.current = spec?.format;
  const editorServicesRef = useRef<monaco.IDisposable | null>(null);
  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoApi: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    navHighlightRef.current = editor.createDecorationsCollection();
    editorServicesRef.current?.dispose();
    if (specFormatRef.current !== undefined) {
      editorServicesRef.current = attachSpecEditorServices(editor, monacoApi, specFormatRef.current);
    }
  }, []);
  useEffect(
    () => () => {
      editorServicesRef.current?.dispose();
      editorServicesRef.current = null;
    },
    [],
  );

  // Outline click → caret + section highlight (vendor parity: a bar in
  // the lines-decorations gutter spanning the clicked section, replaced
  // by the next click). The offsets come from the parse-on-idle AST, so
  // on a buffer edited since the last tick they can trail the text by a
  // beat — getPositionAt clamps, and the next tick trues it.
  const handleNavigate = useCallback((offset: number, end?: number) => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monacoApi || !model) return;
    const position = model.getPositionAt(offset);
    let endLine = position.lineNumber;
    if (end !== undefined && end > offset) {
      const endPosition = model.getPositionAt(end);
      // A block node's end lands at column 1 of the line AFTER its last
      // content (trailing newline) — highlight must not bleed onto it.
      endLine =
        endPosition.column === 1 && endPosition.lineNumber > position.lineNumber
          ? endPosition.lineNumber - 1
          : endPosition.lineNumber;
    }
    navHighlightRef.current?.set([
      {
        range: new monacoApi.Range(position.lineNumber, 1, endLine, 1),
        options: { isWholeLine: true, linesDecorationsClassName: 'oh-spec-nav-section' },
      },
    ]);
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
    editor.focus();
  }, []);

  // Outline "+" → scaffold snippet spliced into the buffer at the
  // AST-computed spot. `executeEdits` keeps it on the undo stack and
  // routes through onChange, so dirty derives like any typed edit; the
  // editable token ends up selected for immediate renaming. Planned
  // off the LIVE model text (not the parse-on-idle draft) so the spot
  // never trails a just-typed edit; a non-parsing buffer plans null —
  // the validation strip is already explaining why.
  const handleInsert = useCallback((target: SpecInsertTarget) => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monacoApi || !model) return;
    const plan = planSpecInsertion(model.getValue(), target);
    if (!plan) return;
    const position = model.getPositionAt(plan.offset);
    editor.pushUndoStop();
    editor.executeEdits('spec-outline-add', [
      {
        range: new monacoApi.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: plan.text,
      },
    ]);
    editor.pushUndoStop();
    const start = model.getPositionAt(plan.selectionStart);
    const end = model.getPositionAt(plan.selectionEnd);
    editor.setSelection(new monacoApi.Selection(start.lineNumber, start.column, end.lineNumber, end.column));
    editor.revealPositionInCenterIfOutsideViewport(start);
    editor.focus();
  }, []);

  const handleSave = useCallback(async () => {
    if (!spec || !rootFile || !workspaceId || !isDirty) return;
    const result = await applySpecSetFile(
      spec.uid,
      { ...rootFile, content: draft },
      { workspaceId, surfaceId: SURFACE_ID },
    );
    if (result.ok) return;
    if (result.reason === 'not-found') {
      message.error(t('workbench.editors.spec.deletedElsewhere'));
    } else {
      message.error(t('workbench.editors.spec.saveFailed'));
    }
  }, [spec, rootFile, workspaceId, isDirty, draft, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: SPEC_ENTITY_TYPE,
    entityId: spec?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!spec || !rootFile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workbench.editors.spec.notFound')} />
      </div>
    );
  }

  const headerTitle = (
    <>
      <FileTextOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        {rootFile.fileName}
      </Typography.Text>
      <Tag style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>{SPEC_FORMAT_LABELS[spec.format]}</Tag>
      <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{specFileSyntaxLabel(rootFile.fileName)}</Tag>
      <PresenceBadge entityType={SPEC_ENTITY_TYPE} entityId={spec.uid} excludeInstanceId={localInstanceId} />
    </>
  );

  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;

  // Vendor parity: the toolbar button reads "Generate Collection"
  // until a link exists, then flips to a "Collections" popover listing
  // every generated collection (one spec → many links); per-link
  // in-sync badges + Update ride Phase F. Protobuf specs carry no
  // generate affordance yet — collection generation from proto
  // services lands with the gRPC client's close-out phase.
  const generateAction =
    spec.format === 'protobuf' ? null : linkedCollections.length === 0 ? (
      <Button
        size="small"
        onClick={() => setGenerateOpen(true)}
        style={{ fontSize: 11 }}
        data-testid="spec-generate-collection"
      >
        {t('workbench.editors.spec.generate.button')}
      </Button>
    ) : (
      <Popover
        trigger="click"
        placement="bottomRight"
        title={
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {t('workbench.editors.spec.generate.popoverTitle')}
          </span>
        }
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
            {linkedCollections.map((c) => {
              const drifted = isDrifted(c);
              return (
                <div key={c.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <FolderOutlined style={{ color: token.colorTextTertiary }} />
                  <Typography.Text style={{ fontSize: 12, flex: 1, minWidth: 0 }} ellipsis>
                    {c.name}
                  </Typography.Text>
                  <Tooltip
                    title={t(
                      drifted ? 'workbench.editors.spec.update.driftedBadge' : 'workbench.editors.spec.update.inSyncBadge',
                    )}
                  >
                    {drifted ? (
                      <SyncOutlined style={{ color: token.colorWarning }} data-testid={`spec-link-drifted-${c.uid}`} />
                    ) : (
                      <CheckCircleOutlined
                        style={{ color: token.colorSuccess }}
                        data-testid={`spec-link-in-sync-${c.uid}`}
                      />
                    )}
                  </Tooltip>
                  <Button
                    size="small"
                    style={{ fontSize: 11 }}
                    disabled={!drifted}
                    onClick={() => setUpdateTarget(c)}
                    data-testid={`spec-link-update-${c.uid}`}
                  >
                    {t('workbench.editors.spec.update.button')}
                  </Button>
                </div>
              );
            })}
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setGenerateOpen(true)}
              style={{ fontSize: 11, justifyContent: 'flex-start', marginTop: 4 }}
              data-testid="spec-generate-collection"
            >
              {t('workbench.editors.spec.generate.button')}
            </Button>
          </div>
        }
      >
        <Badge dot={anyDrift} offset={[-2, 2]} title={anyDrift ? t('workbench.editors.spec.update.driftedBadge') : undefined}>
          <Button size="small" style={{ fontSize: 11 }} data-testid="spec-collections-popover">
            {t('workbench.editors.spec.generate.collectionsButton')} ({linkedCollections.length})
          </Button>
        </Badge>
      </Popover>
    );

  const headerActions = (
    <>
      {generateAction}
      <Tooltip
        title={t(outlineOpen ? 'workbench.editors.spec.outline.hide' : 'workbench.editors.spec.outline.show')}
        placement="bottom"
      >
        <Button
          size="small"
          type={outlineOpen ? 'default' : 'text'}
          icon={<ApartmentOutlined />}
          onClick={() => setOutlineOpen((open) => !open)}
          aria-pressed={outlineOpen}
          aria-label={t(outlineOpen ? 'workbench.editors.spec.outline.hide' : 'workbench.editors.spec.outline.show')}
          style={{ fontSize: 11 }}
          data-testid="spec-outline-toggle"
        />
      </Tooltip>
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgContainer }}>
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment proportionalLayout={false} separator>
            <Allotment.Pane minSize={160} preferredSize={230} visible={outlineOpen} snap>
              <SpecOutlinePane
                groups={outline}
                files={spec.files}
                rootFileUid={spec.rootFileUid}
                onNavigate={handleNavigate}
                canInsert={specFileLanguage(rootFile.fileName) === 'yaml'}
                onInsert={handleInsert}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={320}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 8 }}>
                <CodeEditor
                  fill
                  value={draft}
                  onChange={setDraft}
                  language={specFileLanguage(rootFile.fileName)}
                  variableAutoComplete={false}
                  linkDetection
                  onEditorMount={handleEditorMount}
                />
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
        <GenerateCollectionModal
          open={generateOpen}
          spec={spec}
          content={rootFile.content}
          editorDirty={isDirty}
          onCancel={() => setGenerateOpen(false)}
        />
        {updateTarget !== null && (
          <UpdateCollectionModal
            open
            spec={spec}
            content={rootFile.content}
            collection={updateTarget}
            editorDirty={isDirty}
            onCancel={() => setUpdateTarget(null)}
          />
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '3px 12px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            fontSize: 11,
            color: token.colorTextTertiary,
            flexShrink: 0,
          }}
        >
          {validation !== null &&
            (errorCount === 0 && warningCount === 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                {t('workbench.editors.spec.validation.clean')}
              </span>
            ) : (
              <>
                {errorCount > 0 && (
                  <Tooltip title={validation.errors.join('\n')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: token.colorError }}>
                      <CloseCircleOutlined />
                      {t('workbench.editors.spec.validation.errors', { count: errorCount })}
                    </span>
                  </Tooltip>
                )}
                {warningCount > 0 && (
                  <Tooltip
                    title={
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {validation.warnings.slice(0, 8).join('\n')}
                        {warningCount > 8 ? '\n…' : ''}
                      </div>
                    }
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: token.colorWarning }}>
                      <WarningOutlined />
                      {t('workbench.editors.spec.validation.warnings', { count: warningCount })}
                    </span>
                  </Tooltip>
                )}
              </>
            ))}
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default SpecEditorTab;
