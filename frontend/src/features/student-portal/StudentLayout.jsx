import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { MotionToggle } from '@/shared/components/MotionToggle';
import { Toast } from '@/shared/components/Toast';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';

export function StudentLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { axiColor, sound, setSound, toast } = useAppUi();
  const { session } = useSession();
  const joining = pathname === '/alumno/codigo' || pathname === '/alumno/nombre';
  return <div className="student-stage">
    <a className="skip-link" href="#activity-content">Ir a la actividad</a>
    <header className="activity-header">
      <button type="button" className="brand-link" onClick={() => navigate(session?.role === 'student' ? '/alumno/inicio' : '/login')}><Mascot size={46} color={axiColor} /><span className="font-display">{APP_NAME}</span></button>
      {!joining && <button type="button" className="quiet-button" onClick={() => navigate('/alumno/inicio')}>Volver a inicio</button>}
      <MotionToggle />
      {!joining && <button type="button" className="quiet-button" aria-pressed={sound} onClick={() => setSound((value) => !value)}>{sound ? 'Sonido: sí' : 'Sonido: no'}</button>}
    </header>
    <main id="activity-content" className="activity-content" tabIndex={-1}><Outlet /></main>
    <Toast message={toast} />
  </div>;
}
