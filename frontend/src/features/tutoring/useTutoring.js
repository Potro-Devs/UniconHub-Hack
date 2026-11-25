import { useCallback, useEffect, useState } from 'react';

/** Petición cancelable; descarta respuestas de una llave anterior (otro grupo u otra habilidad). */
export function useRequest(key, load) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    // Al reintentar la misma llave se conservan los datos visibles mientras llega la respuesta.
    setState((previous) => previous.key === key && previous.data ? previous : { key, status: 'loading', data: null });
    load({ signal: controller.signal })
      .then((data) => { if (!cancelled) setState({ key, status: 'ready', data }); })
      .catch((error) => { if (!cancelled && error?.name !== 'AbortError') setState({ key, status: 'error', data: null, error }); });
    return () => { cancelled = true; controller.abort(); };
    // `load` cambia en cada render; la llave identifica la petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry };
}
