import { useCallback, useEffect, useState } from 'react';
import { interventionsApi } from './interventions.api';

/** Lista del ciclo de acompañamiento de un grupo; descarta respuestas de un grupo anterior. */
export function useInterventions(groupId) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  const key = String(groupId ?? '');
  useEffect(() => {
    if (!groupId) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setState({ key, status: 'loading', data: null });
    interventionsApi.list(groupId, { signal: controller.signal })
      .then((data) => { if (!cancelled) setState({ key, status: 'ready', data }); })
      .catch((error) => { if (!cancelled) setState({ key, status: 'error', data: null, error }); });
    return () => { cancelled = true; controller.abort(); };
  }, [groupId, key, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry };
}
