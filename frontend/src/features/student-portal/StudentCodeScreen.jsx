import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { authApi } from '@/features/auth/auth.api';
import { Mascot } from '@/features/mascot';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { normalizeJoinCodeInput } from '@/shared/state/session';
import { useSession } from '@/shared/state/SessionContext';

/**
 * Pantalla 09: Acceso del alumno mediante código de grupo.
 */
export function StudentCodeScreen() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { axiColor, joinCode, setJoinCode, setJoinRoster } = useAppUi();
  const { session } = useSession();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (session?.role === 'student') {
    return <Navigate to="/alumno/ejercicio" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    if (joinCode.length !== 6) {
      setError('El código tiene 6 letras y números. Pídeselo a tu maestra o maestro.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      setJoinRoster(await authApi.joinGroup(joinCode));
      navigate('/alumno/nombre');
    } catch (err) {
      setError(errorMessageOf(err));
      setPending(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '20px 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div
          className="font-display"
          style={{
            padding: '14px 20px',
            borderRadius: '22px',
            background: '#fff',
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1.3,
            textAlign: 'center',
            maxWidth: '340px',
          }}
        >
          ¡Hola! Soy {APP_NAME}. Escribe el código de tu grupo.
        </div>
        <Mascot size={180} color={axiColor} animate={!reducedMotion} />
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        aria-busy={pending}
        style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <input
          value={joinCode}
          onChange={(e) => {
            setJoinCode(normalizeJoinCodeInput(e.target.value));
            setError(null);
          }}
          aria-label="Código de grupo"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'join-error' : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          placeholder="ABC123"
          style={{
            height: '72px',
            borderRadius: '20px',
            border: `3px solid ${COLORS.ink}`,
            background: '#fff',
            textAlign: 'center',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 800,
            fontSize: '34px',
            lineHeight: 1,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
          }}
        />

        <FormMessage id="join-error" message={error} />

        <button
          type="submit"
          disabled={pending}
          style={{
            height: '64px',
            borderRadius: '20px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1,
            cursor: pending ? 'wait' : 'pointer',
            boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
          }}
        >
          {pending ? 'Buscando tu grupo…' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
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
          ← Acceso docente
        </button>
      </form>
    </div>
  );
}
