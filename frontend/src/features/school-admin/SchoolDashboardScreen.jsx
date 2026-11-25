import { LEVELS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle } from '@/shared/styles/ui';
import { useSchoolAnalytics } from './useSchoolAnalytics';
import './school-dashboard.css';

const levelOf = (code) => LEVELS.find((l) => l.code === code);

export function formatDate(value) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Porcentaje + etiqueta: el color nunca es el único indicador. */
function Level({ average, level, label }) {
  const colors = levelOf(level);
  return (
    <span className="sd-level" style={{ background: colors?.bg ?? 'var(--axi-bg)', color: colors?.fg ?? 'var(--axi-muted)' }}>
      {average == null ? label : `${average}% · ${label}`}
    </span>
  );
}

function Kpi({ icon, label, value, note, meter }) {
  return (
    <div className="sd-card sd-kpi">
      <div className="sd-kpi-label"><span><InterfaceIcon name={icon} size={18} /></span>{label}</div>
      <div className="sd-kpi-value">{value}</div>
      {meter != null && <div className="sd-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, meter)}%` }} /></div>}
      {note && <div className="sd-kpi-note">{note}</div>}
    </div>
  );
}

function Distribution({ distribution }) {
  const total = LEVELS.reduce((sum, l) => sum + (distribution[l.code] ?? 0), 0);
  if (!total) return null;
  return (
    <>
      <div className="sd-stack" aria-hidden="true">
        {LEVELS.map((l) => (distribution[l.code]
          ? <span key={l.code} style={{ width: `${(distribution[l.code] / total) * 100}%`, background: l.solid }} /> : null))}
      </div>
      <ul className="sd-legend">
        {LEVELS.map((l) => <li key={l.code}><i style={{ background: l.solid }} aria-hidden="true" />{l.label} <b>{distribution[l.code] ?? 0}</b></li>)}
      </ul>
    </>
  );
}

function FieldCard({ field }) {
  if (!field.assessed) {
    return (
      <article className="sd-card sd-field sd-field-empty">
        <h3>{field.name}</h3>
        <p className="sd-muted">Aún sin reactivos en Axi. No se reporta porcentaje: la falta de datos no significa falta de aprendizaje.</p>
      </article>
    );
  }
  const colors = levelOf(field.level);
  return (
    <article className="sd-card sd-field">
      <div className="sd-field-top">
        <h3>{field.name}</h3>
        <Level average={null} level={field.level} label={field.label} />
      </div>
      <div className="sd-field-big" style={{ color: colors?.fg }}>{field.average}%</div>
      <p className="sd-muted">{field.skills.map((s) => s.name).join(' · ')} · {plural(field.evaluatedCount, 'alumno', 'alumnos')} con dato</p>
      <Distribution distribution={field.distribution} />
    </article>
  );
}

function SkillRow({ skill }) {
  const colors = levelOf(skill.level);
  return (
    <li className="sd-skill">
      <span className="sd-skill-name">{skill.name}</span>
      <Level average={skill.average} level={skill.level} label={skill.label} />
      <div className="sd-skill-bar" aria-hidden="true">
        <span style={{ width: `${skill.average ?? 0}%`, background: colors?.solid ?? 'var(--axi-borderInput)' }} />
        <i />
      </div>
      <span className="sd-skill-note">{skill.grades ? `Se trabaja de ${skill.grades} · ` : ''}{plural(skill.needsSupportCount, 'alumno necesita', 'alumnos necesitan')} apoyo · {skill.evaluatedCount} con dato</span>
    </li>
  );
}

function GroupRow({ group }) {
  return (
    <li className="sd-card sd-group">
      <div className="sd-group-id">
        <strong>{group.name}</strong>
        <span>{group.teacherName ?? 'Sin docente asignado'}</span>
      </div>
      <dl className="sd-group-stats">
        <div><dt>Alumnos</dt><dd>{group.studentCount}</dd></div>
        <div><dt>Con diagnóstico</dt><dd>{group.evidencePercentage}%</dd></div>
        <div><dt>Necesitan apoyo</dt><dd>{group.needsSupportPercentage}%</dd></div>
      </dl>
      <div className="sd-group-fields">
        {group.fields.filter((f) => f.assessed).map((f) => {
          const colors = levelOf(f.level);
          return (
            <span key={f.code} className="sd-level" style={{ background: colors?.bg ?? 'var(--axi-bg)', color: colors?.fg ?? 'var(--axi-muted)' }}>
              {f.name}: {f.average == null ? 'Sin evaluar' : `${f.average}% · ${f.label}`}
            </span>
          );
        })}
      </div>
      {group.prioritySkill
        ? <span className="sd-tag">Prioridad: {group.prioritySkill.name}</span>
        : <span className="sd-tag">Sin diagnóstico</span>}
    </li>
  );
}

/**
 * Panel de la escuela para Dirección (`GET /analytics/school`): datos reales y agregados del ciclo
 * actual, organizados por los campos formativos de la SEP. Sin nombres de alumnos ni detalle por alumno.
 */
export function SchoolDashboardScreen() {
  const request = useSchoolAnalytics();

  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando el panel de la escuela…</p>;
  if (request.status === 'error') {
    return (
      <div role="alert" className="sd-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', maxWidth: '560px' }}>
        <p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p>
        <button type="button" onClick={request.retry} style={buttonStyle('primary')}>Reintentar</button>
      </div>
    );
  }

  const { school, summary, fields, skills, groups, priorities, typicalErrors } = request.data;
  const updated = formatDate(summary.latestRecordedAt);
  const maxErrorCount = Math.max(1, ...typicalErrors.map((e) => e.studentCount));

  return (
    <div className="sd">
      <header className="sd-hero">
        <span className="sd-eyebrow">Panel de la escuela</span>
        <h1>{school.name}</h1>
        <ul className="sd-chips" aria-label="Datos del ciclo">
          <li>Ciclo {school.schoolYear?.replace('-', '–') ?? '—'}</li>
          <li>{plural(summary.groupCount, 'grupo', 'grupos')}</li>
          <li>{plural(summary.teacherCount, 'docente', 'docentes')}</li>
          {updated && <li>Último diagnóstico: {updated}</li>}
        </ul>
      </header>

      {groups.length === 0 ? (
        <div className="sd-card"><p className="sd-muted">Aún no hay grupos en el ciclo actual.</p></div>
      ) : (
        <>
          <section aria-label="Indicadores generales" className="sd-kpis">
            <Kpi icon="groups" label="Alumnos inscritos" value={summary.studentCount} note={`En ${plural(summary.groupCount, 'grupo', 'grupos')}`} />
            <Kpi icon="pencil" label="Con diagnóstico" value={`${summary.evidencePercentage}%`} meter={summary.evidencePercentage}
              note={`${summary.evaluatedStudentCount} de ${summary.studentCount} alumnos`} />
            <Kpi icon="spark" label="Necesitan apoyo" value={summary.needsSupportCount} meter={summary.needsSupportPercentage}
              note={`${summary.needsSupportPercentage}% · en al menos una habilidad`} />
            <Kpi icon="book" label="Temario visto" value={`${summary.coveragePercentage}%`} meter={summary.coveragePercentage}
              note="Promedio de los grupos" />
          </section>

          <div className="sd-split">
            <section aria-labelledby="sd-fields" className="sd-section">
              <div className="sd-section-head">
                <h2 id="sd-fields">Campos formativos</h2>
                <span className="sd-muted">Plan de Estudio 2022 · SEP</span>
              </div>
              <div className="sd-fields">{fields.map((f) => <FieldCard key={f.code} field={f} />)}</div>
            </section>

            <section aria-labelledby="sd-priorities" className="sd-section">
              <div className="sd-section-head"><h2 id="sd-priorities">Prioridades para decidir</h2></div>
              {priorities.length === 0 ? (
                <div className="sd-card"><p className="sd-muted">No hay alertas: los grupos tienen diagnóstico y avance del temario.</p></div>
              ) : (
                <ol className="sd-priorities">
                  {priorities.map((p, i) => (
                    <li key={`${p.type}-${i}`} className="sd-card sd-priority">
                      <strong>{p.title}</strong>
                      <p>{p.detail}</p>
                      <p className="sd-action">{p.action}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="sd-split sd-split-even">
            <section aria-labelledby="sd-skills" className="sd-card sd-section">
              <div className="sd-section-head">
                <h2 id="sd-skills">Habilidades clave</h2>
                <span className="sd-muted">La línea marca 50% (Logrado)</span>
              </div>
              <ul className="sd-skills">{skills.map((s) => <SkillRow key={s.code} skill={s} />)}</ul>
            </section>

            {typicalErrors.length > 0 && (
              <section aria-labelledby="sd-errors" className="sd-card sd-section">
                <div className="sd-section-head">
                  <h2 id="sd-errors">Errores típicos frecuentes</h2>
                  <span className="sd-muted">Temas para el Consejo Técnico</span>
                </div>
                <ol className="sd-errors">
                  {typicalErrors.map((e) => (
                    <li key={`${e.skillCode}-${e.errorTag}`} className="sd-error">
                      <p><strong>{e.skillName}:</strong> {e.explanation}</p>
                      <div className="sd-meter" aria-hidden="true"><span style={{ width: `${(e.studentCount / maxErrorCount) * 100}%`, background: 'var(--axi-noticeFg)' }} /></div>
                      <small>{plural(e.studentCount, 'alumno', 'alumnos')} en {plural(e.groupCount, 'grupo', 'grupos')}</small>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <section aria-labelledby="sd-groups" className="sd-section">
            <div className="sd-section-head">
              <h2 id="sd-groups">Resumen por grupo</h2>
              <span className="sd-muted">Promedios del grupo; sin datos de alumnos</span>
            </div>
            <div className="sd-groups-head" aria-hidden="true">
              <span>Grupo</span><span>Alumnos</span><span>Con diagnóstico</span><span>Necesitan apoyo</span><span>Campos formativos</span><span>Prioridad</span>
            </div>
            <ul className="sd-groups">{groups.map((g) => <GroupRow key={g.id} group={g} />)}</ul>
          </section>
        </>
      )}
    </div>
  );
}
