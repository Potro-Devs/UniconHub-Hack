import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/shared/state/SessionContext';
import { groupsApi } from './groups.api';
import {
  draftsForUser,
  emptyDrafts,
  getDraft,
  pickActiveGroup,
  readStoredActiveGroupId,
  setDraft,
  writeStoredActiveGroupId,
} from './groups.logic';

const TeacherGroupsContext = createContext(null);

const getLocalStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Grupos de la sesión docente (`GET /groups`), cargados una vez por sesión.
 * Se monta dentro de las rutas protegidas: al cerrar sesión se desmonta y el estado
 * en memoria desaparece. El grupo activo es una preferencia del dispositivo (`localStorage`).
 */
export function TeacherGroupsProvider({ children }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [status, setStatus] = useState('loading');
  const [groups, setGroups] = useState([]);
  const [storedId, setStoredId] = useState(() => readStoredActiveGroupId(getLocalStorage(), userId));
  const requestRef = useRef(0);
  // Borradores de la lista pegada (nombres de menores): solo en memoria, uno por grupo y
  // por docente. Se pierden al cerrar sesión porque este proveedor se desmonta.
  const [drafts, setDrafts] = useState(() => emptyDrafts(userId));

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    try {
      const data = await groupsApi.list();
      if (requestId !== requestRef.current) return data;
      setGroups(Array.isArray(data) ? data : []);
      setStatus('ready');
      return data;
    } catch (error) {
      if (requestId === requestRef.current) setStatus('error');
      throw error;
    }
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    setGroups([]);
    setStatus('loading');
    setStoredId(readStoredActiveGroupId(getLocalStorage(), userId));
    setDrafts((prev) => draftsForUser(prev, userId));
    if (userId == null) return;
    reload().catch(() => {});
  }, [userId, reload]);

  const activeGroup = useMemo(() => pickActiveGroup(groups, storedId), [groups, storedId]);

  const setActiveGroupId = useCallback(
    (groupId) => {
      setStoredId(groupId == null ? null : String(groupId));
      writeStoredActiveGroupId(getLocalStorage(), userId, groupId);
    },
    [userId],
  );

  /** Inserta o reemplaza un grupo devuelto por la API sin esperar a recargar la lista. */
  const upsertGroup = useCallback((group) => {
    if (!group?.id) return;
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === group.id);
      if (idx === -1) return [...prev, group];
      const next = [...prev];
      next[idx] = group;
      return next;
    });
  }, []);

  const draftFor = useCallback((groupId) => getDraft(drafts, groupId), [drafts]);
  const setDraftFor = useCallback((groupId, text) => setDrafts((prev) => setDraft(prev, groupId, text)), []);

  const value = useMemo(
    () => ({ status, groups, activeGroup, setActiveGroupId, reload, retry, upsertGroup, draftFor, setDraftFor }),
    [status, groups, activeGroup, setActiveGroupId, reload, retry, upsertGroup, draftFor, setDraftFor],
  );

  return <TeacherGroupsContext.Provider value={value}>{children}</TeacherGroupsContext.Provider>;
}

export function useTeacherGroups() {
  const ctx = useContext(TeacherGroupsContext);
  if (!ctx) throw new Error('useTeacherGroups debe utilizarse dentro de TeacherGroupsProvider');
  return ctx;
}
