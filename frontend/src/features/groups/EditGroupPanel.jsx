import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormMessage } from '@/shared/components/FormMessage';
import { buttonStyle, card, noticeBox } from '@/shared/styles/ui';
import { groupsApi } from './groups.api';
import { MESSAGES, classifyGroupSaveError, findSameGroup, groupLabel, schoolYearToDisplay } from './groups.logic';
import { DuplicateGroupAlert } from './DuplicateGroupAlert';
import { GroupFieldsPicker } from './GroupFieldsPicker';


/**
 * Editar grupo (`PATCH /groups/:id`). Con alumnos, grado y ciclo quedan bloqueados desde el inicio;
 * si aun así el servidor responde que hay historial, se regresan los valores originales.
 */
export function EditGroupPanel({ group, groups, onSaved, onClose }) {
  const navigate = useNavigate();
  const original = { grade: group.grade, section: group.section, schoolYear: group.schoolYear };
  const [fields, setFields] = useState(original);
  const [locked, setLocked] = useState(group.studentCount > 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // { kind: 'duplicate', fields } | { kind: 'history' } | { kind: 'generic' }
  const [saved, setSaved] = useState(false);
  const errorRef = useRef(null);
  const noteId = `edit-lock-note-${group.id}`;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const patch = {};
    if (fields.grade !== group.grade) patch.grade = fields.grade;
    if (fields.section !== group.section) patch.section = fields.section;
    if (fields.schoolYear !== group.schoolYear) patch.schoolYear = fields.schoolYear;
    setError(null);
    setSaved(false);
    if (Object.keys(patch).length === 0) {
      setSaved(true);
      return;
    }
    setSaving(true);
    try {
      const updated = await groupsApi.update(group.id, patch);
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      const kind = classifyGroupSaveError(err);
      if (kind === 'history') {
        setFields((prev) => ({ ...prev, grade: group.grade, schoolYear: group.schoolYear }));
        setLocked(true);
        setError({ kind });
      } else if (kind === 'duplicate') {
        setError({ kind, fields: { ...fields } });
      } else {
        setError({ kind });
      }
    } finally {
      setSaving(false);
    }
  };

  const existing = error?.kind === 'duplicate' ? findSameGroup(groups, error.fields, group.id) : null;

  return (
    <form onSubmit={onSubmit} noValidate style={card} aria-labelledby={`edit-title-${group.id}`}>
      <h2 id={`edit-title-${group.id}`} className="font-display" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
        Editar grupo
      </h2>
      {locked && error?.kind !== 'history' && (
        <div id={noteId} style={noticeBox}>
          {MESSAGES.historyLock}
        </div>
      )}
      <GroupFieldsPicker
        value={fields}
        onChange={(next) => {
          setFields(next);
          setSaved(false);
        }}
        lockGradeYear={locked}
        lockedNoteId={noteId}
        phase={fields.grade === group.grade ? group.phase : undefined}
      />

      {error?.kind === 'history' && (
        <div ref={errorRef} tabIndex={-1} id={noteId}>
          <FormMessage message={MESSAGES.historyLock} />
        </div>
      )}
      {error?.kind === 'duplicate' && (
        <DuplicateGroupAlert
          ref={errorRef}
          label={groupLabel(error.fields.grade, error.fields.section)}
          schoolYear={schoolYearToDisplay(error.fields.schoolYear)}
          existing={existing}
          onGo={(g) => navigate(`/docente/grupos/${g.id}`)}
        />
      )}
      {(error?.kind === 'generic' || error?.kind === 'network') && (
        <div ref={errorRef} tabIndex={-1}>
          <FormMessage message={error.kind === 'network' ? MESSAGES.editNetwork : MESSAGES.editGeneric} />
        </div>
      )}
      <div role="status" aria-live="polite" style={{ fontSize: '15px', fontWeight: 700 }}>
        {saved ? 'Cambios guardados.' : ''}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button type="submit" disabled={saving} style={buttonStyle('primary', { disabled: saving })}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={onClose} style={buttonStyle('secondary')}>
          Cerrar
        </button>
      </div>
    </form>
  );
}
