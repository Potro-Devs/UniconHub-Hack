import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { buttonStyle, card, mutedText, pageTitle, sectionTitle } from '@/shared/styles/ui';
import { schoolAnalyticsApi } from './schoolAnalytics.api';

const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))`, gap: '14px' });
const stack = { display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 };

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function useSchoolAnalytics() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    schoolAnalyticsApi.school({ signal: controller.signal })
      .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
      .catch((error) => !cancelled && setState({ status: 'error', data: null, error }));
    return () => { cancelled = true; controller.abort(); };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

/** Porcentaje + etiqueta: el color nunca es el único indicador. */
function LevelChip({ average, level, label }) {
  const colors = LEVELS.find((l) => l.code === level);
  return (
    <span style={{ display: 'inline-block', borderRadius: '10px', padding: '6px 10px', fontSize: '14px', fontWeight: 700, lineHeight: 1.35,
      background: colors?.bg ?? COLORS.bg, color: colors?.fg ?? COLORS.muted }}>
      {average == null ? label : `${average}% · ${label}`}
    </span>
  );
}

/** Barra apilada por nivel con leyenda en texto (conteos visibles). */
function Distribution({ distribution }) {
  const total = LEVELS.reduce((sum, l) => sum + (distribution[l.code] ?? 0), 0);
  if (!total) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div aria-hidden="true" style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', background: COLORS.bg }}>
        {LEVELS.map((l) => (distribution[l.code] ? <span key={l.code} style={{ width: `${(distribution[l.code] / total) * 100}%`, background: l.solid }} /> : null))}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '13px', color: COLORS.muted }}>
        {LEVELS.map((l) => (
          <li key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span aria-hidden="true" style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.solid }} />
            {l.label}: <strong style={{ color: COLORS.ink }}>{distribution[l.code] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({ value, label, note }) {
  return (
    <div style={{ ...card, gap: '4px', padding: '16px 18px' }}>
      <div className="font-display" style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '15px', fontWeight: 700 }}>{label}</div>
      {note && <div style={{ ...mutedText, fontSize: '13px' }}>{note}</div>}
    </div>
  );
}

function FieldCard({ field }) {
  return (
    <article style={{ ...card, gap: '10px' }}>
      <h3 className="font-display" style={{ margin: 0, fontSize: '19px', fontWeight: 700, lineHeight: 1.25 }}>{field.name}</h3>
      {field.assessed ? (
        <>
          <LevelChip average={field.average} level={field.level} label={field.label} />
          <div style={{ ...mutedText, fontSize: '13px' }}>
            Habilidades evaluadas: {field.skills.map((s) => s.name).join(', ')} · {field.evaluatedCount} alumnos con dato
          </div>
          <Distribution distribution={field.distribution} />
        </>
      ) : (
        <p style={{ ...mutedText, margin: 0 }}>
          Axi todavía no tiene reactivos de este campo formativo. No se reporta un porcentaje: la falta de datos no significa falta de aprendizaje.
        </p>
      )}
    </article>
  );
}

function GroupCard({ group, onOpenMap }) {
  return (
    <article style={{ ...card, gap: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{group.name}</h3>
        <span style={{ ...mutedText, fontSize: '14px' }}>{group.teacherName ?? 'Sin docente asignado'}</span>
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '13px', color: COLORS.muted }}>
        <div><dt>Alumnos</dt><dd style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.ink }}>{group.studentCount}</dd></div>
        <div><dt>Con diagnóstico</dt><dd style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.ink }}>{group.evidencePercentage}%</dd></div>
        <div><dt>Temario visto</dt><dd style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.ink }}>{group.coveragePercentage}%</dd></div>
      </dl>
      <div style={{ fontSize: '15px', lineHeight: 1.45 }}>
        <strong>{group.needsSupportCount}</strong> de {group.studentCount} alumnos necesitan apoyo en al menos una habilidad ({group.needsSupportPercentage}%).
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {group.fields.filter((f) => f.assessed).map((f) => (
          <li key={f.code} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>{f.name}</span>
            <LevelChip average={f.average} level={f.level} label={f.label} />
          </li>
        ))}
      </ul>
      {group.prioritySkill && (
        <div style={{ fontSize: '14px', padding: '10px 12px', borderRadius: '12px', background: COLORS.noticeBg }}>
          Habilidad prioritaria: <strong>{group.prioritySkill.name}</strong> ({group.prioritySkill.average}% · {group.prioritySkill.label})
        </div>
      )}
      <button type="button" onClick={() => onOpenMap(group.id)} style={buttonStyle('secondary', { fullWidth: true })}>
        Ver mapa del grupo
      </button>
    </article>
  );
}

/**
 * Panel de la escuela para Dirección (`GET /analytics/school`): datos reales y agregados del ciclo
 * actual, organizados por los campos formativos de la SEP. Sin nombres de alumnos.
 */
export function SchoolDashboardScreen() {
  const navigate = useNavigate();
  const { setActiveGroupId } = useTeacherGroups();
  const request = useSchoolAnalytics();

  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando el panel de la escuela…</p>;
  if (request.status === 'error') {
    return (
      <div role="alert" style={{ ...card, alignItems: 'flex-start', maxWidth: '560px' }}>
        <p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p>
        <button type="button" onClick={request.retry} style={buttonStyle('primary')}>Reintentar</button>
      </div>
    );
  }

  const { school, summary, fields, skills, groups, priorities, typicalErrors } = request.data;
  const updated = formatDate(summary.latestRecordedAt);
  const openMap = (groupId) => {
    setActiveGroupId(groupId);
    navigate('/docente/mapa');
  };

  return (
    <div style={stack}>
      <header>
        <h1 className="font-display" style={pageTitle}>{school.name}</h1>
        <p style={{ ...mutedText, margin: '6px 0 0' }}>
          Ciclo {school.schoolYear?.replace('-', '–') ?? '—'} · {summary.groupCount} {summary.groupCount === 1 ? 'grupo' : 'grupos'} · {summary.teacherCount} {summary.teacherCount === 1 ? 'docente' : 'docentes'}
          {updated && ` · Último diagnóstico: ${updated}`}
        </p>
      </header>

      {groups.length === 0 ? (
        <div style={card}><p style={{ ...mutedText, margin: 0 }}>Aún no hay grupos en el ciclo actual.</p></div>
      ) : (
        <>
          <section aria-label="Resumen de la escuela" style={grid('180px')}>
            <Kpi value={summary.studentCount} label="Alumnos inscritos" />
            <Kpi value={`${summary.evidencePercentage}%`} label="Con diagnóstico" note={`${summary.evaluatedStudentCount} de ${summary.studentCount} alumnos`} />
            <Kpi value={summary.needsSupportCount} label="Necesitan apoyo" note={`${summary.needsSupportPercentage}% · en al menos una habilidad`} />
            <Kpi value={`${summary.coveragePercentage}%`} label="Temario visto" note="Promedio de los grupos" />
          </section>

          <section aria-labelledby="priorities-title" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 id="priorities-title" className="font-display" style={sectionTitle}>Prioridades para decidir</h2>
            {priorities.length === 0 ? (
              <p style={{ ...mutedText, margin: 0 }}>No hay alertas por ahora. Los grupos tienen diagnóstico y avance del temario.</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {priorities.map((p, i) => (
                  <li key={`${p.type}-${i}`} style={{ ...card, gap: '6px', padding: '16px 18px' }}>
                    <strong style={{ fontSize: '17px', lineHeight: 1.35 }}>{p.title}</strong>
                    <span style={{ fontSize: '15px', lineHeight: 1.45 }}>{p.detail}</span>
                    <span style={{ ...mutedText, fontSize: '14px' }}>Sugerencia: {p.action}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="fields-title" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h2 id="fields-title" className="font-display" style={sectionTitle}>Campos formativos</h2>
              <p style={{ ...mutedText, margin: '4px 0 0', fontSize: '14px' }}>Plan de Estudio 2022 de la SEP. Promedio del dominio de los alumnos con dato.</p>
            </div>
            <div style={grid('260px')}>{fields.map((f) => <FieldCard key={f.code} field={f} />)}</div>
          </section>

          <section aria-labelledby="skills-title" style={{ ...card }}>
            <h2 id="skills-title" className="font-display" style={sectionTitle}>Habilidades clave en la escuela</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {skills.map((s) => (
                <li key={s.code} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '6px 12px', paddingBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{s.name}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...mutedText, fontSize: '13px' }}>{s.needsSupportCount} necesitan apoyo</span>
                    <LevelChip average={s.average} level={s.level} label={s.label} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="groups-title" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 id="groups-title" className="font-display" style={sectionTitle}>Grupos del ciclo</h2>
            <div style={grid('300px')}>{groups.map((g) => <GroupCard key={g.id} group={g} onOpenMap={openMap} />)}</div>
          </section>

          {typicalErrors.length > 0 && (
            <section aria-labelledby="errors-title" style={card}>
              <div>
                <h2 id="errors-title" className="font-display" style={sectionTitle}>Errores típicos más frecuentes</h2>
                <p style={{ ...mutedText, margin: '4px 0 0', fontSize: '14px' }}>Útiles para elegir el tema de formación docente o del Consejo Técnico.</p>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {typicalErrors.map((e) => (
                  <li key={`${e.skillCode}-${e.errorTag}`} style={{ lineHeight: 1.45 }}>
                    <strong>{e.skillName}:</strong> {e.explanation}
                    <span style={{ ...mutedText, fontSize: '13px' }}> · {e.studentCount} alumnos en {e.groupCount} {e.groupCount === 1 ? 'grupo' : 'grupos'}</span>
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
