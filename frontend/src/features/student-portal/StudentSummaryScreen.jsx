import { Link } from 'react-router-dom';
import { COLORS, LEVELS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { buttonStyle, mutedText } from '@/shared/styles/ui';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { pickFirstName } from './studentPortalStats';
import { StudentProgressState, studentCard, studentDate } from './StudentProgressState';
import { useStudentProgress } from './useStudentProgress';

/** Los niveles, porcentajes y tendencias llegan calculados por el servidor. */
export function StudentSummaryScreen() {
  const { session } = useSession();
  const { axiColor } = useAppUi();
  const request = useStudentProgress();
  return <div className="kid-page kid-collection student-real-data">
    <header className="student-progress-header">
      <div><h1>Mi progreso</h1><p style={mutedText}>{pickFirstName(session?.student?.displayName)}, cada paso forma parte de tu camino. Aquí puedes ver lo que has trabajado.</p><p style={mutedText}>El porcentaje principal muestra cómo avanzas al resolver sin pistas. Lo que logras con apoyo aparece aparte: pedir ayuda también es aprender.</p></div>
      <Mascot size={92} color={axiColor} mood="feliz" animated={false} />
    </header>
    <StudentProgressState request={request} />
    {request.status === 'ready' && <>
      {request.data.skills.length === 0 ? <section style={studentCard}>
        <h2>Un paso a la vez</h2><p style={mutedText}>Tu progreso aparecerá aquí cuando trabajes las habilidades de tu grupo.</p>
      </section> : <section aria-label="Mi progreso por habilidad" className="student-progress-grid">
        {request.data.skills.map((skill) => {
          const tone = LEVELS.find((level) => level.code === skill.level);
          return <article key={skill.code} style={studentCard}>
            <h2 style={{ fontSize: '22px' }}>{skill.name}</h2>
            <p style={{ margin: 0, padding: '10px 12px', borderRadius: '12px', fontWeight: 700, background: tone?.bg ?? COLORS.surfaceSubtle, color: tone?.fg ?? COLORS.muted }}>
              {skill.masteryPercentage == null ? 'Sin evaluar' : `${skill.masteryPercentage} % · ${skill.label}`}
            </p>
            {skill.masteryPercentage != null && <>
              <p style={{ ...mutedText, margin: 0 }}>Última sesión registrada{skill.grade ? ` · ${skill.grade}.º grado` : ''}</p>
              <div className="student-progress-details">
                {skill.autonomousPercentage != null && <p><strong>{skill.autonomousPercentage} %</strong> · Acierto autónomo</p>}
                {skill.supportedPercentage != null && <p><strong>{skill.supportedPercentage} %</strong> · Logrado con apoyo</p>}
              </div>
              <p style={{ ...mutedText, margin: 0 }}>{studentDate(skill.recordedAt)}</p>
            </>}
            {skill.autonomyTrend?.label && <p style={{ margin: 0, color: COLORS.primaryText, fontWeight: 700 }}>{skill.autonomyTrend.label}</p>}
          </article>;
        })}
      </section>}
    </>}
    <div className="student-real-actions"><Link to="/alumno/logros" style={buttonStyle('primary')}>Ver mis logros</Link><Link to="/alumno/inicio" style={buttonStyle('secondary')}>Volver al inicio</Link></div>
  </div>;
}
