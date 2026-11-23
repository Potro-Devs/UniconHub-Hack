import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS, getDotsForLevel, getLevelIndex } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import {
  CURRICULUM_CONTENTS,
  EVOLUTION_OFFSETS,
  SKILLS,
  STUDENTS,
  SUGGESTED_ACTIVITIES,
} from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { mean, useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 02: Mapa del grupo (alumno × habilidad o contenido) y analítica resumida.
 */
export function GroupMapScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const {
    axis,
    setAxis,
    sort,
    setSort,
    captured,
    reveal,
    covN,
    weakestSkill,
    needSupportStudents,
    scoreOf,
    contentScoreOf,
    say,
  } = useAppUi();

  const lastApp = captured ? 'Última aplicación: 20 nov 2026' : 'Última aplicación: 25 sep 2026';

  const segStyle = (active) =>
    active ? { background: '#fff', color: COLORS.ink } : { background: 'transparent', color: COLORS.muted };

  const distOf = (vals) =>
    LEVELS.map((l, idx) => ({
      n: vals.filter((v) => getLevelIndex(v) === idx).length,
      solid: l.solid,
      label: l.label,
    }));

  const skCols = SKILLS.map((k) => ({
    name: k.name,
    isFr: k.id === 'fr',
    get: (st) => scoreOf(st, k.id),
  }));

  const ctCols = CURRICULUM_CONTENTS.slice(0, 5).map((c) => ({
    name: c.short,
    isFr: c.sk.includes('fr'),
    get: (st) => contentScoreOf(st, c),
  }));

  const cols = axis === 'hab' ? skCols : ctCols;

  const mapCols = cols.map((c) => {
    const vals = STUDENTS.map(c.get).filter((x) => x != null);
    const avg = mean(vals);
    return {
      name: c.name,
      avgTxt: avg == null ? 'Captura pendiente' : `${avg}% · ${LEVELS[getLevelIndex(avg)].label}`,
      dist: vals.length ? distOf(vals) : [{ n: 1, solid: '#E6EBF3', label: 'Pendiente' }],
    };
  });

  const avgOfStudent = (st) => mean(cols.map((c) => c.get(st)).filter((x) => x != null));
  const orderedStudents =
    sort === 'apoyo' ? [...STUDENTS].sort((a, b) => avgOfStudent(a) - avgOfStudent(b)) : STUDENTS;

  const anim = reveal && !reducedMotion;
  const gridCols = `minmax(170px,200px) repeat(${cols.length}, minmax(84px,1fr))`;

  const weakLevel = LEVELS[getLevelIndex(weakestSkill.avg)];
  const weak = {
    name: weakestSkill.k.name,
    avg: weakestSkill.avg,
    label: weakLevel.label,
    bg: weakLevel.bg,
    fg: weakLevel.fg,
  };

  const act = SUGGESTED_ACTIVITIES[weakestSkill.k.id];
  const needN = needSupportStudents.length;

  const evo = SKILLS.map((k) => {
    const now = mean(STUDENTS.map((s) => scoreOf(s, k.id)).filter((x) => x != null));
    if (now == null) {
      return { name: k.name, sepW: '0%', nowW: '0%', solid: '#E6EBF3', nowTxt: '—', txt: 'Captura pendiente' };
    }
    const sep = EVOLUTION_OFFSETS[k.id] != null ? now - EVOLUTION_OFFSETS[k.id] : null;
    return {
      name: k.name,
      sepW: `${sep ?? 0}%`,
      nowW: `${now}%`,
      solid: LEVELS[getLevelIndex(now)].solid,
      nowTxt: `${now}%`,
      txt: sep == null ? 'primera vez' : `+${now - sep}`,
    };
  });

  const errTxt = act.err;
  const aiSummary = `En ${weak.name}, ${needN} de 45 alumnos necesitan apoyo (promedio del grupo: ${weak.avg}%). El error más frecuente: ${
    errTxt.charAt(0).toLowerCase() + errTxt.slice(1)
  } Desde septiembre el grupo subió 9 puntos en Suma y resta. Antes de la siguiente aplicación, prueba “${
    act.t
  }” con esos ${needN} alumnos.`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '14px' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
            Mapa del grupo
          </h1>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
            3.º A · 45 alumnos · Matemáticas · {lastApp}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '12px', background: '#E6EBF3' }}>
            {[
              ['hab', 'Por habilidad'],
              ['cont', 'Por contenido'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAxis(id)}
                style={{
                  border: 0,
                  borderRadius: '9px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...segStyle(axis === id),
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '12px', background: '#E6EBF3' }}>
            {[
              ['lista', 'Lista'],
              ['apoyo', 'Más apoyo primero'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSort(id)}
                style={{
                  border: 0,
                  borderRadius: '9px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...segStyle(sort === id),
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3 tarjetas resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div
          style={{
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '20px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: COLORS.muted }}>Habilidad más débil</div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '26px', lineHeight: 1.1 }}>
            {weak.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                background: weak.bg,
                color: weak.fg,
                fontWeight: 700,
              }}
            >
              {weak.label}
            </span>
            {weak.avg}% promedio
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '20px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: COLORS.muted }}>Necesitan apoyo en {weak.name}</div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '26px', lineHeight: 1.1 }}>
            {needN} <span style={{ fontSize: '18px', color: COLORS.muted }}>de 45 alumnos</span>
          </div>
          <button
            type="button"
            onClick={() => setSort('apoyo')}
            style={{
              alignSelf: 'flex-start',
              border: 0,
              background: 'none',
              padding: 0,
              fontSize: '14px',
              fontWeight: 700,
              color: COLORS.primaryText,
              cursor: 'pointer',
            }}
          >
            Ver quiénes primero →
          </button>
        </div>

        <div
          style={{
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '20px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '13px', color: COLORS.muted }}>Temario evaluado</div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '26px', lineHeight: 1.1 }}>
            {covN} <span style={{ fontSize: '18px', color: COLORS.muted }}>de 10 contenidos</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${covN * 10}%`,
                background: COLORS.primaryAccent,
                borderRadius: '999px',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate('/docente/temario')}
            style={{
              alignSelf: 'flex-start',
              border: 0,
              background: 'none',
              padding: 0,
              fontSize: '14px',
              fontWeight: 700,
              color: COLORS.primaryText,
              cursor: 'pointer',
            }}
          >
            Ir al temario →
          </button>
        </div>
      </div>

      {/* Actividad sugerida */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px 24px',
          padding: '22px',
          borderRadius: '24px',
          background: 'oklch(0.96 0.05 92)',
          border: '1px solid oklch(0.88 0.09 90)',
        }}
      >
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'oklch(0.42 0.09 75)',
            }}
          >
            Actividad sugerida · {weak.name}
          </div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '24px', lineHeight: 1.15 }}>
            {act.t}
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.45, textWrap: 'pretty', maxWidth: '60ch' }}>
            {act.d}
          </div>
          <div style={{ fontSize: '14px', color: COLORS.muted }}>{act.meta}</div>
          <div style={{ fontSize: '14px', lineHeight: 1.4 }}>
            <b>Error típico detectado:</b> {act.err}
          </div>
        </div>

        <div
          style={{
            flex: '0 1 260px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: COLORS.muted }}>
              Para {needN} alumnos en “Necesita apoyo”
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {needSupportStudents.slice(0, 8).map((st) => (
                <div
                  key={st.i}
                  title={st.name}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1px solid oklch(0.85 0.08 90)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {st.ini}
                </div>
              ))}
              {needN > 8 && (
                <div
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: COLORS.muted,
                  }}
                >
                  +{needN - 8}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => say(`“${act.t}” asignada a ${needN} alumnos.`)}
            style={{
              border: 0,
              borderRadius: '14px',
              padding: '13px 16px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              background: COLORS.ink,
              color: '#fff',
            }}
          >
            Asignar a estos alumnos
          </button>
        </div>
      </div>

      {/* Evolución y Resumen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
        <div
          style={{
            flex: '1.2 1 340px',
            minWidth: 0,
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              Evolución del grupo
            </h2>
            <span style={{ fontSize: '13px', color: COLORS.muted }}>
              Septiembre → noviembre (gris → color)
            </span>
          </div>

          {evo.map((e) => (
            <div
              key={e.name}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(100px,1fr) minmax(90px,2fr) minmax(80px,auto)',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{e.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ height: '6px', borderRadius: '999px', background: '#EEF1F6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: e.sepW, background: '#B9C2D4', borderRadius: '999px' }} />
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: '#EEF1F6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: e.nowW, background: e.solid, borderRadius: '999px' }} />
                </div>
              </div>
              <div style={{ fontSize: '13px', textAlign: 'right', color: COLORS.muted }}>
                <b style={{ color: COLORS.ink }}>{e.nowTxt}</b> {e.txt}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            flex: '1 1 300px',
            minWidth: 0,
            background: 'oklch(0.97 0.02 268)',
            border: '1px solid oklch(0.88 0.06 268)',
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Mascot size={44} mood="pista" />
            <div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
                Resumen para ti
              </div>
              <div style={{ fontSize: '12px', color: COLORS.muted }}>
                Solo explica datos ya calculados; no inventa.
              </div>
            </div>
          </div>

          <div style={{ fontSize: '15px', lineHeight: 1.5, textWrap: 'pretty', flex: 1 }}>
            {aiSummary}
          </div>

          <button
            type="button"
            onClick={() => say('La redacción con IA se conectará en una fase posterior; se muestra el resumen calculado.')}
            style={{
              alignSelf: 'flex-start',
              border: '1px solid oklch(0.8 0.08 268)',
              background: '#fff',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'oklch(0.4 0.2 268)',
            }}
          >
            Redactar con IA
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
        {LEVELS.map((l, idx) => (
          <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <div
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                background: l.bg,
                color: l.fg,
                fontSize: '9px',
                lineHeight: 1,
                letterSpacing: '1px',
              }}
            >
              {getDotsForLevel(idx)}
            </div>
            <b>{l.label}</b>
            <span style={{ color: COLORS.muted }}>{l.range}</span>
          </div>
        ))}
      </div>

      {/* Matriz alumno x habilidad */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '20px',
          overflow: 'auto',
          maxHeight: narrow ? '460px' : '620px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: '#fff',
            borderBottom: `1px solid ${COLORS.border}`,
            minWidth: 'max-content',
          }}
        >
          <div
            style={{
              position: 'sticky',
              left: 0,
              background: '#fff',
              padding: '12px 14px',
              fontSize: '13px',
              color: COLORS.muted,
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            Alumno
          </div>
          {mapCols.map((c) => (
            <div
              key={c.name}
              style={{
                padding: '10px 6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  lineHeight: 1.15,
                  minHeight: '30px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: '12px', color: COLORS.muted }}>{c.avgTxt}</div>
              <div
                style={{
                  display: 'flex',
                  width: '56px',
                  height: '6px',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  background: '#E6EBF3',
                }}
              >
                {c.dist.map((g, gi) => (
                  <div key={gi} style={{ flex: g.n, background: g.solid }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {orderedStudents.map((st, ri) => (
          <div
            key={st.i}
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              borderBottom: '1px solid #EEF1F6',
              minWidth: 'max-content',
            }}
          >
            <button
              type="button"
              className="axi-name-hover"
              onClick={() => navigate(`/docente/perfil/${st.i}`)}
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                background: '#fff',
                border: 0,
                textAlign: 'left',
                padding: '0 14px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: COLORS.mutedLight, fontSize: '12px', width: '18px' }}>
                {st.i + 1}
              </span>
              {st.name}
            </button>

            {cols.map((c) => {
              const v = c.get(st);
              if (v == null) {
                return (
                  <div
                    key={c.name}
                    onClick={() => navigate(`/docente/perfil/${st.i}`)}
                    title={`${c.name}: sin datos`}
                    style={{
                      margin: '3px',
                      height: '42px',
                      borderRadius: '10px',
                      background: COLORS.bg,
                      color: COLORS.mutedLight,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>—</div>
                    <div style={{ fontSize: '8px', lineHeight: 1, letterSpacing: '1px' }}>○○○○</div>
                  </div>
                );
              }
              const k = getLevelIndex(v);
              const lv = LEVELS[k];
              return (
                <div
                  key={c.name}
                  onClick={() => navigate(`/docente/perfil/${st.i}`)}
                  title={`${st.name} · ${c.name} · ${v}% · ${lv.label}`}
                  style={{
                    margin: '3px',
                    height: '42px',
                    borderRadius: '10px',
                    background: lv.bg,
                    color: lv.fg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    animation: anim && c.isFr ? `cellIn .45s ease-out ${ri * 28}ms both` : 'none',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>{v}%</div>
                  <div style={{ fontSize: '8px', lineHeight: 1, letterSpacing: '1px' }}>
                    {getDotsForLevel(k)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '13px', color: COLORS.muted }}>
        Toca un alumno para ver su perfil. Cada celda muestra porcentaje y nivel (puntos); el color nunca va solo.
      </div>
    </div>
  );
}
