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
 * rail's visibility toggles from the header, session-local.
 */

import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { SPEC_FORMATS } from '@openheaders/core/schemas';
import { SPEC_ENTITY_TYPE } from '@openheaders/core/sync';
import type { SpecFile } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { App, Button, Empty, Tag, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { applySpecSetFile } from '@openheaders/ui/shared/sync/spec-write-client';
import CodeEditor from '../shared/CodeEditor';
import EditorHeader from '../shell/EditorHeader';
import SpecOutlinePane from './SpecOutlinePane';
import { specFileLanguage, specFileSyntaxLabel, useSpecAnalysis } from './spec-validation';

/** Header badge label per format — presentation of the picklist value. */
const FORMAT_LABELS: Record<(typeof SPEC_FORMATS)[number], string> = {
  'openapi-3.0': 'OpenAPI 3.0',
  'openapi-3.1': 'OpenAPI 3.1',
};

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

  const { validation, outline } = useSpecAnalysis(draft);

  // Outline rail visibility — session-local by design (a persisted
  // preference is a settings-schema key away if demand shows).
  const [outlineOpen, setOutlineOpen] = useState(true);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  // Outline click → caret. The offset comes from the parse-on-idle
  // AST, so on a buffer edited since the last tick it can trail the
  // text by a beat — getPositionAt clamps, and the next tick trues it.
  const handleNavigate = useCallback((offset: number) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const position = model.getPositionAt(offset);
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
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
      <Tag style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>{FORMAT_LABELS[spec.format]}</Tag>
      <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{specFileSyntaxLabel(rootFile.fileName)}</Tag>
      <PresenceBadge entityType={SPEC_ENTITY_TYPE} entityId={spec.uid} excludeInstanceId={localInstanceId} />
    </>
  );

  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;

  const headerActions = (
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
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgContainer }}>
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment proportionalLayout={false} separator>
            <Allotment.Pane minSize={160} preferredSize={230} visible={outlineOpen} snap>
              <SpecOutlinePane
                outline={outline}
                files={spec.files}
                rootFileUid={spec.rootFileUid}
                onNavigate={handleNavigate}
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
                  onEditorMount={handleEditorMount}
                />
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
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
