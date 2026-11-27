import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/shared/state/SessionContext';
import { diagnosticsApi } from './diagnostics.api';

const emptyProgress = () => ({ grade: null, skills: [], achievements: [] });

/** Progreso propio, recargado al entrar; nunca conserva datos de otra sesión. */
export function useStudentProgress() {
  const { session } = useSession();
  const studentId = session?.student?.id;
  const token = session?.token;
  const key = `${studentId ?? ''}:${token ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: emptyProgress(), error: null });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState({ key, status: studentId && token ? 'loading' : 'ready', data: emptyProgress(), error: null });
    if (studentId && token) {
      diagnosticsApi.progress(studentId, { signal: controller.signal })
        .then((data) => { if (!cancelled) setState({ key, status: 'ready', data, error: null }); })
        .catch((error) => { if (!cancelled && error?.name !== 'AbortError') setState({ key, status: 'error', data: emptyProgress(), error }); });
    }
    return () => { cancelled = true; controller.abort(); };
  }, [key, studentId, token, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...(state.key === key ? state : { status: 'loading', data: emptyProgress(), error: null }), retry };
}
