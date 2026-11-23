import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiClient, configureApiAuth } from '@/shared/api/client';
import {
  isSessionValid,
  mergeMe,
  readStoredSession,
  toSession,
  writeStoredSession,
} from './session';

const SessionContext = createContext(null);

const getStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Sesión autenticada (docente, director o alumno). Al cargar, valida la sesión guardada
 * con `GET /auth/me`; si el servidor la rechaza, se cierra.
 */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession(getStorage()));
  const [verifying, setVerifying] = useState(() => readStoredSession(getStorage()) != null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const signOut = useCallback(() => {
    writeStoredSession(getStorage(), null);
    setSession(null);
  }, []);

  const signIn = useCallback((data) => {
    const next = toSession(data);
    writeStoredSession(getStorage(), next);
    setSession(next);
    return next;
  }, []);

  // El cliente HTTP usa el token vigente y cierra la sesión si el servidor responde 401.
  useEffect(() => {
    configureApiAuth({ getToken: () => sessionRef.current?.token ?? null, onUnauthorized: signOut });
  }, [signOut]);

  // Valida la sesión guardada una vez al iniciar.
  useEffect(() => {
    if (!sessionRef.current) return undefined;
    let cancelled = false;
    apiClient
      .get('/auth/me')
      .then((me) => {
        if (cancelled) return;
        setSession((prev) => {
          const next = mergeMe(prev, me);
          writeStoredSession(getStorage(), next);
          return next;
        });
      })
      .catch((error) => {
        // Sin conexión se conserva la sesión local; un 401 ya la cerró vía onUnauthorized.
        if (!(error instanceof ApiError)) console.error(error);
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cierra la sesión cuando expira el token.
  useEffect(() => {
    if (!session) return undefined;
    if (!isSessionValid(session)) {
      signOut();
      return undefined;
    }
    const ms = Math.min(Date.parse(session.expiresAt) - Date.now(), 2 ** 31 - 1);
    const timer = setTimeout(signOut, ms);
    return () => clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo(() => ({ session, verifying, signIn, signOut }), [session, verifying, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe utilizarse dentro de SessionProvider');
  return ctx;
}
