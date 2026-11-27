import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { apiClient, errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, mutedText } from '@/shared/styles/ui';
import { useSession } from '@/shared/state/SessionContext';
import { studentCard } from './StudentProgressState';

/** Un único grupo real. /me completa docente y código desde el primer acceso rápido. */
export function StudentClassesScreen() {
  const { session } = useSession();
  const studentId = session?.student?.id;
  const token = session?.token;
  const key = `${studentId ?? ''}:${token ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', group: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ key, status: 'loading', group: null, error: null });
    apiClient.get('/auth/me', { signal: controller.signal })
      .then((profile) => { if (!cancelled) setState({ key, status: 'ready', group: profile.student?.id === studentId ? profile.group : null, error: null }); })
      .catch((error) => { if (!cancelled && error?.name !== 'AbortError') setState({ key, status: 'error', group: null, error }); });
    return () => { cancelled = true; controller.abort(); };
  }, [key, studentId, attempt]);
  const current = state.key === key ? state : { status: 'loading', group: null };
  const group = current.group;
  return <div className="kid-page kid-collection student-real-data">
    <header><h1>Mis clases</h1><p style={mutedText}>Este es tu grupo. Tu docente te acompaña en las actividades.</p></header>
    {current.status === 'loading' && <p role="status" style={mutedText}>Buscando tu grupo…</p>}
    {current.status === 'error' && <div role="alert" style={alertBox}><p style={{ margin: 0 }}>{errorMessageOf(current.error)}</p><button type="button" style={buttonStyle('secondary')} onClick={() => setAttempt((value) => value + 1)}>Volver a intentar</button></div>}
    {current.status === 'ready' && (group ? <article style={{ ...studentCard, maxWidth: '620px' }}>
      <span style={{ color: COLORS.primaryText, fontWeight: 700 }}>{group.grade}.º grado</span>
      <h2>{group.name}</h2>
      <p style={{ ...mutedText, margin: 0 }}>Docente: <strong>{group.teacherName || 'Docente por confirmar'}</strong></p>
      <p style={{ ...mutedText, margin: 0 }}>Código del grupo: <strong style={{ color: COLORS.ink, letterSpacing: '.12em' }}>{group.joinCode || 'Por confirmar'}</strong></p>
      {group.schoolYear && <p style={{ ...mutedText, margin: 0 }}>Ciclo {group.schoolYear}</p>}
      <Link to="/alumno/inicio" style={buttonStyle('primary')}>Ver mis actividades</Link>
    </article> : <section style={studentCard}><h2>Tu grupo no está disponible</h2><p style={mutedText}>Pide a tu docente que revise tu acceso al grupo.</p></section>)}
  </div>;
}
