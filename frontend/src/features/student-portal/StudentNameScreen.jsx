import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { authApi } from '@/features/auth/auth.api';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';

/**
 * Pantalla 09b: Selección visual del alumno dentro de su grupo sin contraseña.
 */
export function StudentNameScreen() {
  const navigate = useNavigate();
  const { joinCode, joinRoster, resetStudentSession } = useAppUi();
  const { session, signIn } = useSession();
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);

  if (session?.role === 'student') return <Navigate to="/alumno/inicio" replace />;
  // Se llega aquí después de escribir el código (al recargar la página se vuelve a pedir).
  if (!joinRoster) return <Navigate to="/alumno/codigo" replace />;

  const { group, students } = joinRoster;

  const choose = async (student) => {
    setError(null);
    setPendingId(student.id);
    try {
      signIn(await authApi.selectStudent(joinCode, student.id));
      resetStudentSession(0);
      navigate('/alumno/inicio', { replace: true });
    } catch (err) {
      setError(errorMessageOf(err));
      setPendingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '32px', lineHeight: 1.1 }}>
          ¿Cuál es tu nombre?
        </h1>
        <div style={{ fontSize: '17px', marginTop: '4px' }}>Grupo {group.name} · toca tu nombre</div>
      </div>

      <FormMessage message={error} />

      {students.length === 0 ? (
        <div style={{ padding: '18px', borderRadius: '18px', background: '#fff', fontSize: '17px', lineHeight: 1.4 }}>
          Este grupo todavía no tiene alumnos. Avísale a tu maestra o maestro.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '10px',
          }}
        >
          {students.map((st) => (
            <button
              key={st.id}
              type="button"
              className="axi-student-card"
              disabled={pendingId != null}
              aria-busy={pendingId === st.id}
              onClick={() => choose(st)}
              style={{
                minHeight: '64px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '18px',
                border: 0,
                background: '#fff',
                cursor: pendingId != null ? 'wait' : 'pointer',
                opacity: pendingId != null && pendingId !== st.id ? 0.6 : 1,
                textAlign: 'left',
                fontSize: '17px',
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '38px',
                  height: '38px',
                  flex: 'none',
                  borderRadius: '50%',
                  background: st.avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}
              >
                {st.initials}
              </span>
              {pendingId === st.id ? 'Entrando…' : st.displayName}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/alumno/codigo')}
        style={{
          alignSelf: 'flex-start',
          border: 0,
          background: 'none',
          minHeight: '44px',
          padding: '6px 0',
          fontSize: '14px',
          fontWeight: 700,
          color: '#3A4565',
          cursor: 'pointer',
        }}
      >
        ← Cambiar código
      </button>
    </div>
  );
}
