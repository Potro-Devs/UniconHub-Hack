import { useEffect, useState } from 'react';
import { schoolAnalyticsApi } from './schoolAnalytics.api';

/** Carga `GET /analytics/school` (panel y docentes de Dirección) con reintento y cancelación. */
export function useSchoolAnalytics() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    schoolAnalyticsApi.school({ signal: controller.signal })
      .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
      .catch((error) => !cancelled && setState({ status: 'error', data: null, error }));
    return () => { cancelled = true; controller.abort(); };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
