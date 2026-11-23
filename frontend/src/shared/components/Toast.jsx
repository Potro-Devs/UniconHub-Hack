import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';

/**
 * Notificación temporal inferior centrada.
 */
export function Toast({ message, hasBottomNav = false }) {
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();

  if (!message) return null;

  const bottom = narrow && hasBottomNav ? '84px' : '24px';
  const animation = reducedMotion ? 'none' : 'rise .3s ease-out both';

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom,
        transform: 'translateX(-50%)',
        zIndex: 50,
        maxWidth: '90%',
        padding: '12px 18px',
        borderRadius: '14px',
        background: '#18203A',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 700,
        boxShadow: '0 8px 24px rgba(24,32,58,.25)',
        animation,
      }}
    >
      {message}
    </div>
  );
}
