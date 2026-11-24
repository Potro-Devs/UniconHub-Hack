import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { MotionToggle } from '@/shared/components/MotionToggle';
import { Toast } from '@/shared/components/Toast';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';

const destinations = [
  { path: '/alumno/inicio', name: 'Inicio', icon: 'home' },
  { path: '/alumno/clases', name: 'Mis actividades', icon: 'book' },
  { path: '/alumno/logros', name: 'Mis logros', icon: 'star' },
];

export function StudentShellLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, signOut } = useSession();
  const { axiColor, toast, resetStudentSession, setJoinRoster } = useAppUi();
  const leave = () => {
    signOut(); resetStudentSession(0); setJoinRoster(null); navigate('/login', { replace: true });
  };
  return <div className="student-shell">
    <a className="skip-link" href="#student-content">Ir a mis actividades</a>
    <header className="student-header">
      <button className="brand-link" type="button" onClick={() => navigate('/alumno/inicio')} aria-label={`${APP_NAME}, inicio`}><Mascot size={48} color={axiColor} /><span className="font-display">{APP_NAME}</span></button>
      <nav className="student-nav" aria-label="Mi espacio">{destinations.map((item) => <button key={item.path} type="button" aria-current={pathname === item.path ? 'page' : undefined} onClick={() => navigate(item.path)}><InterfaceIcon name={item.icon} /><span>{item.name}</span></button>)}</nav>
      <button type="button" className="quiet-button" onClick={leave}>Salir</button>
    </header>
    <div className="student-utility"><span>{session?.group?.name || 'Mi espacio para aprender'}</span><MotionToggle /></div>
    <main id="student-content" className="student-content" tabIndex={-1}><Outlet /></main>
    <footer className="student-footer">Un paso a la vez. A tu ritmo.</footer>
    <Toast message={toast} />
  </div>;
}
