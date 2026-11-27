import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { LanguageNotice, LanguageSwitch } from '@/shared/i18n/LanguageContext';
import { MotionToggle } from '@/shared/components/MotionToggle';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { Toast } from '@/shared/components/Toast';

import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { homePathFor, safeReturnPath } from '@/shared/state/session';
import { useSession } from '@/shared/state/SessionContext';
import { authApi } from './auth.api';

/**
 * Pantalla 00: Acceso docente, botones de acceso rápido demo (Docente, Directivo, Alumno) y entrada a portal alumno.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();

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

  return <div className="welcome-page">
    <header className="welcome-header"><span className="brand-link"><Mascot size={46} /><span className="font-display">{APP_NAME}</span></span><span className="header-tools"><LanguageSwitch /><MotionToggle /></span></header>
    <LanguageNotice className="lang-note--public" />
    <main className="welcome-grid">
      <section className="welcome-world" aria-labelledby="welcome-title">
        <span className="welcome-tag"><InterfaceIcon name="spark" size={18} /> Cada descubrimiento cuenta</span>
        <h1 id="welcome-title" className="font-display">Aprender es<br />una gran aventura.</h1>
        <p>Un lugar para descubrir lo que sabes,<br className="desktop-break" /> pedir ayuda y seguir creciendo.</p>
        <div className="welcome-mascot" aria-hidden="true"><span className="world-orbit orbit-one">✦</span><span className="world-orbit orbit-two">＋</span><span className="world-orbit orbit-three">●</span><Mascot size={200} animated={!reducedMotion} /></div>
        <div className="welcome-note"><InterfaceIcon name="star" /><span>A tu ritmo. Con una pista cuando la necesites.</span></div>
      </section>
      <div className="welcome-access">
        <section className="student-entry" aria-labelledby="student-entry-title">
          <span className="entry-icon"><InterfaceIcon name="spark" size={30} /></span>
          <div><h2 id="student-entry-title" className="font-display">¡Soy alumno!</h2><p>Tengo el código de mi grupo.</p></div>
          <button type="button" className="entry-button" onClick={() => navigate('/alumno/codigo')}>Entrar a aprender</button>
        </section>
        <form onSubmit={onSubmit} noValidate aria-busy={busy} className="teacher-login">
          <div className="login-heading"><span className="entry-icon teacher-icon"><InterfaceIcon name="book" size={26} /></span><div><h2 className="font-display">Mi espacio docente</h2><p>Conoce a tu grupo. Acompaña cada avance.</p></div></div>
          <label>Correo electrónico<input type="email" name="email" autoComplete="email" inputMode="email" placeholder="tu@escuela.mx" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} /></label>
          <label>Contraseña<input type="password" name="password" autoComplete="current-password" placeholder="Escribe tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} /></label>
          <FormMessage id="login-error" message={error} />
          <button type="submit" className="login-submit" disabled={busy}>{pending === 'login' ? 'Entrando…' : 'Entrar a mi grupo'}</button>
          {quickLoginEnabled && <div className="demo-access"><span>Explora la demostración</span><div><button type="button" disabled={busy} onClick={() => run('teacher', authApi.quickLoginTeacher)}>{pending === 'teacher' ? 'Entrando…' : 'Entrar como Docente'}</button><button type="button" disabled={busy} onClick={() => run('director', authApi.quickLoginDirector)}>{pending === 'director' ? 'Entrando…' : 'Entrar como Directivo'}</button><button type="button" disabled={busy} onClick={() => run('student', authApi.quickLoginStudent)}>{pending === 'student' ? 'Entrando…' : 'Entrar como Alumno'}</button></div></div>}
        </form>
        <p className="welcome-privacy">Un espacio seguro para aprender, sin prisas ni comparaciones.</p>
      </div>
    </main>
    <Toast message={toast} />
  </div>;
}