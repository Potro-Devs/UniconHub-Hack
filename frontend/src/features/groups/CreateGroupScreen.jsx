import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { useAppUi } from '@/shared/state/AppUiContext';
import { FormMessage } from '@/shared/components/FormMessage';
import { buttonStyle, card, noticeBox, pageTitle } from '@/shared/styles/ui';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { groupsApi } from './groups.api';
import { MESSAGES, classifyGroupSaveError, findSameGroup, groupLabel, SCHOOL_YEARS, schoolYearToDisplay } from './groups.logic';
import { GroupFieldsPicker } from './GroupFieldsPicker';
import { useTeacherGroups } from './TeacherGroupsContext';
import { DuplicateGroupAlert } from './DuplicateGroupAlert';


/**
 * Paso 1 de 2: alta del grupo (`POST /groups`). Con el 201 navega al detalle
 * (`/docente/grupos/:id?nuevo=1`), donde se pega la lista de alumnos.
 */
export function CreateGroupScreen() {
  const navigate = useNavigate();
  const { say } = useAppUi();
  const { narrow } = useBreakpoint();
  const { groups, upsertGroup, setActiveGroupId, reload } = useTeacherGroups();

  const [fields, setFields] = useState({ grade: 3, section: 'A', schoolYear: SCHOOL_YEARS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null); // { kind: 'duplicate', fields } | { kind: 'generic' }
  const submittingRef = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const label = groupLabel(fields.grade, fields.section);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const group = await groupsApi.create(fields);
      upsertGroup(group);
      setActiveGroupId(group.id);
      say(`Listo, se creó ${group.name}.`);
      reload().catch(() => {});
      navigate(`/docente/grupos/${group.id}?nuevo=1`);
    } catch (err) {
      const kind = classifyGroupSaveError(err);
      setError(kind === 'duplicate' ? { kind, fields: { ...fields } } : { kind });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const existing = error?.kind === 'duplicate' ? findSameGroup(groups, error.fields) : null;

  return (
    <form onSubmit={onSubmit} noValidate style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button
        type="button"
        onClick={() => navigate('/docente/grupos')}
        style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start', minHeight: '44px', padding: '0 4px', fontSize: '15px' }}
      >
        ← Grupos
      </button>

      <div>
        <h1 className="font-display" style={pageTitle}>
          Crear grupo
        </h1>
        <div style={{ fontSize: '15px', color: COLORS.muted, marginTop: '4px' }}>Paso 1 de 2</div>
      </div>

      <div style={card}>
        <GroupFieldsPicker value={fields} onChange={setFields} />
        <div style={noticeBox}>Revisa el grado y el ciclo: cuando agregues alumnos ya no se podrán cambiar.</div>
      </div>

      {error?.kind === 'duplicate' && (
        <DuplicateGroupAlert
          ref={errorRef}
          label={groupLabel(error.fields.grade, error.fields.section)}
          schoolYear={schoolYearToDisplay(error.fields.schoolYear)}
          existing={existing}
          onGo={(g) => navigate(`/docente/grupos/${g.id}`)}
        />
      )}
      {error && error.kind !== 'duplicate' && (
        <div ref={errorRef} tabIndex={-1}>
          <FormMessage message={error.kind === 'network' ? MESSAGES.createNetwork : MESSAGES.createGeneric} />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        aria-disabled={submitting}
        style={{ ...buttonStyle('primary', { tall: true, fullWidth: narrow, disabled: submitting }), alignSelf: narrow ? 'stretch' : 'flex-start' }}
      >
        {submitting ? 'Creando grupo…' : `Crear ${label}`}
      </button>
    </form>
  );
}
