import { useCallback, useEffect, useRef, useState } from 'react';
import { curriculumApi } from './curriculum.api';

export function useCurriculum(groupId) {
  const [request, setRequest] = useState({ status: 'loading', contents: [], coverage: null, error: null, coverageError: null });
  const [pending, setPending] = useState([]);
  const [errors, setErrors] = useState({});
  const mounted = useRef(false);
  const groupVersion = useRef(0);
  const loadVersion = useRef(0);
  const coverageVersion = useRef(0);
  const pendingRef = useRef(new Set());
  const contentsRef = useRef(request.contents);
  contentsRef.current = request.contents;

  const reload = useCallback(async (signal) => {
    const version = ++loadVersion.current;
    setRequest((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const [contents, coverage] = await Promise.all([
        curriculumApi.list(groupId, { signal }), curriculumApi.coverage(groupId, { signal }),
      ]);
      if (!mounted.current || version !== loadVersion.current) return;
      setRequest({ status: 'ready', contents, coverage, error: null, coverageError: null });
    } catch (error) {
      if (!mounted.current || version !== loadVersion.current || error.name === 'AbortError') return;
      setRequest((current) => ({ ...current, status: 'error', error }));
    }
  }, [groupId]);

  useEffect(() => {
    mounted.current = true;
    ++groupVersion.current;
    pendingRef.current = new Set();
    setPending([]);
    setErrors({});
    const controller = new AbortController();
    reload(controller.signal);
    return () => { mounted.current = false; ++groupVersion.current; ++loadVersion.current; ++coverageVersion.current; controller.abort(); };
  }, [reload]);

  const refreshCoverage = useCallback(async () => {
    const version = ++coverageVersion.current;
    try {
      const coverage = await curriculumApi.coverage(groupId);
      if (mounted.current && version === coverageVersion.current) setRequest((current) => ({ ...current, coverage, coverageError: null }));
    } catch (error) {
      if (mounted.current && version === coverageVersion.current) setRequest((current) => ({ ...current, coverageError: error }));
    }
  }, [groupId]);

  const updateContent = useCallback(async (contentId, patch) => {
    if (pendingRef.current.has(contentId)) return null;
    const previous = contentsRef.current.find((content) => content.id === contentId);
    if (!previous) return null;
    const generation = groupVersion.current;
    const pendingSet = pendingRef.current;
    pendingSet.add(contentId);
    setPending([...pendingRef.current]);
    setErrors((current) => ({ ...current, [contentId]: null }));
    setRequest((current) => ({ ...current, contents: current.contents.map((content) => content.id === contentId ? { ...content, ...patch } : content) }));
    try {
      const saved = await curriculumApi.updateContent(groupId, contentId, patch);
      if (!mounted.current || generation !== groupVersion.current) return saved;
      setRequest((current) => ({ ...current, contents: current.contents.map((content) => content.id === contentId ? saved : content) }));
      await refreshCoverage();
      return saved;
    } catch (error) {
      if (mounted.current && generation === groupVersion.current) {
        setRequest((current) => ({ ...current, contents: current.contents.map((content) => content.id === contentId ? previous : content) }));
        setErrors((current) => ({ ...current, [contentId]: error }));
      }
      throw error;
    } finally {
      pendingSet.delete(contentId);
      if (mounted.current && generation === groupVersion.current) setPending([...pendingRef.current]);
    }
  }, [groupId, refreshCoverage]);

  return { ...request, pending, errors, reload: () => reload(), refreshCoverage, updateContent };
}
