import { errorMessageOf } from '@/shared/api/client';
import { useAppUi } from '@/shared/state/AppUiContext';
import { buttonStyle } from '@/shared/styles/ui';
import { plural } from './SchoolDashboardScreen';
import { useSchoolAnalytics } from './useSchoolAnalytics';
import './school-dashboard.css';

/**
 * Docentes de la escuela (Dirección): datos reales del ciclo actual (`GET /analytics/school`).
 * Solo agregados por docente; sin correos ni datos de alumnos. El alta de docentes sigue en el Roadmap.
 */
export function SchoolTeachersScreen() {
  const { say } = useAppUi();
  const request = useSchoolAnalytics();

  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando docentes…</p>;
  if (request.status === 'error') {
    return (
      <div role="alert" className="sd-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', maxWidth: '560px' }}>
        <p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p>
        <button type="button" onClick={request.retry} style={buttonStyle('primary')}>Reintentar</button>
      </div>
    );
  }

  const { school, teachers } = request.data;
  return (
    <div className="sd">
      <header className="sd-hero">
        <span className="sd-eyebrow">Docentes</span>
        <h1>{school.name}</h1>
        <ul className="sd-chips" aria-label="Datos del ciclo">
          <li>Ciclo {school.schoolYear?.replace('-', '–') ?? '—'}</li>
          <li>{plural(teachers.length, 'docente con grupo', 'docentes con grupo')}</li>
        </ul>
      </header>

      <div className="sd-section-head">
        <p className="sd-muted">Avance del diagnóstico de cada docente con sus grupos. No es una comparación entre docentes.</p>
        <button type="button" style={buttonStyle('secondary')}
          onClick={() => say('El alta de docentes llegará en una siguiente versión.')}>
          Dar de alta docente
        </button>
      </div>

      {teachers.length === 0 ? (
        <div className="sd-card"><p className="sd-muted">Aún no hay docentes con grupo en el ciclo actual.</p></div>
      ) : (
        <ul className="sd-groups">
          {teachers.map((t) => (
            <li key={`${t.name}-${t.groups.join('-')}`} className="sd-card sd-teacher">
              <div className="sd-group-id">
                <strong>{t.name}</strong>
                <span>{t.groups.join(' · ')}</span>
              </div>
              <dl className="sd-group-stats">
                <div><dt>Alumnos</dt><dd>{t.studentCount}</dd></div>
                <div><dt>Con diagnóstico</dt><dd>{t.evidencePercentage}%</dd></div>
                <div><dt>Necesitan apoyo</dt><dd>{t.needsSupportCount}</dd></div>
              </dl>
              <div className="sd-meter" aria-hidden="true"><span style={{ width: `${t.evidencePercentage}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
