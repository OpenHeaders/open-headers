/**
 * Conflict tracking + resolve adapters for Spec.
 *
 * Driven by the field-tree descriptor + generic walker. Scalar leaves:
 * name, description, format, rootFileUid. `files` is a uid-keyed set;
 * each row carries fileName + content leaves — content is one
 * whole-string leaf (spec source text is verbatim; the walker never
 * looks inside it). Concurrent same-uid renames surface as a leaf
 * conflict at `files.<uid>.fileName`, not set-add + set-remove.
 */

import { SPEC_FORMATS } from '@openheaders/core/schemas';
import type { Spec, SpecFile } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { enumLeaf, leaf, obj, setByUid } from '@openheaders/ui/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';

const SPEC_SCHEMA = obj({
  name: leaf('string'),
  description: leaf('string'),
  format: enumLeaf(SPEC_FORMATS),
  rootFileUid: leaf('string'),
  files: setByUid({
    summary: (row) => (row as SpecFile).fileName ?? '',
    rowLabel: (t, row) => {
      const f = row as SpecFile;
      return f.fileName
        ? t('shared.conflicts.label.spec.fileRowNamed', { name: f.fileName })
        : t('shared.conflicts.label.spec.fileRow');
    },
    child: obj({
      fileName: leaf('string'),
      content: leaf('string'),
    }),
  }),
});

const adapters = makeConflictAdapter<Spec>({
  schema: SPEC_SCHEMA,
  signature: (e) => e.uid,
});

const SCALAR_LABEL: Record<string, MessageKey> = {
  name: 'shared.conflicts.label.spec.field.name',
  description: 'shared.conflicts.label.spec.field.description',
  format: 'shared.conflicts.label.spec.field.format',
  rootFileUid: 'shared.conflicts.label.spec.field.rootFileUid',
};

const FILE_LEAF_LABEL: Record<string, MessageKey> = {
  fileName: 'shared.conflicts.label.spec.fileField.fileName',
  content: 'shared.conflicts.label.spec.fileField.content',
};

const FILE_PATH_RE = /^files\.([a-z0-9]{8})\.(fileName|content)$/;

export const specConflictAdapter: ConflictTrackingAdapter<Spec> = adapters.tracking;

export const specResolveAdapter: ConflictResolveAdapter<Spec> = {
  ...adapters.resolve,
  prettyPath(t, entity, path) {
    const scalarKey = SCALAR_LABEL[path];
    if (scalarKey) return t('shared.conflicts.label.spec.leaf', { label: t(scalarKey) });
    const fileMatch = FILE_PATH_RE.exec(path);
    if (fileMatch) {
      const name = entity.files.find((f) => f.uid === fileMatch[1])?.fileName ?? null;
      const label = t(FILE_LEAF_LABEL[fileMatch[2]]);
      return name
        ? t('shared.conflicts.label.spec.fileLeafNamed', { name, label })
        : t('shared.conflicts.label.spec.fileLeaf', { label });
    }
    return adapters.resolve.prettyPath(t, entity, path);
  },
};
