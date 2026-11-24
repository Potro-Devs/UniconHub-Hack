import { useEffect, useState } from 'react';
import { analyticsApi } from './analytics.api';

/** Abort and discard old requests when the active group or student changes. */
export function useAnalytics(groupId, studentId) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  const key = `${groupId ?? ''}:${studentId ?? ''}`;
  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    let cancelled = false;
    setState({ key, status: 'loading', data: null });
    const request = studentId === undefined
      ? analyticsApi.group(groupId, { signal: controller.signal })
      : analyticsApi.student(groupId, studentId, { signal: controller.signal });
    request.then((data) => {
      if (!cancelled) setState({ key, status: 'ready', data });
    }).catch((error) => {
      if (!cancelled) setState({ key, status: 'error', data: null, error });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [groupId, studentId, key, attempt]);
  return {
    ...(state.key === key ? state : { status: 'loading', data: null }),
    retry: () => setAttempt((value) => value + 1),
  };
}
