import { useNavigate } from 'react-router-dom';
import { Mascot } from '@/features/mascot';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { getEarnedAchievements, getQuizItems, pickFirstName } from './studentPortalStats';

const skillSymbols = { fractions: '◒', multiplication: '×', place_value: '123', problem_solving: '✦', reading_comprehension: 'Aa' };

/** A single next step, followed by the child's own learning journey. */
export function StudentHomeScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { axiColor, completedQuizzes, startStudentQuiz } = useAppUi();
  const quizzes = getQuizItems(completedQuizzes);
  const pending = quizzes.filter((quiz) => quiz.resolvedStatus === 'pending_screen');
  const next = pending[0];
  const completed = quizzes.filter((quiz) => quiz.resolvedStatus === 'completed_screen');
  const earnedCount = getEarnedAchievements(completedQuizzes).length;
  const launch = (id) => { if (startStudentQuiz(id)) navigate('/alumno/ejercicio'); };
  return <div className="kid-page">
    <header className="kid-greeting"><div><p className="kid-eyebrow">TU ESPACIO PARA DESCUBRIR</p><h1>¡Hola, {pickFirstName(session?.student?.displayName, 'amiga o amigo')}!</h1><p>Hoy puedes aprender algo nuevo. A tu ritmo.</p></div><span className="kid-sun" aria-hidden="true">✦</span></header>
    <section className="kid-mission" aria-labelledby="kid-mission-title">
      <div className="kid-mission-copy"><span className="kid-tag">{next ? 'TU SIGUIENTE AVENTURA' : '¡LO HICISTE!'}</span><h2 id="kid-mission-title">{next ? next.heroTitle || next.title : 'Un paso más en tu camino'}</h2><p>{next ? `${next.questionCount} preguntas para explorar. Si necesitas ayuda, pide una pista.` : 'Terminaste tus actividades en pantalla. Puedes explorar tus logros.'}</p><button className="kid-button kid-button-primary" type="button" onClick={() => next ? launch(next.id) : navigate('/alumno/logros')}>{next ? '¡Vamos a comenzar!' : 'Ver mis logros'}<span aria-hidden="true">✦</span></button><span className="kid-reassurance">Sin prisa. Pedir ayuda también es aprender.</span></div>
      <div className="kid-mascot-island" aria-hidden="true"><span className="kid-island-spark kid-island-spark-one">✦</span><Mascot size={200} color={axiColor} mood="feliz" animated={false}/><span className="kid-island-spark kid-island-spark-two">✧</span><div className="kid-island-ground" /></div>
    </section>
    <div className="kid-journey"><div className="kid-journey-symbol" aria-hidden="true">✿</div><div><h2>Tu camino de descubrimientos</h2><p>{completed.length} actividades en pantalla completadas · {earnedCount} sellos de esfuerzo</p></div><button className="kid-button kid-button-small" type="button" onClick={() => navigate('/alumno/logros')}>Mis logros</button></div>
    <section className="kid-section" aria-labelledby="kid-backpack"><div className="kid-section-heading"><h2 id="kid-backpack">En tu mochila</h2><span>{quizzes.length - (next ? 1 : 0)} actividades</span></div><div className="kid-activity-grid">
      {quizzes.filter((quiz) => quiz.id !== next?.id).map((quiz) => {
        const ready = quiz.resolvedStatus === 'pending_screen';
        const paper = quiz.resolvedStatus === 'completed_paper';
        return <article className={`kid-activity ${ready ? 'kid-activity-ready' : ''}`} key={quiz.id}><div className={`kid-subject-symbol kid-subject-${quiz.skillId}`} aria-hidden="true">{skillSymbols[quiz.skillId] || '✦'}</div><span className="kid-status">{ready ? 'Para explorar' : paper ? 'En papel con tu docente' : '✓ Actividad completada'}</span><h3>{quiz.title}</h3><p>{ready ? `${quiz.questionCount} preguntas · Pistas disponibles` : paper ? 'Esta actividad se hace en tu hoja. Tu docente te acompaña.' : 'Cada intento forma parte de lo que aprendes.'}</p>{!ready && !paper && quiz.scorePct != null && quiz.level && <p className="kid-result">{quiz.scorePct}% · {quiz.level.label}{quiz.completion?.withSupportCount > 0 && <span>Logrado con apoyo: {quiz.completion.withSupportCount} respuestas</span>}</p>}{ready && <button type="button" className="kid-button" onClick={() => launch(quiz.id)}>Comenzar</button>}</article>;
      })}
    </div></section>
    <aside className="kid-help-note"><span aria-hidden="true">☀</span><p><strong>Aquí puedes intentarlo.</strong> Lee, piensa y pide una pista cuando la necesites.</p></aside>
  </div>;
}
