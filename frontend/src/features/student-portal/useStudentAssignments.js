import { useEffect, useState } from 'react';
import { diagnosticsApi } from './diagnostics.api';

/** Pruebas asignadas al alumno de la sesión (`GET /diagnostics/students/:id/assignments`). */
export function useStudentAssignments(studentId) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: [], error: null });
  useEffect(() => {
    if (!studentId) {
      setState({ status: 'ready', data: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    diagnosticsApi.listAssignments(studentId, { signal: controller.signal })
      .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
      .catch((error) => !cancelled && error?.name !== 'AbortError' && setState({ status: 'error', data: [], error }));
    return () => { cancelled = true; controller.abort(); };
  }, [studentId, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
