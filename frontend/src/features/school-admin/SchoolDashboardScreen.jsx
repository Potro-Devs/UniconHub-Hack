import { useState } from 'react';
import { LEVELS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle } from '@/shared/styles/ui';
import { schoolAnalyticsApi } from './schoolAnalytics.api';
import { useSchoolAnalytics } from './useSchoolAnalytics';
import './school-dashboard.css';

/** Secciones del panel: una a la vez para evitar tanto scroll vertical. */
const SECTIONS = [
  { id: 'resumen', label: 'Resumen', icon: 'star' },
  { id: 'campos', label: 'Campos formativos', icon: 'book' },
  { id: 'habilidades', label: 'Habilidades', icon: 'map' },
  { id: 'grupos', label: 'Grupos', icon: 'groups' },
  { id: 'errores', label: 'Errores típicos', icon: 'pencil' },
];

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
  const [tab, setTab] = useState('resumen');
  const [download, setDownload] = useState({ pending: false, message: '', error: false });

  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando el panel de la escuela…</p>;
  if (request.status === 'error') {
    return (
      <div role="alert" className="sd-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', maxWidth: '560px' }}>
        <p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p>
        <button type="button" onClick={request.retry} style={buttonStyle('primary')}>Reintentar</button>
      </div>
    );
  }

  const { school, summary, fields, skills, groups, priorities, typicalErrors, cte } = request.data;
  const updated = formatDate(summary.latestRecordedAt);
  const maxErrorCount = Math.max(1, ...typicalErrors.map((e) => e.studentCount));
  const tabs = SECTIONS.filter((s) => s.id !== 'errores' || typicalErrors.length > 0);

  const exportPdf = async () => {
    setDownload({ pending: true, message: '', error: false });
    try {
      const blob = await schoolAnalyticsApi.exportPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `panel-escuela-${school.schoolYear ?? 'ciclo'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownload({ pending: false, message: 'PDF listo. Incluye indicadores, prioridades del mes, campos formativos, habilidades y resumen por grupo, sin datos de alumnos.', error: false });
    } catch (error) {
      setDownload({ pending: false, message: errorMessageOf(error), error: true });
    }
  };

  return (
    <div className="sd">
      <header className="sd-hero">
        <div className="sd-hero-top">
          <div className="sd-hero-text">
            <span className="sd-eyebrow">Panel de la escuela</span>
            <h1>{school.name}</h1>
          </div>
          <button type="button" className="sd-export" onClick={exportPdf} disabled={download.pending || groups.length === 0}>
            <InterfaceIcon name="paper" size={18} />{download.pending ? 'Preparando…' : 'Exportar PDF'}
          </button>
        </div>
        <ul className="sd-chips" aria-label="Datos del ciclo">
          <li>Ciclo {school.schoolYear?.replace('-', '–') ?? '—'}</li>
          <li>{plural(summary.groupCount, 'grupo', 'grupos')}</li>
          <li>{plural(summary.teacherCount, 'docente', 'docentes')}</li>
          {updated && <li>Último diagnóstico: {updated}</li>}
        </ul>
      </header>
      {download.message && <p className={`sd-download ${download.error ? 'sd-download-error' : ''}`} role={download.error ? 'alert' : 'status'}>{download.message}</p>}

      {groups.length === 0 ? (
        <div className="sd-card"><p className="sd-muted">Aún no hay grupos en el ciclo actual.</p></div>
      ) : (
        <>
          <div className="sd-tabs" role="tablist" aria-label="Secciones del panel">
            {tabs.map((s) => (
              <button key={s.id} type="button" role="tab" id={`sd-tab-${s.id}`} aria-selected={tab === s.id}
                aria-controls={`sd-panel-${s.id}`} className="sd-tab" onClick={() => setTab(s.id)}>
                <InterfaceIcon name={s.icon} size={18} />{s.label}
              </button>
            ))}
          </div>

          {tab === 'resumen' && (
            <section role="tabpanel" id="sd-panel-resumen" aria-labelledby="sd-tab-resumen" className="sd-section">
              <div className="sd-kpis">
                <Kpi icon="groups" label="Alumnos inscritos" value={summary.studentCount} note={`En ${plural(summary.groupCount, 'grupo', 'grupos')}`} />
                <Kpi icon="pencil" label="Con diagnóstico" value={`${summary.evidencePercentage}%`} meter={summary.evidencePercentage}
                  note={`${summary.evaluatedStudentCount} de ${summary.studentCount} alumnos`} />
                <Kpi icon="spark" label="Necesitan apoyo" value={summary.needsSupportCount} meter={summary.needsSupportPercentage}
                  note={`${summary.needsSupportPercentage}% · en al menos una habilidad`} />
                <Kpi icon="book" label="Temario visto" value={`${summary.coveragePercentage}%`} meter={summary.coveragePercentage}
                  note="Promedio de los grupos" />
              </div>
              <div className="sd-split">
                <div className="sd-section">
                  <div className="sd-section-head">
                    <h2>Prioridades del mes</h2>
                    {cte && <span className="sd-muted">Para el CTE de {cte.month}</span>}
                  </div>
                  {priorities.length === 0 ? (
                    <div className="sd-card"><p className="sd-muted">Sin alertas este mes.</p></div>
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
                  <p className="sd-muted">Orientativas: diagnóstico corto y temario por validar con docentes. Para conversar en el CTE, no como calificación.</p>
                </div>
                {cte && (
                  <aside className="sd-card sd-cte" aria-label="Próximo Consejo Técnico Escolar">
                    <span className="sd-eyebrow">Próximo Consejo Técnico</span>
                    <strong className="sd-cte-date">{cte.label}</strong>
                    <span className="sd-cte-days">{cte.daysUntil === 0 ? 'Es hoy' : `Faltan ${plural(cte.daysUntil, 'día', 'días')}`}</span>
                    <p className="sd-muted">
                      {cte.source === 'calendar'
                        ? 'Según el calendario escolar SEP del ciclo (sesiones ordinarias el último viernes del mes).'
                        : 'Estimado: último viernes del mes. Confirma la fecha con el calendario oficial.'}
                    </p>
                  </aside>
                )}
              </div>
            </section>
          )}

          {tab === 'campos' && (
            <section role="tabpanel" id="sd-panel-campos" aria-labelledby="sd-tab-campos" className="sd-section">
              <div className="sd-section-head">
                <h2>Campos formativos</h2>
                <span className="sd-muted">Plan de Estudio 2022 · SEP</span>
              </div>
              <div className="sd-fields">{fields.map((f) => <FieldCard key={f.code} field={f} />)}</div>
            </section>
          )}

          {tab === 'habilidades' && (
            <section role="tabpanel" id="sd-panel-habilidades" aria-labelledby="sd-tab-habilidades" className="sd-card sd-section">
              <div className="sd-section-head">
                <h2>Habilidades clave</h2>
                <span className="sd-muted">La línea marca 50% (Logrado)</span>
              </div>
              <ul className="sd-skills">{skills.map((s) => <SkillRow key={s.code} skill={s} />)}</ul>
            </section>
          )}

          {tab === 'grupos' && (
            <section role="tabpanel" id="sd-panel-grupos" aria-labelledby="sd-tab-grupos" className="sd-section">
              <div className="sd-section-head">
                <h2>Resumen por grupo</h2>
                <span className="sd-muted">Promedios del grupo; sin datos de alumnos</span>
              </div>
              <div className="sd-groups-head" aria-hidden="true">
                <span>Grupo</span><span>Alumnos</span><span>Con diagnóstico</span><span>Necesitan apoyo</span><span>Campos formativos</span><span>Prioridad</span>
              </div>
              <ul className="sd-groups">{groups.map((g) => <GroupRow key={g.id} group={g} />)}</ul>
            </section>
          )}

          {tab === 'errores' && (
            <section role="tabpanel" id="sd-panel-errores" aria-labelledby="sd-tab-errores" className="sd-card sd-section">
              <div className="sd-section-head">
                <h2>Errores típicos frecuentes</h2>
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
        </>
      )}
    </div>
  );
}
