import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { authApi } from '@/features/auth/auth.api';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { buttonStyle, card, mutedText, pill } from '@/shared/styles/ui';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { AddStudentForm } from './AddStudentForm';
import { BulkStudentsForm } from './BulkStudentsForm';
import { EditGroupPanel } from './EditGroupPanel';
import { groupsApi } from './groups.api';
import { schoolYearToDisplay, secretWindowStatus } from './groups.logic';
import { JoinCode } from './JoinCode';
import { StudentList } from './StudentList';
import { useTeacherGroups } from './TeacherGroupsContext';

function useQuickLoginEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    authApi
      .quickLoginStatus()
      .then((s) => !cancelled && setEnabled(Boolean(s?.enabled)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}

/**
 * Detalle del grupo (`GET /groups/:id` y `/students`): código, alumnos, pegar lista,
 * alta individual y edición. Con `?nuevo=1` es el paso 2 de 2 del alta.
 */
export function GroupDetailScreen() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('nuevo') === '1';
  const navigate = useNavigate();
  const { session } = useSession();
  const canEdit = session?.role === 'teacher';
  const { groups, activeGroup, setActiveGroupId, upsertGroup } = useTeacherGroups();
  const showExample = useQuickLoginEnabled();
  const { say } = useAppUi();

  const [groupState, setGroupState] = useState({ status: 'loading', group: null });
  const [studentsState, setStudentsState] = useState({ status: 'loading', students: [] });
  const [bulkOpen, setBulkOpen] = useState(null); // null = aún no se decide
  const [panel, setPanel] = useState(null); // 'add' | 'edit' | null
  const [justSaved, setJustSaved] = useState(false);
  const headingRef = useRef(null);
  // Ignora respuestas tardías de un grupo anterior al cambiar de `groupId`.
  const currentIdRef = useRef(groupId);
  currentIdRef.current = groupId;

  const loadGroup = useCallback(async () => {
    try {
      const group = await groupsApi.get(groupId);
      if (currentIdRef.current !== groupId) return;
      setGroupState({ status: 'ready', group });
      upsertGroup(group);
    } catch (error) {
      if (currentIdRef.current !== groupId) return;
      const notFound = error?.status === 404 || error?.status === 400;
      setGroupState((prev) => (prev.group && !notFound ? prev : { status: notFound ? 'notFound' : 'error', group: null }));
    }
  }, [groupId, upsertGroup]);

  const loadStudents = useCallback(async () => {
    try {
      const students = await groupsApi.listStudents(groupId);
      if (currentIdRef.current !== groupId) return;
      setStudentsState({ status: 'ready', students: Array.isArray(students) ? students : [] });
    } catch {
      if (currentIdRef.current !== groupId) return;
      setStudentsState((prev) => ({ ...prev, status: 'error' }));
    }
  }, [groupId]);

  useEffect(() => {
    setGroupState({ status: 'loading', group: null });
    setStudentsState({ status: 'loading', students: [] });
    setBulkOpen(null);
    setPanel(null);
    setJustSaved(false);
    loadGroup();
    loadStudents();
  }, [loadGroup, loadStudents]);

  useEffect(() => {
    if (bulkOpen === null && studentsState.status === 'ready') {
      setBulkOpen(isNew || studentsState.students.length === 0);
    }
  }, [bulkOpen, studentsState, isNew]);

  useEffect(() => {
    if (groupState.status === 'notFound' || groupState.status === 'error') headingRef.current?.focus();
  }, [groupState.status]);

  if (groupState.status === 'loading') {
    return (
      <div role="status" aria-live="polite" style={{ ...mutedText, padding: '24px 0' }}>
        Cargando grupo…
      </div>
    );
  }

  if (groupState.status === 'notFound' || groupState.status === 'error') {
    const notFound = groupState.status === 'notFound';
    return (
      <div role="alert" style={{ ...card, alignItems: 'flex-start', maxWidth: '560px' }}>
        <h1 ref={headingRef} tabIndex={-1} className="font-display" style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>
          {notFound ? 'No encontramos este grupo.' : 'No pudimos cargar el grupo. Revisa tu conexión e intenta de nuevo.'}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {!notFound && (
            <button
              type="button"
              onClick={() => {
                setGroupState({ status: 'loading', group: null });
                loadGroup();
              }}
              style={buttonStyle('primary')}
            >
              Reintentar
            </button>
          )}
          <button type="button" onClick={() => navigate('/docente/grupos')} style={buttonStyle(notFound ? 'primary' : 'secondary')}>
            Volver a mis grupos
          </button>
        </div>
      </div>
    );
  }

  const { group } = groupState;
  const isActive = activeGroup?.id === group.id;
  const students = studentsState.students;

  const onBulkSaved = () => {
    setBulkOpen(false);
    setJustSaved(true);
    loadGroup();
    loadStudents();
  };

  const onStudentAdded = () => {
    loadGroup();
    loadStudents();
  };

  const onGroupEdited = (updated) => {
    setGroupState({ status: 'ready', group: updated });
    upsertGroup(updated);
  };

  const bulkTitle = isNew && !justSaved ? 'Paso 2 de 2 · Agrega a tus alumnos' : 'Agrega a tus alumnos';

  return (
    <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button
        type="button"
        onClick={() => navigate('/docente/grupos')}
        style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start', minHeight: '44px', padding: '0 4px', fontSize: '15px' }}
      >
        ← Grupos
      </button>

      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '38px', lineHeight: 1 }}>
            {group.name}
          </h1>
          <div style={{ ...mutedText, marginTop: '6px' }}>
            Ciclo {schoolYearToDisplay(group.schoolYear)} · Fase {group.phase} · {group.studentCount} alumnos
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {isActive ? (
            <span style={pill}>✓ Grupo activo</span>
          ) : (
            <button type="button" onClick={() => setActiveGroupId(group.id)} style={buttonStyle('secondary')}>
              Usar este grupo
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              aria-expanded={panel === 'edit'}
              onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
              style={buttonStyle('secondary')}
            >
              Editar grupo
            </button>
          )}
        </div>
      </header>

      {panel === 'edit' && canEdit && (
        <EditGroupPanel group={group} groups={groups} onSaved={onGroupEdited} onClose={() => setPanel(null)} />
      )}

      {canEdit && <section aria-labelledby="join-code-title" style={card}>
        <h2 id="join-code-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          Código para tus alumnos
        </h2>
        <JoinCode code={group.joinCode} size={36} label={`Código de ${group.name}`} />
        <div style={mutedText}>Entran sin correo: escriben el código, eligen su tarjeta y tocan su imagen secreta.</div>
      </section>}

      {justSaved && isNew && (
        <section
          aria-labelledby="next-curriculum"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            padding: '18px 20px',
            borderRadius: '20px',
            background: COLORS.primary,
            color: COLORS.onPrimary,
          }}
        >
          <h2 id="next-curriculum" className="font-display" style={{ margin: 0, flex: '1 1 220px', fontSize: '22px', fontWeight: 700 }}>
            Siguiente: marca en qué van del temario
          </h2>
          <button
            type="button"
            onClick={() => navigate('/docente/temario')}
            style={{ ...buttonStyle('secondary'), border: 0, color: COLORS.primarySoftFg }}
          >
            Ir al temario
          </button>
        </section>
      )}

      {canEdit && bulkOpen && (
        <BulkStudentsForm group={group} title={bulkTitle} showExample={showExample} onSaved={onBulkSaved} />
      )}

      {canEdit && panel === 'add' && (
        <AddStudentForm group={group} onSaved={onStudentAdded} onClose={() => setPanel(null)} />
      )}

      {canEdit && studentsState.status === 'ready' && students.length > 0 && (
        <SecretImagesCard
          group={group}
          students={students}
          onGroupChanged={(updated) => { setGroupState({ status: 'ready', group: updated }); upsertGroup(updated); }}
          say={say}
        />
      )}

      <section aria-labelledby="students-title" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <h2 id="students-title" className="font-display" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
            {studentsState.status === 'ready' ? `${students.length} alumnos` : 'Alumnos'}
          </h2>
          {canEdit && studentsState.status === 'ready' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {!bulkOpen && students.length > 0 && (
                <button type="button" onClick={() => setBulkOpen(true)} style={buttonStyle('secondary')}>
                  Pegar más alumnos
                </button>
              )}
              {panel !== 'add' && (
                <button type="button" onClick={() => setPanel('add')} style={buttonStyle('secondary')}>
                  Agregar un alumno
                </button>
              )}
            </div>
          )}
        </div>

        {studentsState.status === 'loading' && (
          <div role="status" aria-live="polite" style={mutedText}>
            Cargando alumnos…
          </div>
        )}
        {studentsState.status === 'error' && (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '16px' }}>No pudimos cargar la lista. Intenta de nuevo.</span>
            <button
              type="button"
              onClick={() => {
                setStudentsState((prev) => ({ ...prev, status: 'loading' }));
                loadStudents();
              }}
              style={buttonStyle('primary')}
            >
              Reintentar
            </button>
          </div>
        )}
        {studentsState.status === 'ready' && students.length === 0 && (
          <div style={mutedText}>Todavía no hay alumnos en este grupo.</div>
        )}
        {studentsState.status === 'ready' && students.length > 0 && (
          <StudentList
            students={students}
            groupId={group.id}
            canEdit={canEdit}
            onUpdated={(updated, message) => {
              setStudentsState((prev) => ({ ...prev, students: prev.students.map((s) => (s.id === updated.id ? updated : s)) }));
              if (message) say(message);
            }}
            onRemoved={(studentId, message) => {
              setStudentsState((prev) => ({ ...prev, students: prev.students.filter((s) => s.id !== studentId) }));
              // Refresca el conteo del encabezado y de la lista de grupos (como al agregar alumnos).
              loadGroup();
              say(message);
            }}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Imágenes secretas del grupo: cuántos alumnos ya la tienen y la ventana "Hoy configuramos imágenes".
 * Solo con la ventana abierta un alumno sin imagen puede elegirla (en clase, con la docente presente).
 */
function SecretImagesCard({ group, students, onGroupChanged, say }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const withSecret = students.filter((s) => s.hasSecret).length;
  const status = secretWindowStatus(group.secretSetupUntil);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = status.open ? await groupsApi.closeSecretSetup(group.id) : await groupsApi.openSecretSetup(group.id, 60);
      onGroupChanged(updated);
      say(status.open ? 'Configuración de imágenes cerrada.' : 'Configuración de imágenes abierta por 1 hora.');
    } catch (e) {
      setError(errorMessageOf(e));
    }
    setBusy(false);
  };

  return (
    <section aria-labelledby="secret-title" style={card}>
      <h2 id="secret-title" className="font-display" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Imágenes secretas para entrar</h2>
      <p style={{ ...mutedText, margin: '6px 0 0' }}>
        Después de tocar su tarjeta, cada alumno toca su imagen secreta. Así nadie entra por error con la tarjeta de un compañero.
      </p>
      <p style={{ margin: '10px 0 0', fontSize: '16px' }}>
        <strong>{withSecret} de {students.length}</strong> alumnos ya tienen su imagen.
      </p>
      <p role="status" style={{ margin: '6px 0 0', fontSize: '16px' }}>
        {status.open
          ? <>Configuración <strong>abierta</strong> hasta las {status.untilLabel}: los alumnos sin imagen pueden elegirla ahora.</>
          : 'Configuración cerrada: los alumnos sin imagen verán "Pídele ayuda a tu maestra".'}
      </p>
      <FormMessage message={error} />
      <div style={{ marginTop: '10px' }}>
        <button type="button" onClick={toggle} disabled={busy} style={buttonStyle(status.open ? 'secondary' : 'primary', { disabled: busy })}>
          {busy ? 'Un momento…' : status.open ? 'Cerrar configuración' : 'Abrir configuración por 1 hora'}
        </button>
      </div>
    </section>
  );
}
