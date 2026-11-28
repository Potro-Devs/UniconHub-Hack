import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { authApi } from '@/features/auth/auth.api';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { JoinSteps } from './JoinSteps';
import { StudentSecretStep } from './StudentSecretStep';
import { readableTextOn } from '@/features/groups/groups.logic';

/**
 * Pantalla 09b: el alumno toca su tarjeta y después su imagen secreta (paso 3), para que nadie
 * entre por error con la tarjeta de un compañero.
 */
export function StudentNameScreen() {
  const navigate = useNavigate();
  const { joinCode, joinRoster, resetStudentSession } = useAppUi();
  const { session, signIn } = useSession();
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null); // respuesta de select: paso de la imagen secreta

  if (session?.role === 'student') return <Navigate to="/alumno/inicio" replace />;
  // Se llega aquí después de escribir el código (al recargar la página se vuelve a pedir).
  if (!joinRoster) return <Navigate to="/alumno/codigo" replace />;

  const { group, students } = joinRoster;

  const choose = async (student) => {
    setError(null);
    setPendingId(student.id);
    try {
      setSelection(await authApi.selectStudent(joinCode, student.id));
    } catch (err) {
      setError(errorMessageOf(err));
    }
    setPendingId(null);
  };

  if (selection) {
    return (
      <StudentSecretStep
        joinCode={joinCode}
        selection={selection}
        onSignedIn={(data) => {
          signIn(data);
          resetStudentSession();
          navigate('/alumno/inicio', { replace: true });
        }}
        onBack={() => setSelection(null)}
      />
    );
  }

  return (
    <div className="kid-access" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <JoinSteps current={2} />
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
              className="axi-student-card kid-name-card"
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
                  width: '46px',
                  height: '46px',
                  flex: 'none',
                  borderRadius: '50%',
                  background: st.avatarColor,
                  color: readableTextOn(st.avatarColor, COLORS.ink, COLORS.onPrimary),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '17px',
                }}
              >
                {st.initials}
              </span>
              {pendingId === st.id ? 'Un momento…' : st.displayName}
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
