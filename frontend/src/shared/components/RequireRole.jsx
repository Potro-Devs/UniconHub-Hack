import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { homePathFor } from '@/shared/state/session';
import { useSession } from '@/shared/state/SessionContext';

/**
 * Protege un grupo de rutas: sin sesión redirige a `redirectTo`; con otro rol, a su inicio.
 *
 * @param {{ roles: string[], redirectTo: string, children?: import('react').ReactNode }} props
 */
export function RequireRole({ roles, redirectTo, children }) {
  const { session, verifying } = useSession();
  const location = useLocation();

  if (verifying) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.bg,
          color: COLORS.muted,
          fontSize: '16px',
        }}
      >
        Cargando tu sesión…
      </div>
    );
  }

  if (!session) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(session.role)) {
    return <Navigate to={homePathFor(session)} replace />;
  }
  return children ?? <Outlet />;
}
