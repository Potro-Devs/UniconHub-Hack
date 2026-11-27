import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { BiText, LanguageNotice, LanguageSwitch } from '@/shared/i18n/LanguageContext';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { MotionToggle } from '@/shared/components/MotionToggle';
import { Toast } from '@/shared/components/Toast';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { initialsOf } from '@/shared/state/session';
import './student-real-data.css';

const destinations = [
  { path: '/alumno/inicio', name: 'Inicio', icon: 'home' },
  { path: '/alumno/clases', name: 'Clases', icon: 'book' },
  { path: '/alumno/juegos', name: 'Juegos', icon: 'games' },
  { path: '/alumno/resumen', name: 'Mi progreso', icon: 'map' },
  { path: '/alumno/logros', name: 'Logros', icon: 'star' },
];

export function StudentShellLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, signOut } = useSession();
  const { axiColor, toast, resetStudentSession, setJoinRoster } = useAppUi();
  const initials = initialsOf(session?.student?.displayName);
  const leave = () => {
    signOut(); resetStudentSession(); setJoinRoster(null); navigate('/login', { replace: true });
  };
  return <div className="student-shell">
    <a className="skip-link" href="#student-content">Ir a mis actividades</a>
    <header className="student-header">
      <button className="brand-link" type="button" onClick={() => navigate('/alumno/inicio')} aria-label={`${APP_NAME}, inicio`}><Mascot size={48} color={axiColor} /><span className="font-display">{APP_NAME}</span></button>
      <nav className="student-nav" aria-label="Mi espacio">{destinations.map((item) => <button key={item.path} type="button" aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? 'page' : undefined} onClick={() => navigate(item.path)}><InterfaceIcon name={item.icon} /><BiText k={`nav.${item.path.split('/').pop()}`} compact>{item.name}</BiText></button>)}</nav>
      <div className="student-account">
        <LanguageSwitch />
        {initials && <span className="student-account__initials" aria-label="Iniciales del alumno">{initials}</span>}
        <button type="button" className="quiet-button" onClick={leave}><BiText k="common.exit">Salir</BiText></button>
      </div>
    </header>
    <div className="student-utility"><span>{session?.group?.name || 'Mi espacio para aprender'}</span><LanguageNotice /><MotionToggle /></div>
    <main id="student-content" className="student-content" tabIndex={-1}><Outlet /></main>
    <footer className="student-footer">Un paso a la vez. A tu ritmo.</footer>
    <Toast message={toast} />
  </div>;
}
