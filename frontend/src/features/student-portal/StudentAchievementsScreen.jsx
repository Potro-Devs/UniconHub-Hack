import { Link } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { buttonStyle, mutedText } from '@/shared/styles/ui';
import { useAppUi } from '@/shared/state/AppUiContext';
import { StudentProgressState, studentCard, studentDate } from './StudentProgressState';
import { useStudentProgress } from './useStudentProgress';

const AXI_COLORS = [['rosa', 'Rosa'], ['azul', 'Azul'], ['amarillo', 'Amarillo'], ['lila', 'Lila']];
const ACHIEVEMENT_SIZES = {
  small: { label: 'Un paso más', mood: 'feliz', size: 60 },
  medium: { label: 'Tu avance', mood: 'feliz', size: 72 },
  large: { label: 'Un gran paso', mood: 'celebra', size: 84 },
};

/** Logros propios persistidos; consultar la colección no vuelve a disparar celebraciones. */
export function StudentAchievementsScreen() {
  const { axiColor, setAxiColor } = useAppUi();
  const request = useStudentProgress();
  return <div className="kid-page kid-collection student-real-data">
    <header><h1>Mis logros</h1><p style={mutedText}>Cada logro cuenta una parte de tu camino. Puedes volver a verlos aquí.</p></header>
    <StudentProgressState request={request} loadingText="Buscando tus logros…" />
    {request.status === 'ready' && <section aria-label="Mis logros obtenidos" className="student-progress-grid">
      {request.data.achievements.length === 0 ? <article style={studentCard}>
        <Mascot size={84} color={axiColor} mood="feliz" animated={false} />
        <h2>Tus próximos pasos irán apareciendo aquí</h2>
        <p style={mutedText}>Puedes empezar con una prueba de tu grupo. Pedir una pista también forma parte de aprender.</p>
        <Link to="/alumno/inicio" style={buttonStyle('primary')}>Ver mis actividades</Link>
      </article> : request.data.achievements.map((achievement) => {
        const size = ACHIEVEMENT_SIZES[achievement.size] ?? ACHIEVEMENT_SIZES.small;
        return <article key={achievement.id} style={studentCard} data-achievement-size={achievement.size}>
          <span style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: '999px', background: COLORS.primarySoftBg, color: COLORS.primarySoftFg, fontWeight: 700 }}>{size.label}</span>
          <Mascot size={size.size} mood={size.mood} color={axiColor} animated={false} />
          <h2 style={{ fontSize: '22px' }}>{achievement.title}</h2>
          {achievement.description && <p style={{ ...mutedText, margin: 0 }}>{achievement.description}</p>}
          <p style={{ ...mutedText, margin: 0 }}>Obtenido el {studentDate(achievement.awardedAt)}</p>
        </article>;
      })}
    </section>}
    <section style={studentCard} aria-labelledby="mascot-color-title">
      <h2 id="mascot-color-title" style={{ fontSize: '22px' }}>Elige el color de {APP_NAME}</h2>
      <p style={{ ...mutedText, margin: 0 }}>Una preferencia para acompañarte en tu espacio.</p>
      <div className="student-mascot-colors">{AXI_COLORS.map(([color, label]) => <button type="button" key={color} aria-pressed={axiColor === color} onClick={() => setAxiColor(color)} style={{ ...buttonStyle('secondary'), padding: '12px 8px', flexDirection: 'column', minHeight: '100px', border: `3px solid ${axiColor === color ? COLORS.primary : COLORS.border}` }}><Mascot size={62} color={color} animated={false} />{label}</button>)}</div>
    </section>
    <Link to="/alumno/resumen" style={{ ...buttonStyle('secondary'), alignSelf: 'flex-start' }}>Ver mi progreso</Link>
  </div>;
}
