import { useNavigate } from 'react-router-dom';
import { BiText } from '@/shared/i18n/LanguageContext';
import { Mascot } from '@/features/mascot';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { assignmentState } from './diagnostics.api';
import { pickFirstName } from './studentPortalStats';
import { useStudentAssignments } from './useStudentAssignments';

const skillSymbols = { fractions: '◒', multiplication: '×', place_value: '123', problem_solving: '✦', reading_comprehension: 'Aa' };

/** Un siguiente paso claro (la primera actividad disponible en pantalla) y el camino del alumno. Datos reales. */
export function StudentHomeScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { axiColor } = useAppUi();
  const assignments = useStudentAssignments(session?.student?.id);
  const items = assignments.data.map((a) => ({ ...a, state: assignmentState(a) }));
  const next = items.find((a) => a.state === 'ready');
  const completed = items.filter((a) => a.state === 'completed');
  const launch = (id) => navigate(`/alumno/ejercicio/${id}`);
  const loading = assignments.status === 'loading';

  return <div className="kid-page">
    <header className="kid-greeting"><div><p className="kid-eyebrow">TU ESPACIO PARA DESCUBRIR</p><h1>¡<BiText k="common.hello">Hola</BiText>, {pickFirstName(session?.student?.displayName, 'amiga o amigo')}!</h1><p>Hoy puedes aprender algo nuevo. A tu ritmo.</p></div><span className="kid-sun" aria-hidden="true">✦</span></header>
    <section className="kid-mission" aria-labelledby="kid-mission-title" aria-busy={loading}>
      <div className="kid-mission-copy">
        <span className="kid-tag">{loading ? 'UN MOMENTO' : next ? 'TU SIGUIENTE AVENTURA' : '¡LO HICISTE!'}</span>
        <h2 id="kid-mission-title">{loading ? 'Buscando tus actividades…' : next ? next.title : 'Un paso más en tu camino'}</h2>
        {assignments.status === 'error'
          ? <p role="alert">No pudimos cargar tus actividades. <button type="button" className="kid-button kid-button-small" onClick={assignments.retry}>Intentar de nuevo</button></p>
          : <p>{next ? `${next.questionCount} preguntas para explorar${next.answeredCount ? ` (llevas ${next.answeredCount})` : ''}. Si necesitas ayuda, pide una pista.` : loading ? '' : 'No tienes actividades en pantalla por ahora. Puedes practicar con los juegos.'}</p>}
        {!loading && <button className="kid-button kid-button-primary" type="button" onClick={() => next ? launch(next.id) : navigate('/alumno/juegos')}>{next ? (next.answeredCount ? 'Continuar' : '¡Vamos a comenzar!') : 'Explorar juegos'}<span aria-hidden="true">✦</span></button>}
        <span className="kid-reassurance">Sin prisa. Pedir ayuda también es aprender.</span>
      </div>
      <div className="kid-mascot-island" aria-hidden="true"><span className="kid-island-spark kid-island-spark-one">✦</span><Mascot size={200} color={axiColor} mood="feliz" animated={false}/><span className="kid-island-spark kid-island-spark-two">✧</span><div className="kid-island-ground" /></div>
    </section>
    <div className="kid-journey"><div className="kid-journey-symbol" aria-hidden="true">✿</div><div><h2>Tu camino de descubrimientos</h2><p>{completed.length} {completed.length === 1 ? 'actividad completada' : 'actividades completadas'} en pantalla</p></div><button className="kid-button kid-button-small" type="button" onClick={() => navigate('/alumno/logros')}>Mis logros</button></div>
    <section className="kid-play-invitation" aria-labelledby="play-invitation-title">
      <span className="kid-play-symbol" aria-hidden="true"><InterfaceIcon name="games" size={38} /></span>
      <div><span className="kid-eyebrow">APRENDER CON LAS MANOS</span><h2 id="play-invitation-title">¿Y si lo descubrimos jugando?</h2><p>Pinta partes, forma grupos y construye números. Es práctica libre.</p></div>
      <button type="button" className="kid-button" onClick={() => navigate('/alumno/juegos')}>Explorar juegos</button>
    </section>
    <section className="kid-section" aria-labelledby="kid-backpack"><div className="kid-section-heading"><h2 id="kid-backpack">En tu mochila</h2><span>{Math.max(0, items.length - (next ? 1 : 0))} actividades</span></div><div className="kid-activity-grid">
      {items.filter((a) => a.id !== next?.id).map((a) => {
        const skill = a.skills?.[0]?.code;
        const ready = a.state === 'ready';
        const paper = a.state === 'paper';
        const status = ready ? 'Para explorar' : paper ? 'En papel con tu docente' : a.state === 'closed' ? 'Ya cerró' : '✓ Actividad completada';
        const text = ready ? `${a.questionCount} preguntas · Pistas disponibles`
          : paper ? 'Esta actividad se hace en tu hoja. Tu docente te acompaña.'
            : a.state === 'closed' ? 'Pregúntale a tu docente cuál sigue.' : 'Cada intento forma parte de lo que aprendes.';
        return <article className={`kid-activity ${ready ? 'kid-activity-ready' : ''}`} key={a.id}>
          <div className={`kid-subject-symbol kid-subject-${skill}`} aria-hidden="true">{skillSymbols[skill] || '✦'}</div>
          <span className="kid-status">{status}</span><h3>{a.title}</h3><p>{text}</p>
          {ready && <button type="button" className="kid-button" onClick={() => launch(a.id)}>Comenzar</button>}
        </article>;
      })}
    </div></section>
    <aside className="kid-help-note"><span aria-hidden="true">☀</span><p><strong>Aquí puedes intentarlo.</strong> Lee, piensa y pide una pista cuando la necesites.</p></aside>
  </div>;
}
