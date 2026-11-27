import { useCallback, useEffect, useRef, useState } from 'react';
import { groupsApi } from '@/features/groups/groups.api';
import { ApiError } from '@/shared/api/client';
import { isPaperAssignmentForGroup } from './paper-mode.logic';
import { paperApi } from './paper.api';

export function usePaperAssignment(groupId, assignmentId) {
  const [request, setRequest] = useState({ status: 'loading', assignment: null, captureStatus: null, students: [], error: null, refreshError: null });
  const generation = useRef(0);
  const refreshVersion = useRef(0);
  const alive = useRef(false);

  const reload = useCallback(async (signal) => {
    const version = ++generation.current;
    setRequest((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const assignment = await paperApi.getAssignment(assignmentId, { signal });
      if (!isPaperAssignmentForGroup(assignment, groupId)) throw new ApiError({ status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Esta prueba no es una hoja en papel del grupo seleccionado.' });
      const [captureStatus, students] = await Promise.all([
        paperApi.getCaptureStatus(assignmentId, { signal }), groupsApi.listStudents(groupId),
      ]);
      if (!alive.current || version !== generation.current) return;
      setRequest({ status: 'ready', assignment, captureStatus, students, error: null, refreshError: null });
    } catch (error) {
      if (!alive.current || version !== generation.current || error.name === 'AbortError') return;
      setRequest((current) => ({ ...current, status: 'error', error }));
    }
  }, [groupId, assignmentId]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    reload(controller.signal);
    return () => { alive.current = false; ++generation.current; ++refreshVersion.current; controller.abort(); };
  }, [reload]);

  const refreshStatus = useCallback(async () => {
    const version = ++refreshVersion.current;
    const currentGeneration = generation.current;
    try {
      const captureStatus = await paperApi.getCaptureStatus(assignmentId);
      if (alive.current && version === refreshVersion.current && currentGeneration === generation.current) {
        setRequest((current) => ({ ...current, captureStatus, refreshError: null }));
      }
      return captureStatus;
    } catch (error) {
      if (alive.current && version === refreshVersion.current && currentGeneration === generation.current) {
        setRequest((current) => ({ ...current, refreshError: error }));
      }
      throw error;
    }
  }, [assignmentId]);

  return { ...request, reload: () => reload(), refreshStatus };
}
