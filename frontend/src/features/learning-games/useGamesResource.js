import { useEffect, useState } from 'react';
import { gamesApi } from './games.api';

/** Only current authenticated requests may update the screen. */
export function useGamesResource(code) {
  const key = code ?? 'catalog';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ key, status: 'loading', data: null });
    const promise = code === undefined ? gamesApi.list({ signal: controller.signal }) : gamesApi.game(code, { signal: controller.signal });
    promise.then((data) => { if (current) setState({ key, status: 'ready', data }); })
      .catch((error) => { if (current && error?.name !== 'AbortError') setState({ key, status: 'error', error, data: null }); });
    return () => { current = false; controller.abort(); };
  }, [code, key, attempt]);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry: () => setAttempt((value) => value + 1) };
}
