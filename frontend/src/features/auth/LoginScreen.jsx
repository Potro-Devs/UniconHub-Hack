import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { Toast } from '@/shared/components/Toast';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { homePathFor, safeReturnPath } from '@/shared/state/session';
import { useSession } from '@/shared/state/SessionContext';
import { authApi } from './auth.api';

const inputStyle = {
  height: '50px',
  borderRadius: '14px',
  border: `1px solid ${COLORS.borderInput}`,
  background: '#fff',
  padding: '0 14px',
  fontSize: '16px',
  fontWeight: 400,
};

const secondaryButtonStyle = {
  flex: '1 1 150px',
  minHeight: '50px',
  borderRadius: '16px',
  border: `1px solid ${COLORS.borderInput}`,
  background: '#fff',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
};

/**
 * Pantalla 00: Acceso docente, botones de acceso rápido demo y entrada a portal alumno.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const { toast, resetStudentSession } = useAppUi();
  const { session, signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // 'login' | 'teacher' | 'student' | 'director'
  const [quickLoginEnabled, setQuickLoginEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .quickLoginStatus()
      .then((status) => !cancelled && setQuickLoginEnabled(Boolean(status?.enabled)))
      .catch(() => !cancelled && setQuickLoginEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (session && !pending) {
    return <Navigate to={homePathFor(session)} replace />;
  }

  const run = async (kind, action, target) => {
    setError(null);
    setPending(kind);
    try {
      const next = signIn(await action());
      if (next.role === 'student') resetStudentSession(0);
      navigate(target ?? safeReturnPath(location.state?.from, next), { replace: true });
    } catch (err) {
      setError(errorMessageOf(err));
      setPending(null);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    run('login', () => authApi.login(email.trim(), password));
  };

  const busy = pending != null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        background: COLORS.bg,
      }}
    >
      {/* Panel izquierdo de bienvenida */}
      <div
        style={{
          flex: '1 1 360px',
          minHeight: narrow ? '340px' : 'auto',
          background: COLORS.primary,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '36px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'oklch(0.55 0.2 268)',
            top: '-150px',
            left: '-120px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'oklch(0.46 0.19 268)',
            bottom: '-80px',
            right: '-60px',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Mascot size={210} animate={!reducedMotion} />
          <div className="font-display" style={{ fontWeight: 800, fontSize: '60px', lineHeight: 1 }}>
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: '18px',
              maxWidth: '30ch',
              textAlign: 'center',
              lineHeight: 1.4,
              textWrap: 'pretty',
            }}
          >
            Saber en qué punto va cada alumno, y que su diagnóstico lo acompañe de grado en grado.
          </div>
        </div>
      </div>

      {/* Panel derecho de inicio de sesión */}
      <div
        style={{
          flex: '1 1 360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
        }}
      >
        <form
          onSubmit={onSubmit}
          noValidate
          aria-busy={busy}
          style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '32px', lineHeight: 1.1 }}>
            Entra como docente
          </h1>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
            Correo
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
            Contraseña
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              style={inputStyle}
            />
          </label>

          <FormMessage id="login-error" message={error} />

          <button
            type="submit"
            className="axi-btn-primary"
            disabled={busy}
            style={{
              height: '54px',
              borderRadius: '16px',
              border: 0,
              background: COLORS.primary,
              color: '#fff',
              fontSize: '17px',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy && pending !== 'login' ? 0.6 : 1,
            }}
          >
            {pending === 'login' ? 'Entrando…' : 'Entrar'}
          </button>

          {quickLoginEnabled && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: COLORS.muted, fontSize: '13px' }}>
                <span style={{ flex: 1, height: '1px', background: COLORS.border }} />
                Acceso rápido de demostración
                <span style={{ flex: 1, height: '1px', background: COLORS.border }} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('teacher', authApi.quickLoginTeacher)}
                  style={secondaryButtonStyle}
                >
                  {pending === 'teacher' ? 'Entrando…' : 'Entrar como Docente'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('student', authApi.quickLoginStudent)}
                  style={secondaryButtonStyle}
                >
                  {pending === 'student' ? 'Entrando…' : 'Entrar como Alumno'}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate('/alumno/codigo')}
            style={{
              border: 0,
              background: 'none',
              padding: '4px 0',
              fontSize: '14px',
              fontWeight: 700,
              color: COLORS.primaryText,
              cursor: 'pointer',
            }}
          >
            ¿Eres alumno? Entra con el código de tu grupo →
          </button>

          {quickLoginEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('director', authApi.quickLoginTeacher, '/direccion/escuela')}
              style={{
                border: 0,
                background: 'none',
                minHeight: '44px',
                padding: '2px 0',
                fontSize: '13px',
                color: COLORS.muted,
                cursor: 'pointer',
              }}
            >
              Vista Dirección (Roadmap) →
            </button>
          )}
        </form>
      </div>

      <Toast message={toast} />
    </div>
  );
}
